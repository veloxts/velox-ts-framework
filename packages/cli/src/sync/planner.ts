/**
 * Sync Planner
 *
 * Transforms user choices from the prompter stage into a concrete
 * generation plan consumed by the generator stage.
 *
 * For each model the user chose to generate or regenerate, the planner
 * computes output paths, import paths, field/relation filtering, and
 * router registration metadata.
 */

import { join } from 'node:path';

import { deriveEntityNames, toKebabCase } from '../generators/utils/naming.js';
import type {
  ModelChoices,
  ProcedureFilePlan,
  RegistrationPlan,
  SchemaFilePlan,
  SyncModelInfo,
  SyncPlan,
} from './types.js';

/**
 * Build a complete generation plan from analyzer models and user choices.
 *
 * Skipped models produce no plan entries. For each non-skipped model,
 * the planner produces a schema file plan, a procedure file plan,
 * and a router registration plan.
 *
 * @param models    - Model metadata from the analyzer stage
 * @param choices   - User selections from the prompter stage
 * @param projectRoot - Absolute path to the project root directory
 * @returns A complete plan ready for the generator stage
 */
export function buildPlan(
  models: readonly SyncModelInfo[],
  choices: readonly ModelChoices[],
  projectRoot: string
): SyncPlan {
  const schemas: SchemaFilePlan[] = [];
  const procedures: ProcedureFilePlan[] = [];
  const registrations: RegistrationPlan[] = [];

  for (const choice of choices) {
    if (choice.action === 'skip') {
      continue;
    }

    const names = deriveEntityNames(choice.model);
    const model = models.find((m) => m.name === choice.model);

    if (!model) {
      continue;
    }

    const fileAction =
      choice.action === 'regenerate' ? ('overwrite' as const) : ('create' as const);
    const pluralKebab = toKebabCase(names.plural);

    // ── Schema file plan ──────────────────────────────────────────────
    const allFields = model.fields;
    const fields = allFields.filter((f) => !f.isAutoManaged && !f.isSensitive);
    const relations = model.relations.filter((r) => choice.schemaRelations.includes(r.name));

    schemas.push({
      model,
      outputPath: join(projectRoot, 'src/schemas', `${names.kebab}.schema.ts`),
      outputStrategy: choice.outputStrategy,
      allFields,
      fields,
      relations,
      fieldVisibility: choice.fieldVisibility,
      action: fileAction,
    });

    // ── Procedure file plan ───────────────────────────────────────────
    const includeRelations = model.relations
      .filter((r) => choice.includeRelations.includes(r.name))
      .map((r) => r.name);

    procedures.push({
      model,
      outputPath: join(projectRoot, 'src/procedures', `${pluralKebab}.ts`),
      schemaImportPath: `../schemas/${names.kebab}.schema.js`,
      outputStrategy: choice.outputStrategy,
      crud: choice.crud,
      includeRelations,
      action: fileAction,
    });

    // ── Registration plan ─────────────────────────────────────────────
    registrations.push({
      procedureVarName: `${names.camel}Procedures`,
      entityName: pluralKebab,
      importPath: `./procedures/${pluralKebab}.js`,
    });
  }

  return { schemas, procedures, registrations };
}
