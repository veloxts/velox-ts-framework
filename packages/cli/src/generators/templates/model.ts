/**
 * Model Template
 *
 * Generates Prisma model, Zod schema, and optionally procedures.
 */

import type { TemplateContext, TemplateFunction, GeneratedFile } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface ModelOptions {
  /** Generate CRUD procedures alongside the model */
  crud: boolean;
  /** Include pagination for list operation */
  paginated: boolean;
  /** Include soft delete (deletedAt field) */
  softDelete: boolean;
  /** Include timestamps (createdAt, updatedAt) */
  timestamps: boolean;
}

// ============================================================================
// Prisma Model Template
// ============================================================================

/**
 * Generate Prisma model definition
 */
function generatePrismaModel(ctx: TemplateContext<ModelOptions>): string {
  const { entity, options } = ctx;

  const fields: string[] = [
    '  id        String   @id @default(uuid())',
  ];

  // Add timestamps if enabled
  if (options.timestamps) {
    fields.push('  createdAt DateTime @default(now())');
    fields.push('  updatedAt DateTime @updatedAt');
  }

  // Add soft delete if enabled
  if (options.softDelete) {
    fields.push('  deletedAt DateTime?');
  }

  return `/// ${entity.humanReadable} model
/// Add your fields below the id field
model ${entity.pascal} {
${fields.join('\n')}

  // TODO: Add your ${entity.humanReadable} fields here
  // name      String
  // email     String   @unique

  @@map("${entity.snake}")
}
`;
}

// ============================================================================
// Zod Schema Template
// ============================================================================

/**
 * Generate Zod schema file
 */
function generateZodSchema(ctx: TemplateContext<ModelOptions>): string {
  const { entity, options } = ctx;

  const schemaFields: string[] = [
    '  id: z.string().uuid(),',
  ];

  // Add timestamps if enabled
  if (options.timestamps) {
    schemaFields.push('  createdAt: z.string().datetime(),');
    schemaFields.push('  updatedAt: z.string().datetime(),');
  }

  // Add soft delete if enabled
  if (options.softDelete) {
    schemaFields.push('  deletedAt: z.string().datetime().nullable(),');
  }

  return `/**
 * ${entity.pascal} Schemas
 *
 * Zod validation schemas for ${entity.humanReadable} model.
 */

import { z } from '@veloxts/velox';

// ============================================================================
// Response Schema
// ============================================================================

/**
 * ${entity.pascal} response schema
 */
export const ${entity.pascal}Schema = z.object({
${schemaFields.join('\n')}
  // TODO: Add your ${entity.humanReadable} fields here
  // name: z.string().min(1).max(100),
  // email: z.string().email(),
});

export type ${entity.pascal} = z.infer<typeof ${entity.pascal}Schema>;

// ============================================================================
// Input Schemas
// ============================================================================

/**
 * Create ${entity.pascal} input schema
 */
export const Create${entity.pascal}Input = z.object({
  // TODO: Add required fields for creating a ${entity.humanReadable}
  // name: z.string().min(1).max(100),
  // email: z.string().email(),
});

export type Create${entity.pascal}Data = z.infer<typeof Create${entity.pascal}Input>;

/**
 * Update ${entity.pascal} input schema
 */
export const Update${entity.pascal}Input = z.object({
  // TODO: Add optional fields for updating a ${entity.humanReadable}
  // name: z.string().min(1).max(100).optional(),
  // email: z.string().email().optional(),
});

export type Update${entity.pascal}Data = z.infer<typeof Update${entity.pascal}Input>;
`;
}

// ============================================================================
// Procedures Template
// ============================================================================

/**
 * Generate procedures file
 */
