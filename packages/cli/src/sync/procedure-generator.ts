/**
 * Sync Procedure Generator
 *
 * Generates complete TypeScript source for procedure files from a
 * `ProcedureFilePlan`. Supports two output strategies:
 *
 * - `output`: Procedures use `.output()` with plain Zod schemas
 * - `resource`: Procedures use `resource()` / `resourceCollection()` projection
 *
 * Both strategies generate CRUD procedures based on `plan.crud` flags.
 */

import type { EntityNames } from '../generators/types.js';
import { deriveEntityNames, toKebabCase } from '../generators/utils/naming.js';
import type { ProcedureFilePlan } from './types.js';

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a complete TypeScript source string for a procedure file.
 *
 * The output is a syntactically valid TypeScript module containing:
 * - Imports (router, zod, schemas)
 * - A procedures collection with CRUD operations based on plan.crud
 */
export function generateProcedureFile(plan: ProcedureFilePlan): string {
  const names = deriveEntityNames(plan.model.name);
  const lines: string[] = [];

  // ── Imports ──────────────────────────────────────────
  lines.push(generateImports(plan, names.pascal, names.pascalPlural));
  lines.push('');

  // ── Procedures Collection ───────────────────────────
  lines.push(generateProceduresCollection(plan, names));

  // Ensure trailing newline
  return `${lines.join('\n')}\n`;
}

function generateImports(plan: ProcedureFilePlan, pascal: string, pascalPlural: string): string {
  const lines: string[] = [];

  // Router imports
  const routerImports = ['procedure', 'procedures'];
  if (plan.outputStrategy === 'resource') {
    if (plan.crud.get) {
      routerImports.push('resource');
    }
    if (plan.crud.list) {
      routerImports.push('resourceCollection');
    }
  }
  lines.push(`import { ${routerImports.join(', ')} } from '@veloxts/router';`);

  // Zod import
  lines.push("import { z } from 'zod';");

  // Schema imports
  const schemaNames = buildSchemaImportNames(plan, pascal, pascalPlural);
  if (schemaNames.length > 0) {
    lines.push(`import {\n  ${schemaNames.join(',\n  ')},\n} from '${plan.schemaImportPath}';`);
  }

  return lines.join('\n');
}

function buildSchemaImportNames(
  plan: ProcedureFilePlan,
  pascal: string,
  pascalPlural: string
): string[] {
  const schemas: string[] = [];

  if (plan.outputStrategy === 'output') {
    // Output strategy: import base or WithRelations schema
    if (plan.crud.get || plan.crud.list) {
      if (plan.includeRelations.length > 0) {
        schemas.push(`${pascal}WithRelationsSchema`);
      } else {
        schemas.push(`${pascal}Schema`);
      }
    }
  } else {
    // Resource strategy: import base schema (for resource projection)
    if (plan.crud.get || plan.crud.list) {
      schemas.push(`${pascal}Schema`);
    }
  }

  if (plan.crud.create) {
    schemas.push(`Create${pascal}Schema`);
  }
  if (plan.crud.update) {
    schemas.push(`Update${pascal}Schema`);
  }
  if (plan.crud.list) {
    schemas.push(`List${pascalPlural}Schema`);
  }

  return schemas;
}

// ============================================================================
// Procedures Collection
// ============================================================================

function generateProceduresCollection(plan: ProcedureFilePlan, names: EntityNames): string {
  const routerName = toKebabCase(names.plural);
  const collectionVar = `${names.camel}Procedures`;

  const procedureEntries: string[] = [];

  if (plan.crud.get) {
    procedureEntries.push(generateGetProcedure(plan, names));
  }
  if (plan.crud.list) {
    procedureEntries.push(generateListProcedure(plan, names));
  }
  if (plan.crud.create) {
    procedureEntries.push(generateCreateProcedure(plan, names));
  }
  if (plan.crud.update) {
    procedureEntries.push(generateUpdateProcedure(plan, names));
  }
  if (plan.crud.delete) {
    procedureEntries.push(generateDeleteProcedure(plan, names));
  }

  const lines: string[] = [];
  lines.push(`export const ${collectionVar} = procedures('${routerName}', {`);
  lines.push(procedureEntries.join('\n\n'));
  lines.push('});');

  return lines.join('\n');
}

// ============================================================================
// Individual Procedure Generators
// ============================================================================

function generateGetProcedure(plan: ProcedureFilePlan, names: EntityNames): string {
  const procName = `get${names.pascal}`;
  const hasIncludes = plan.includeRelations.length > 0;
  const lines: string[] = [];

  lines.push(`  ${procName}: procedure()`);
  lines.push(`    .input(z.object({ id: z.string().uuid() }))`);

  if (plan.outputStrategy === 'output') {
    const schemaName = hasIncludes ? `${names.pascal}WithRelationsSchema` : `${names.pascal}Schema`;
    lines.push(`    .output(${schemaName})`);
    lines.push(`    .query(async ({ input, ctx }) => {`);
    lines.push(`      return ctx.db.${names.camel}.findUniqueOrThrow({`);
    lines.push(`        where: { id: input.id },`);
    if (hasIncludes) {
      lines.push(generateIncludeBlock(plan.includeRelations, 8));
    }
    lines.push(`      });`);
    lines.push(`    }),`);
  } else {
    // Resource strategy: no .output(), use resource()
    lines.push(`    .query(async ({ input, ctx }) => {`);
    lines.push(`      const ${names.camel} = await ctx.db.${names.camel}.findUniqueOrThrow({`);
    lines.push(`        where: { id: input.id },`);
    if (hasIncludes) {
      lines.push(generateIncludeBlock(plan.includeRelations, 8));
    }
    lines.push(`      });`);
    lines.push(`      return resource(${names.camel}, ${names.pascal}Schema.public);`);
    lines.push(`    }),`);
  }

  return lines.join('\n');
}

