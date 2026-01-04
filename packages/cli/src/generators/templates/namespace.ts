/**
 * Namespace Template
 *
 * Generates a procedure namespace (collection) with corresponding schema file.
 * Unlike the procedure generator, this creates a minimal scaffold ready for
 * custom procedures rather than pre-defined CRUD operations.
 */

import type { TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface NamespaceOptions {
  /** Skip auto-registering in router.ts */
  skipRegistration: boolean;
  /** Include example procedure */
  withExample: boolean;
}

// ============================================================================
// Template Functions
// ============================================================================

/**
 * Generate namespace procedure file
 */
export const namespaceTemplate: TemplateFunction<NamespaceOptions> = (ctx) => {
  const { entity, options } = ctx;

  if (options.withExample) {
    return generateWithExample(ctx);
  }

  return `/**
 * ${entity.pascal} Procedures
 *
 * Namespace for ${entity.humanReadable}-related API endpoints.
 */

import { procedure, procedures, z } from '@veloxts/velox';
import {
  ${entity.pascal}Schema,
  Create${entity.pascal}Input,
  Update${entity.pascal}Input,
} from '../schemas/${entity.kebab}.js';

// ============================================================================
// Procedures
// ============================================================================

export const ${entity.camel}Procedures = procedures('${entity.plural}', {
  // Add your procedures here
  //
  // Examples:
  //
  // get${entity.pascal}: procedure()
  //   .input(z.object({ id: z.string().uuid() }))
  //   .output(${entity.pascal}Schema.nullable())
  //   .query(async ({ input, ctx }) => {
  //     return ctx.db.${entity.camel}.findUnique({ where: { id: input.id } });
  //   }),
  //
  // list${entity.pascalPlural}: procedure()
  //   .output(z.array(${entity.pascal}Schema))
  //   .query(async ({ ctx }) => {
  //     return ctx.db.${entity.camel}.findMany();
  //   }),
  //
  // create${entity.pascal}: procedure()
  //   .input(Create${entity.pascal}Input)
  //   .output(${entity.pascal}Schema)
  //   .mutation(async ({ input, ctx }) => {
  //     return ctx.db.${entity.camel}.create({ data: input });
  //   }),
});
`;
};

/**
 * Generate namespace with example procedure
 */
function generateWithExample(ctx: TemplateContext<NamespaceOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Procedures
 *
 * Namespace for ${entity.humanReadable}-related API endpoints.
 */

import { procedure, procedures, z } from '@veloxts/velox';
import {
  ${entity.pascal}Schema,
  Create${entity.pascal}Input,
  Update${entity.pascal}Input,
} from '../schemas/${entity.kebab}.js';

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
      return ctx.db.${entity.camel}.findUnique({
        where: { id: input.id },
      });
    }),

  /**
   * List all ${entity.humanReadablePlural}
   * GET /${entity.plural}
   */
  list${entity.pascalPlural}: procedure()
    .output(z.array(${entity.pascal}Schema))
    .query(async ({ ctx }) => {
      return ctx.db.${entity.camel}.findMany();
    }),

  /**
   * Create a new ${entity.humanReadable}
   * POST /${entity.plural}
   */
  create${entity.pascal}: procedure()
    .input(Create${entity.pascal}Input)
    .output(${entity.pascal}Schema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.${entity.camel}.create({
        data: input,
      });
    }),

  /**
   * Update an existing ${entity.humanReadable}
   * PUT /${entity.plural}/:id
   */
  update${entity.pascal}: procedure()
    .input(z.object({ id: z.string().uuid() }).merge(Update${entity.pascal}Input))
    .output(${entity.pascal}Schema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.db.${entity.camel}.update({
        where: { id },
        data,
      });
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

/**
 * Generate schema file for the namespace
 */
export function namespaceSchemaTemplate(ctx: TemplateContext<NamespaceOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Schemas
 *
 * Zod validation schemas for ${entity.humanReadable} entities.
 */

import { z } from 'zod';

// ============================================================================
// Base Schema
// ============================================================================

/**
 * ${entity.pascal} entity schema
 */
export const ${entity.pascal}Schema = z.object({
  id: z.string().uuid(),
  // TODO: Add ${entity.humanReadable} fields
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ${entity.pascal} = z.infer<typeof ${entity.pascal}Schema>;

// ============================================================================
// Input Schemas
// ============================================================================

/**
 * Create ${entity.pascal} input
 */
export const Create${entity.pascal}Input = z.object({
  // TODO: Add required fields for creating a ${entity.humanReadable}
});

export type Create${entity.pascal}InputType = z.infer<typeof Create${entity.pascal}Input>;

/**
 * Update ${entity.pascal} input
 */
export const Update${entity.pascal}Input = z.object({
  // TODO: Add fields for updating a ${entity.humanReadable}
}).partial();

export type Update${entity.pascal}InputType = z.infer<typeof Update${entity.pascal}Input>;
`;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the file path for the procedure file
 */
export function getNamespaceProcedurePath(entityPlural: string): string {
  return `src/procedures/${entityPlural}.ts`;
}

/**
 * Get the file path for the schema file
 */
export function getNamespaceSchemaPath(entityKebab: string): string {
  return `src/schemas/${entityKebab}.ts`;
}

/**
 * Generate post-generation instructions
 */
export function getNamespaceInstructions(
  entityPlural: string,
  entityPascal: string,
  entityKebab: string
): string {
  return `
  1. Add the schema export:

     // src/schemas/index.ts
     export * from './${entityKebab}.js';

  2. Add the procedure export:

     // src/procedures/index.ts
     export * from './${entityPlural}.js';

  3. Register the procedure collection:

     // src/index.ts (or router.ts)
     import { ${entityPlural.replace(/-/g, '')}Procedures } from './procedures/index.js';

     const collections = [..., ${entityPlural.replace(/-/g, '')}Procedures];

  4. Add the Prisma model:

     // prisma/schema.prisma
     model ${entityPascal} {
       id        String   @id @default(uuid())
       createdAt DateTime @default(now())
       updatedAt DateTime @updatedAt

       @@map("${entityPlural.replace(/-/g, '_')}")
     }

     Then run: pnpm db:push
`;
}