function generateProcedures(ctx: TemplateContext<ModelOptions>): string {
  const { entity, options } = ctx;

  const paginationImport = options.paginated ? ', paginationInputSchema' : '';

  const listOutput = options.paginated
    ? `z.object({
        data: z.array(${entity.pascal}Schema),
        meta: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
        }),
      })`
    : `z.array(${entity.pascal}Schema)`;

  const listInput = options.paginated
    ? `.input(paginationInputSchema.optional())`
    : '';

  const listLogic = options.paginated
    ? `const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const skip = (page - 1) * limit;
      ${options.softDelete ? 'const where = { deletedAt: null };' : ''}

      const [items, total] = await Promise.all([
        ctx.db.${entity.camel}.findMany({ ${options.softDelete ? 'where, ' : ''}skip, take: limit }),
        ctx.db.${entity.camel}.count(${options.softDelete ? '{ where }' : ''}),
      ]);

      return {
        data: items.map(toResponse),
        meta: { page, limit, total },
      };`
    : `${options.softDelete ? 'const where = { deletedAt: null };' : ''}
      const items = await ctx.db.${entity.camel}.findMany(${options.softDelete ? '{ where }' : ''});
      return items.map(toResponse);`;

  const deleteLogic = options.softDelete
    ? `await ctx.db.${entity.camel}.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });`
    : `await ctx.db.${entity.camel}.delete({
        where: { id: input.id },
      });`;

  const findWhereClause = options.softDelete
    ? `{ id: input.id, deletedAt: null }`
    : `{ id: input.id }`;

  const responseFields = ['id: item.id,'];
  if (options.timestamps) {
    responseFields.push('createdAt: item.createdAt.toISOString(),');
    responseFields.push('updatedAt: item.updatedAt.toISOString(),');
  }
  if (options.softDelete) {
    responseFields.push('deletedAt: item.deletedAt?.toISOString() ?? null,');
  }

  const dbInterfaceFields = ['id: string;'];
  if (options.timestamps) {
    dbInterfaceFields.push('createdAt: Date;');
    dbInterfaceFields.push('updatedAt: Date;');
  }
  if (options.softDelete) {
    dbInterfaceFields.push('deletedAt: Date | null;');
  }

  return `/**
 * ${entity.pascal} Procedures
 *
 * CRUD operations for ${entity.humanReadablePlural}.
 */

import { defineProcedures, procedure${paginationImport}, z } from '@veloxts/velox';

import {
  ${entity.pascal}Schema,
  Create${entity.pascal}Input,
  Update${entity.pascal}Input,
} from '../schemas/${entity.kebab}.js';

// ============================================================================
// Type Definitions
// ============================================================================

// Database model type - should match your Prisma schema
interface Db${entity.pascal} {
  ${dbInterfaceFields.join('\n  ')}
  // TODO: Add your ${entity.humanReadable} fields here
}

// Helper to convert database model to response
function toResponse(item: Db${entity.pascal}) {
  return {
    ${responseFields.join('\n    ')}
    // TODO: Map your ${entity.humanReadable} fields here
  };
}

// ============================================================================
// Procedures
// ============================================================================

export const ${entity.camel}Procedures = defineProcedures('${entity.plural}', {
  /**
   * Get a single ${entity.humanReadable} by ID
   * GET /${entity.plural}/:id
   */
  get${entity.pascal}: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(${entity.pascal}Schema.nullable())
    .query(async ({ input, ctx }) => {
      const item = await ctx.db.${entity.camel}.findUnique({
        where: ${findWhereClause},
      });
      return item ? toResponse(item) : null;
    }),

  /**
   * List all ${entity.humanReadablePlural}
   * GET /${entity.plural}
   */
  list${entity.pascalPlural}: procedure()
    ${listInput}
    .output(${listOutput})
    .query(async ({ input, ctx }) => {
      ${listLogic}
    }),

  /**
   * Create a new ${entity.humanReadable}
   * POST /${entity.plural}
   */
  create${entity.pascal}: procedure()
    .input(Create${entity.pascal}Input)
    .output(${entity.pascal}Schema)
    .mutation(async ({ input, ctx }) => {
      const item = await ctx.db.${entity.camel}.create({
        data: input,
      });
      return toResponse(item);
    }),

  /**
   * Update an existing ${entity.humanReadable} (full update)
   * PUT /${entity.plural}/:id
   */
  update${entity.pascal}: procedure()
    .input(z.object({ id: z.string().uuid() }).merge(Update${entity.pascal}Input))
    .output(${entity.pascal}Schema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const item = await ctx.db.${entity.camel}.update({
        where: { id },
        data,
      });
      return toResponse(item);
    }),

  /**
   * Partially update an existing ${entity.humanReadable}
   * PATCH /${entity.plural}/:id
   */
  patch${entity.pascal}: procedure()
    .input(z.object({ id: z.string().uuid() }).merge(Update${entity.pascal}Input))
    .output(${entity.pascal}Schema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const item = await ctx.db.${entity.camel}.update({
        where: { id },
        data,
      });
      return toResponse(item);
    }),

  /**
   * Delete a ${entity.humanReadable}
   * DELETE /${entity.plural}/:id
   */
  delete${entity.pascal}: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      ${deleteLogic}
      return { success: true };
    }),
});
`;
}

// ============================================================================
// Template Exports
// ============================================================================

/**
 * Model template - generates Prisma model definition
 */
export const prismaModelTemplate: TemplateFunction<ModelOptions> = (ctx) => {
  return generatePrismaModel(ctx);
};

/**
 * Schema template - generates Zod schema file
 */
export const schemaTemplate: TemplateFunction<ModelOptions> = (ctx) => {
  return generateZodSchema(ctx);
};

/**
 * Procedures template - generates procedure file
 */
export const proceduresTemplate: TemplateFunction<ModelOptions> = (ctx) => {
  return generateProcedures(ctx);
};

/**
 * Generate all files for a model
 */
export function generateModelFiles(ctx: TemplateContext<ModelOptions>): GeneratedFile[] {
  const { entity, options } = ctx;
  const files: GeneratedFile[] = [];

  // Always generate Prisma model snippet
  files.push({
    path: `prisma/models/${entity.kebab}.prisma`,
    content: generatePrismaModel(ctx),
  });

  // Always generate Zod schema
  files.push({
    path: `src/schemas/${entity.kebab}.ts`,
    content: generateZodSchema(ctx),
  });

  // Generate procedures if --crud flag is set
  if (options.crud) {
    files.push({
      path: `src/procedures/${entity.plural}.ts`,
      content: generateProcedures(ctx),
    });
  }

  return files;
}

/**
 * Generate post-generation instructions
 */
export function getModelInstructions(ctx: TemplateContext<ModelOptions>): string {
  const { entity, options } = ctx;

  let instructions = `
  1. Copy the Prisma model to your schema:

     cat prisma/models/${entity.kebab}.prisma >> prisma/schema.prisma

     Then customize the fields and run:
     pnpm db:push && pnpm db:generate

  2. Export the schema:

     // src/schemas/index.ts
     export * from './${entity.kebab}.js';
`;

  if (options.crud) {
    instructions += `
  3. Export the procedures:

     // src/procedures/index.ts
     export * from './${entity.plural}.js';

  4. Register the procedures in your app:

     // src/index.ts
     import { ${entity.camel}Procedures } from './procedures/index.js';

     const collections = [..., ${entity.camel}Procedures];
`;
  }

  return instructions;
}
