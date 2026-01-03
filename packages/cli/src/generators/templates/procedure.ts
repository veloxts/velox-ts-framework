/**
 * Procedure Template
 *
 * Generates procedure files for VeloxTS applications.
 */

import type { TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface ProcedureOptions {
  /** Generate full CRUD operations */
  crud: boolean;
  /** Include pagination for list operation */
  paginated: boolean;
  /** Skip auto-registering in router.ts */
  skipRegistration: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a simple procedure with just a get operation
 */
function generateSimpleProcedure(ctx: TemplateContext<ProcedureOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Procedures
 */

import { procedure, procedures, z } from '@veloxts/velox';

export const ${entity.camel}Procedures = procedures('${entity.plural}', {
  /**
   * Get a single ${entity.humanReadable} by ID
   * GET /${entity.plural}/:id
   */
  get${entity.pascal}: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(
      z.object({
        id: z.string().uuid(),
        // TODO: Add ${entity.humanReadable} fields
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      }).nullable()
    )
    .query(async ({ input, ctx }) => {
      // TODO: Implement get${entity.pascal} logic
      // Example: return ctx.db.${entity.camel}.findUnique({ where: { id: input.id } });
      throw new Error('Not implemented');
    }),
});
`;
}

/**
 * Generate CRUD procedures
 */
function generateCrudProcedures(ctx: TemplateContext<ProcedureOptions>): string {
  const { entity, options } = ctx;

  const listOutput = options.paginated
    ? `z.object({
        data: z.array(${entity.pascal}Schema),
        meta: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
          totalPages: z.number(),
        }),
      })`
    : `z.array(${entity.pascal}Schema)`;

  const listInput = options.paginated ? `.input(paginationInputSchema.optional())` : '';

  const listLogic = options.paginated
    ? `const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        ctx.db.${entity.camel}.findMany({ skip, take: limit }),
        ctx.db.${entity.camel}.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: items.map(toResponse),
        meta: { page, limit, total, totalPages },
      };`
    : `const items = await ctx.db.${entity.camel}.findMany();
      return items.map(toResponse);`;

  const paginationImport = options.paginated ? ', paginationInputSchema' : '';

  return `/**
 * ${entity.pascal} Procedures
 *
 * CRUD operations for ${entity.humanReadablePlural}.
 */

import { procedure, procedures${paginationImport}, z } from '@veloxts/velox';

// ============================================================================
// Schemas
// ============================================================================

/**
 * ${entity.pascal} response schema
 */
const ${entity.pascal}Schema = z.object({
  id: z.string().uuid(),
  // TODO: Add ${entity.humanReadable} fields here
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Create ${entity.pascal} input schema
 */
const Create${entity.pascal}Input = z.object({
  // TODO: Add required fields for creating a ${entity.humanReadable}
});

/**
 * Update ${entity.pascal} input schema
 */
const Update${entity.pascal}Input = z.object({
  // TODO: Add optional fields for updating a ${entity.humanReadable}
});

// ============================================================================
// Type Definitions
// ============================================================================

// Database model type - adjust to match your Prisma schema
interface Db${entity.pascal} {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to convert database model to response
function toResponse(db${entity.pascal}: Db${entity.pascal}) {
  return {
    id: db${entity.pascal}.id,
    createdAt: db${entity.pascal}.createdAt.toISOString(),
    updatedAt: db${entity.pascal}.updatedAt.toISOString(),
  };
}

// ============================================================================
// Procedures
// ============================================================================

export const ${entity.camel}Procedures = procedures('${entity.plural}', {
  /**
   * Get a single ${entity.humanReadable} by ID
   * GET /${entity.plural}/:id
   */
  get${entity.pascal}: procedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(${entity.pascal}Schema.nullable())
    .query(async ({ input, ctx }) => {
      const item = await ctx.db.${entity.camel}.findUnique({
        where: { id: input.id },
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
      await ctx.db.${entity.camel}.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
`;
}

// ============================================================================
// Template Export
// ============================================================================

/**
 * Generate procedure file content
 */
export const procedureTemplate: TemplateFunction<ProcedureOptions> = (ctx) => {
  if (ctx.options.crud) {
    return generateCrudProcedures(ctx);
  }
  return generateSimpleProcedure(ctx);
};

/**
 * Generate the file path for a procedure
 */
export function getProcedurePath(entityPlural: string): string {
  return `src/procedures/${entityPlural}.ts`;
}

/**
 * Generate post-generation instructions
 */
export function getProcedureInstructions(entityPlural: string, entityPascal: string): string {
  return `
  1. Add the procedure to your exports:

     // src/procedures/index.ts
     export * from './${entityPlural}.js';

  2. Register the procedure collection in your app:

     // src/index.ts
     import { ${entityPlural.replace(/-/g, '')}Procedures } from './procedures/index.js';

     const collections = [..., ${entityPlural.replace(/-/g, '')}Procedures];

  3. If using CRUD, add the ${entityPascal} model to your Prisma schema:

     // prisma/schema.prisma
     model ${entityPascal} {
       id        String   @id @default(uuid())
       createdAt DateTime @default(now())
       updatedAt DateTime @updatedAt

       @@map("${entityPlural.replace(/-/g, '_')}")
     }
`;
}
