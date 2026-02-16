/**
 * Sync Orchestrator
 *
 * Wires together the 5-stage `velox sync` pipeline:
 * 1. Analyze Prisma schema -> SyncModelInfo[]
 * 2. Detect existing code   -> ExistingCodeMap
 * 3. Prompt user for choices -> ModelChoices[]
 * 4. Build generation plan   -> SyncPlan
 * 5. Generate files + register in router
 *
 * Supports --dry-run, --force, and --skip-registration flags.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import { registerProcedures } from '../generators/utils/router-integration.js';
import type { FileSnapshot } from '../generators/utils/snapshot.js';
import { executeWithRollback, saveOriginal, trackCreated } from '../generators/utils/snapshot.js';
import { analyzeSchema } from './analyzer.js';
import { detectExisting } from './detector.js';
import { buildPlan } from './planner.js';
import { generateProcedureFile } from './procedure-generator.js';
import { promptAllModels } from './prompter.js';
import { generateSchemaFile } from './schema-generator.js';
import type {
  ModelChoices,
  SyncCommandOptions,
  SyncModelInfo,
  SyncPlan,
  SyncResult,
} from './types.js';

// ============================================================================
// Public API
// ============================================================================

/**
 * Execute the full sync pipeline.
 *
 * @param projectRoot - Absolute path to the project root directory
 * @param options     - CLI flags (dryRun, force, skipRegistration)
 * @returns Summary of files created, overwritten, skipped, registered, and errors
 */