function generateListProcedure(plan: ProcedureFilePlan, names: EntityNames): string {
  const procName = `list${names.pascalPlural}`;
  const hasIncludes = plan.includeRelations.length > 0;
  const lines: string[] = [];

  lines.push(`  ${procName}: procedure()`);
  lines.push(`    .input(List${names.pascalPlural}Schema)`);

  lines.push(`    .query(async ({ input, ctx }) => {`);

  lines.push(`      const { page, perPage } = input;`);
  lines.push(`      const [items, total] = await Promise.all([`);
  lines.push(`        ctx.db.${names.camel}.findMany({`);
  lines.push(`          skip: (page - 1) * perPage,`);
  lines.push(`          take: perPage,`);
  if (plan.model.hasTimestamps) {
    lines.push(`          orderBy: { createdAt: 'desc' },`);
  }
  if (hasIncludes) {
    lines.push(generateIncludeBlock(plan.includeRelations, 10));
  }
  lines.push(`        }),`);
  lines.push(`        ctx.db.${names.camel}.count(),`);
  lines.push(`      ]);`);

  if (plan.outputStrategy === 'resource') {
    lines.push(`      return {`);
    lines.push(`        items: resourceCollection(items, ${names.pascal}Schema.public),`);
    lines.push(`        total, page, perPage,`);
    lines.push(`      };`);
  } else {
    lines.push(`      return { items, total, page, perPage };`);
  }

  lines.push(`    }),`);

  return lines.join('\n');
}

function generateCreateProcedure(plan: ProcedureFilePlan, names: EntityNames): string {
  const procName = `create${names.pascal}`;
  const userFkField = plan.model.fields.find((f) => f.isUserForeignKey);
  const lines: string[] = [];

  lines.push(`  ${procName}: procedure()`);
  lines.push(`    .input(Create${names.pascal}Schema)`);
  lines.push(`    .mutation(async ({ input, ctx }) => {`);

  if (userFkField) {
    lines.push(`      return ctx.db.${names.camel}.create({`);
    lines.push(`        data: { ...input, ${userFkField.name}: ctx.user.id },`);
    lines.push(`      });`);
  } else {
    lines.push(`      return ctx.db.${names.camel}.create({ data: input });`);
  }

  lines.push(`    }),`);

  return lines.join('\n');
}

function generateUpdateProcedure(_plan: ProcedureFilePlan, names: EntityNames): string {
  const procName = `update${names.pascal}`;
  const lines: string[] = [];

  lines.push(`  ${procName}: procedure()`);
  lines.push(`    .input(Update${names.pascal}Schema.extend({ id: z.string().uuid() }))`);
  lines.push(`    .mutation(async ({ input, ctx }) => {`);
  lines.push(`      const { id, ...data } = input;`);
  lines.push(`      return ctx.db.${names.camel}.update({ where: { id }, data });`);
  lines.push(`    }),`);

  return lines.join('\n');
}

function generateDeleteProcedure(plan: ProcedureFilePlan, names: EntityNames): string {
  const procName = `delete${names.pascal}`;
  const lines: string[] = [];

  lines.push(`  ${procName}: procedure()`);

  if (plan.model.isJoinTable && plan.model.uniqueConstraints.length > 0) {
    // Join table: use compound unique key for delete
    const constraintFields = plan.model.uniqueConstraints[0];
    const compoundKeyName = constraintFields.join('_');
    const inputFields = constraintFields.map((f) => `${f}: z.string().uuid()`).join(', ');
    const whereFields = constraintFields.map((f) => `${f}: input.${f}`).join(', ');

    lines.push(`    .input(z.object({ ${inputFields} }))`);
    lines.push(`    .mutation(async ({ input, ctx }) => {`);
    lines.push(`      await ctx.db.${names.camel}.delete({`);
    lines.push(`        where: { ${compoundKeyName}: { ${whereFields} } },`);
    lines.push(`      });`);
    lines.push(`      return { success: true };`);
    lines.push(`    }),`);
  } else {
    lines.push(`    .input(z.object({ id: z.string().uuid() }))`);
    lines.push(`    .mutation(async ({ input, ctx }) => {`);
    lines.push(`      await ctx.db.${names.camel}.delete({ where: { id: input.id } });`);
    lines.push(`      return { success: true };`);
    lines.push(`    }),`);
  }

  return lines.join('\n');
}

// ============================================================================
// Include Block Helper
// ============================================================================

function generateIncludeBlock(relations: readonly string[], indent: number): string {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];
  lines.push(`${pad}include: {`);
  for (const rel of relations) {
    lines.push(`${pad}  ${rel}: true,`);
  }
  lines.push(`${pad}},`);
  return lines.join('\n');
}
