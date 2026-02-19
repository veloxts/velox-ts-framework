/**
 * Sync Prompter
 *
 * Interactive prompts for the `velox sync` command.
 * Collects user choices for each Prisma model: action, CRUD operations,
 * output strategy, relation inclusion, and field visibility.
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';

import type {
  CrudChoices,
  ExistingCodeMap,
  ModelChoices,
  SyncModelInfo,
  SyncRelationInfo,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** Models that default to resource output strategy */
const RESOURCE_DEFAULT_MODELS = new Set(['User', 'Message']);

/** Horizontal rule width for model headers */
const HEADER_WIDTH = 54;

// ============================================================================
// Public API
// ============================================================================

/**
 * Run the full interactive flow for all models.
 * Returns null if user cancels at any point.
 */
export async function promptAllModels(
  models: readonly SyncModelInfo[],
  existing: ExistingCodeMap
): Promise<readonly ModelChoices[] | null> {
  const results: ModelChoices[] = [];

  for (const model of models) {
    const choices = await promptForModel(model, existing);
    if (choices === null) {
      return null;
    }
    results.push(choices);
  }

  return results;
}

/**
 * Run interactive prompts for a single model.
 * Returns null if user cancels (Ctrl+C).
 */
export async function promptForModel(
  model: SyncModelInfo,
  existing: ExistingCodeMap
): Promise<ModelChoices | null> {
  // Step 1: Display model header
  displayModelHeader(model, existing);

  // Step 2: Action selection
  const action = await promptAction(model, existing);
  if (action === null) return null;

  if (action === 'skip') {
    return buildSkipChoices(model.name);
  }

  // Step 3: Output strategy
  const outputStrategy = await promptOutputStrategy(model);
  if (outputStrategy === null) return null;

  // Step 4: CRUD operations
  const crud = await promptCrudOperations(model);
  if (crud === null) return null;

  // Step 5: Schema relations (only if model has relations)
  let schemaRelations: readonly string[] = [];
  if (model.relations.length > 0) {
    const selected = await promptSchemaRelations(model);
    if (selected === null) return null;
    schemaRelations = selected;
  }

  // Step 6: Include relations (only if schema relations were selected)
  let includeRelations: readonly string[] = [];
  if (schemaRelations.length > 0) {
    const selected = await promptIncludeRelations(schemaRelations);
    if (selected === null) return null;
    includeRelations = selected;
  }

  // Step 7: Field visibility (only if resource strategy)
  let fieldVisibility: ReadonlyMap<string, 'public' | 'authenticated' | 'admin'> | undefined;
  if (outputStrategy === 'resource') {
    const visibility = await promptFieldVisibility(model);
    if (visibility === null) return null;
    fieldVisibility = visibility;
  }

  return {
    model: model.name,
    action,
    outputStrategy,
    crud,
    schemaRelations,
    includeRelations,
    fieldVisibility,
  };
}

// ============================================================================
// Step 1: Model Header
// ============================================================================

/**
 * Display a formatted header for the model being prompted.
 */
function displayModelHeader(model: SyncModelInfo, existing: ExistingCodeMap): void {
  const titlePart = `── ${model.name} `;
  const remainingWidth = Math.max(0, HEADER_WIDTH - titlePart.length);
  const ruler = titlePart + '─'.repeat(remainingWidth);

  const nonAutoFields = model.fields.filter((f) => !f.isAutoManaged);
  const fieldNames = nonAutoFields.map((f) => f.name).join(', ');
  const relationLabels = model.relations.map((r) => formatRelationLabel(r)).join(', ');

  const lines: string[] = [pc.bold(ruler), `   Fields: ${fieldNames || pc.dim('(none)')}`];

  if (model.relations.length > 0) {
    lines.push(`   Relations: ${relationLabels}`);
  }

  const existingPath = existing.procedures.get(model.name);
  if (existingPath) {
    lines.push(`   Existing: ${pc.dim(existingPath)}`);
  }

  p.log.info(lines.join('\n'));
}

/**
 * Format a relation for display: `name(->RelatedModel)` or `name(->RelatedModel[])`.
 */
function formatRelationLabel(relation: SyncRelationInfo): string {
  const suffix = relation.kind === 'hasMany' ? '[]' : '';
  return `${relation.name}(→${relation.relatedModel}${suffix})`;
}

// ============================================================================
// Step 2: Action Selection
// ============================================================================

/**
 * Prompt the user for the action to take on a model.
 * Returns 'generate', 'regenerate', or 'skip', or null if cancelled.
 */
async function promptAction(
  model: SyncModelInfo,
  existing: ExistingCodeMap
): Promise<'generate' | 'regenerate' | 'skip' | null> {
  const hasExisting = existing.procedures.has(model.name);

  if (hasExisting) {
    const action = await p.select({
      message: `Action for ${model.name}?`,
      options: [
        { value: 'skip' as const, label: 'Skip (keep existing)' },
        { value: 'regenerate' as const, label: 'Regenerate (overwrite)' },
      ],
    });

    if (p.isCancel(action)) return null;
    return action;
  }

  const action = await p.select({
    message: `Generate procedures for ${model.name}?`,
    options: [
      { value: 'generate' as const, label: 'Yes, generate' },
      { value: 'skip' as const, label: 'Skip' },
    ],
  });

  if (p.isCancel(action)) return null;
  return action;
}

// ============================================================================
// Step 3: Output Strategy
// ============================================================================

/**
 * Prompt for output strategy (plain .output() vs resource schema).
 */