export async function executeSync(
  projectRoot: string,
  options: SyncCommandOptions
): Promise<SyncResult> {
  // ── Stage 1: Analyze ────────────────────────────────────────
  const models = analyzeSchema(projectRoot);

  if (models.length === 0) {
    p.log.warn('No models found in Prisma schema. Nothing to sync.');
    return emptyResult();
  }

  // ── Stage 2: Detect ─────────────────────────────────────────
  const existing = detectExisting(projectRoot, models);

  // Show discovery summary
  const existingProcCount = existing.procedures.size;
  const existingSchemaCount = existing.schemas.size;
  p.log.info(
    `Found ${pc.cyan(String(models.length))} model${models.length === 1 ? '' : 's'}` +
      (existingProcCount > 0 || existingSchemaCount > 0
        ? ` (${existingProcCount} existing procedure${existingProcCount === 1 ? '' : 's'}, ` +
          `${existingSchemaCount} existing schema${existingSchemaCount === 1 ? '' : 's'})`
        : '')
  );

  // ── Stage 3: Prompt ─────────────────────────────────────────
  let choices: readonly ModelChoices[];

  if (options.force) {
    choices = models.map((model) => buildDefaultChoices(model));
  } else {
    const prompted = await promptAllModels(models, existing);
    if (prompted === null) {
      p.log.warn('Cancelled.');
      return emptyResult();
    }
    choices = prompted;
  }

  // Check if anything was selected
  const activeChoices = choices.filter((c) => c.action !== 'skip');
  if (activeChoices.length === 0) {
    p.log.warn('All models skipped. Nothing to generate.');
    return emptyResult();
  }

  // ── Stage 4: Plan ───────────────────────────────────────────
  const plan = buildPlan(models, choices, projectRoot);

  // Show plan summary
  displayPlanSummary(plan, projectRoot);

  // Dry run: show plan and exit
  if (options.dryRun) {
    p.log.info(pc.dim('Dry run — no files were written.'));
    return buildDryRunResult(plan);
  }

  // Confirm before writing (unless --force)
  if (!options.force) {
    const totalFiles = plan.schemas.length + plan.procedures.length;
    const confirmed = await p.confirm({
      message: `Generate ${totalFiles} file${totalFiles === 1 ? '' : 's'}?`,
      initialValue: true,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.log.warn('Cancelled.');
      return emptyResult();
    }
  }

  // ── Stage 5: Generate ───────────────────────────────────────
  return executeWithRollback(async (snapshot) => {
    return generateFiles(snapshot, plan, projectRoot, options);
  });
}

// ============================================================================
// File Generation
// ============================================================================

/**
 * Generate all planned files within a snapshot transaction.
 */
async function generateFiles(
  snapshot: FileSnapshot,
  plan: SyncPlan,
  projectRoot: string,
  options: SyncCommandOptions
): Promise<SyncResult> {
  const created: string[] = [];
  const overwritten: string[] = [];
  const skipped: string[] = [];
  const registered: string[] = [];
  const errors: string[] = [];

  // ── Write schema files ──────────────────────────────────────
  for (const schemaPlan of plan.schemas) {
    try {
      const content = generateSchemaFile(schemaPlan);
      const outputPath = schemaPlan.outputPath;

      mkdirSync(dirname(outputPath), { recursive: true });

      if (schemaPlan.action === 'overwrite' && existsSync(outputPath)) {
        saveOriginal(snapshot, outputPath);
        writeFileSync(outputPath, content, 'utf-8');
        overwritten.push(outputPath);
      } else {
        writeFileSync(outputPath, content, 'utf-8');
        trackCreated(snapshot, outputPath);
        created.push(outputPath);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Schema ${schemaPlan.model.name}: ${msg}`);
    }
  }

  // ── Write procedure files ───────────────────────────────────
  for (const procPlan of plan.procedures) {
    try {
      const content = generateProcedureFile(procPlan);
      const outputPath = procPlan.outputPath;

      mkdirSync(dirname(outputPath), { recursive: true });

      if (procPlan.action === 'overwrite' && existsSync(outputPath)) {
        saveOriginal(snapshot, outputPath);
        writeFileSync(outputPath, content, 'utf-8');
        overwritten.push(outputPath);
      } else {
        writeFileSync(outputPath, content, 'utf-8');
        trackCreated(snapshot, outputPath);
        created.push(outputPath);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Procedure ${procPlan.model.name}: ${msg}`);
    }
  }

  // ── Register procedures in router ───────────────────────────
  if (!options.skipRegistration) {
    for (const reg of plan.registrations) {
      try {
        const result = registerProcedures(projectRoot, reg.entityName, reg.procedureVarName, false);

        if (result.success) {
          registered.push(reg.procedureVarName);
        } else if (result.error) {
          errors.push(`Registration ${reg.procedureVarName}: ${result.error}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Registration ${reg.procedureVarName}: ${msg}`);
      }
    }
  }

  // ── Display results ─────────────────────────────────────────
  displayResults(created, overwritten, registered, errors, projectRoot);

  return { created, overwritten, skipped, registered, errors };
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Display a summary of the generation plan before executing.
 */
function displayPlanSummary(plan: SyncPlan, projectRoot: string): void {
  const lines: string[] = [];

  if (plan.schemas.length > 0) {
    lines.push(pc.bold('Schemas:'));
    for (const s of plan.schemas) {
      const rel = relative(projectRoot, s.outputPath);
      const tag = s.action === 'overwrite' ? pc.yellow('overwrite') : pc.green('create');
      lines.push(`  ${tag}  ${rel}`);
    }
  }

  if (plan.procedures.length > 0) {
    lines.push(pc.bold('Procedures:'));
    for (const proc of plan.procedures) {
      const rel = relative(projectRoot, proc.outputPath);
      const tag = proc.action === 'overwrite' ? pc.yellow('overwrite') : pc.green('create');
      lines.push(`  ${tag}  ${rel}`);
    }
  }

  if (plan.registrations.length > 0) {
    lines.push(pc.bold('Registrations:'));
    for (const reg of plan.registrations) {
      lines.push(`  ${pc.cyan('register')}  ${reg.procedureVarName} -> ${reg.importPath}`);
    }
  }

  if (lines.length > 0) {
    p.log.info(lines.join('\n'));
  }
}

/**
 * Display the final results after generation.
 */
function displayResults(
  created: readonly string[],
  overwritten: readonly string[],
  registered: readonly string[],
  errors: readonly string[],
  projectRoot: string
): void {
  if (created.length > 0) {
    for (const filePath of created) {
      p.log.success(`${pc.green('created')}  ${relative(projectRoot, filePath)}`);
    }
  }

  if (overwritten.length > 0) {
    for (const filePath of overwritten) {
      p.log.success(`${pc.yellow('overwritten')}  ${relative(projectRoot, filePath)}`);
    }
  }

  if (registered.length > 0) {
    for (const name of registered) {
      p.log.success(`${pc.cyan('registered')}  ${name}`);
    }
  }

  if (errors.length > 0) {
    for (const msg of errors) {
      p.log.error(msg);
    }
  }
}

// ============================================================================
// Default Choices (--force mode)
// ============================================================================

/**
 * Build default ModelChoices for a model (used when --force is set).
 * Generates all CRUD, uses output strategy, includes no relations.
 */
function buildDefaultChoices(model: SyncModelInfo): ModelChoices {
  return {
    model: model.name,
    action: 'generate',
    outputStrategy: 'output',
    crud: {
      get: true,
      list: true,
      create: true,
      update: true,
      delete: true,
    },
    schemaRelations: [],
    includeRelations: [],
    fieldVisibility: undefined,
  };
}

// ============================================================================
// Result Helpers
// ============================================================================

/**
 * Build an empty SyncResult (for cancellation or no-op cases).
 */
function emptyResult(): SyncResult {
  return {
    created: [],
    overwritten: [],
    skipped: [],
    registered: [],
    errors: [],
  };
}

/**
 * Build a SyncResult for dry-run mode (no files written).
 */
function buildDryRunResult(plan: SyncPlan): SyncResult {
  const created: string[] = [];
  const overwritten: string[] = [];

  for (const s of plan.schemas) {
    if (s.action === 'overwrite') {
      overwritten.push(s.outputPath);
    } else {
      created.push(s.outputPath);
    }
  }

  for (const proc of plan.procedures) {
    if (proc.action === 'overwrite') {
      overwritten.push(proc.outputPath);
    } else {
      created.push(proc.outputPath);
    }
  }

  return {
    created,
    overwritten,
    skipped: [],
    registered: plan.registrations.map((r) => r.procedureVarName),
    errors: [],
  };
}