async function promptOutputStrategy(model: SyncModelInfo): Promise<'output' | 'resource' | null> {
  const hasSensitiveFields = model.fields.some((f) => f.isSensitive);
  const defaultToResource = hasSensitiveFields || RESOURCE_DEFAULT_MODELS.has(model.name);

  const outputStrategy = await p.select({
    message: 'Output strategy?',
    options: [
      { value: 'output' as const, label: '.output() \u2014 Same fields for all users' },
      {
        value: 'resource' as const,
        label: '.expose() \u2014 Different fields per access level (resource schema)',
      },
    ],
    initialValue: defaultToResource ? ('resource' as const) : ('output' as const),
  });

  if (p.isCancel(outputStrategy)) return null;
  return outputStrategy;
}

// ============================================================================
// Step 4: CRUD Operations
// ============================================================================

type CrudOp = 'get' | 'list' | 'create' | 'update' | 'delete';

/**
 * Prompt for which CRUD operations to generate.
 */
async function promptCrudOperations(model: SyncModelInfo): Promise<CrudChoices | null> {
  const allOps: CrudOp[] = ['get', 'list', 'create', 'update', 'delete'];

  const crudOps = await p.multiselect<CrudOp>({
    message: 'CRUD operations:',
    options: [
      { value: 'get', label: 'get' },
      { value: 'list', label: 'list' },
      { value: 'create', label: 'create' },
      { value: 'update', label: 'update' },
      { value: 'delete', label: 'delete' },
    ],
    initialValues: model.isJoinTable ? ['create', 'delete'] : allOps,
    required: true,
  });

  if (p.isCancel(crudOps)) return null;

  const selected = new Set<CrudOp>(crudOps);
  return {
    get: selected.has('get'),
    list: selected.has('list'),
    create: selected.has('create'),
    update: selected.has('update'),
    delete: selected.has('delete'),
  };
}

// ============================================================================
// Step 5: Schema Relations
// ============================================================================

/**
 * Prompt for which relations to include in the Zod schema.
 */
async function promptSchemaRelations(model: SyncModelInfo): Promise<readonly string[] | null> {
  const schemaRelations = await p.multiselect<string>({
    message: 'Include relations in Zod schema?',
    options: model.relations.map((r) => ({
      value: r.name,
      label: `${r.name} (→${r.relatedModel}${r.kind === 'hasMany' ? '[]' : ''})`,
    })),
    initialValues: model.relations.filter((r) => r.kind === 'belongsTo').map((r) => r.name),
    required: false,
  });

  if (p.isCancel(schemaRelations)) return null;
  return schemaRelations;
}

// ============================================================================
// Step 6: Include Relations
// ============================================================================

/**
 * Prompt for which of the selected schema relations to also fetch via Prisma includes.
 */
async function promptIncludeRelations(
  schemaRelations: readonly string[]
): Promise<readonly string[] | null> {
  const includeRelations = await p.multiselect<string>({
    message: 'Fetch relations in queries? (Prisma includes)',
    options: schemaRelations.map((name) => ({
      value: name,
      label: name,
    })),
    initialValues: [...schemaRelations],
    required: false,
  });

  if (p.isCancel(includeRelations)) return null;
  return includeRelations;
}

// ============================================================================
// Step 7: Field Visibility
// ============================================================================

type VisibilityLevel = 'public' | 'authenticated' | 'admin';

/**
 * Prompt for field visibility configuration (resource strategy only).
 * Returns a map of field name -> visibility level for ALL non-auto fields.
 */
async function promptFieldVisibility(
  model: SyncModelInfo
): Promise<ReadonlyMap<string, VisibilityLevel> | null> {
  const nonAutoFields = model.fields.filter((f) => !f.isAutoManaged);

  const fieldsToRestrict = await p.multiselect<string>({
    message: 'Any fields to restrict from public access?',
    options: nonAutoFields.map((f) => ({
      value: f.name,
      label: f.name,
      hint: f.isSensitive ? 'sensitive' : undefined,
    })),
    initialValues: nonAutoFields.filter((f) => f.isSensitive).map((f) => f.name),
    required: false,
  });

  if (p.isCancel(fieldsToRestrict)) return null;

  const restrictedSet = new Set(fieldsToRestrict);

  // For each restricted field, ask for visibility level
  const restrictedLevels = new Map<string, VisibilityLevel>();

  for (const fieldName of fieldsToRestrict) {
    const level = await p.select({
      message: `Visibility for "${fieldName}"?`,
      options: [
        { value: 'authenticated' as const, label: 'authenticated \u2014 Logged-in users' },
        { value: 'admin' as const, label: 'admin \u2014 Admin only' },
      ],
    });

    if (p.isCancel(level)) return null;
    restrictedLevels.set(fieldName, level);
  }

  // Build full visibility map: restricted fields get their level, others get 'public'
  const visibility = new Map<string, VisibilityLevel>();
  for (const field of nonAutoFields) {
    if (restrictedSet.has(field.name)) {
      const level = restrictedLevels.get(field.name);
      if (level !== undefined) {
        visibility.set(field.name, level);
      }
    } else {
      visibility.set(field.name, 'public');
    }
  }

  return visibility;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a ModelChoices object for a skipped model.
 */
function buildSkipChoices(modelName: string): ModelChoices {
  return {
    model: modelName,
    action: 'skip',
    outputStrategy: 'output',
    crud: {
      get: false,
      list: false,
      create: false,
      update: false,
      delete: false,
    },
    schemaRelations: [],
    includeRelations: [],
    fieldVisibility: undefined,
  };
}
