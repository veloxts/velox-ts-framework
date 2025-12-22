/**
 * Model Template
 *
 * Generates Prisma model, Zod schema, and optionally procedures.
 */

import type { FieldDefinition } from '../fields/types.js';
import { FIELD_TYPES } from '../fields/types.js';
import type { GeneratedFile, TemplateContext, TemplateFunction } from '../types.js';

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
  /** Custom field definitions */
  fields?: FieldDefinition[];
}

// ============================================================================
// Prisma Model Template
// ============================================================================

/**
 * Helper: Convert field to Prisma syntax
 */
function fieldToPrisma(field: FieldDefinition): string {
  const typeInfo = FIELD_TYPES.find((t) => t.type === field.type);
  let prismaType = typeInfo?.prismaType ?? 'String';

  // Handle enum type specially
  if (field.type === 'enum' && field.enumDef) {
    prismaType = field.enumDef.name;
  }

  // Build attributes
  const attributes: string[] = [];
  if (field.attributes.unique) attributes.push('@unique');
  if (field.attributes.hasDefault && field.attributes.defaultValue) {
    attributes.push(`@default(${field.attributes.defaultValue})`);
  }

  // Optional fields get ? suffix
  const optional = field.attributes.optional ? '?' : '';
  const attrStr = attributes.length > 0 ? ` ${attributes.join(' ')}` : '';

  return `  ${field.name.padEnd(10)} ${prismaType}${optional}${attrStr}`;
}

/**
 * Helper: Generate Prisma enums
 */
function generatePrismaEnums(fields: FieldDefinition[]): string {
  const enumFields = fields.filter((f) => f.type === 'enum' && f.enumDef);
  if (enumFields.length === 0) return '';

  const enums = enumFields.map((f) => {
    const enumDef = f.enumDef;
    if (!enumDef) return '';
    const values = enumDef.values.map((v) => `  ${v}`).join('\n');
    return `enum ${enumDef.name} {\n${values}\n}`;
  });

  return `\n${enums.join('\n\n')}\n`;
}

/**
 * Generate Prisma model definition
 */
function generatePrismaModel(ctx: TemplateContext<ModelOptions>): string {
  const { entity, options } = ctx;
  const { softDelete, timestamps, fields = [] } = options;

  const baseFields: string[] = ['  id        String   @id @default(uuid())'];

  // Add custom fields or placeholder
  let customFields: string;
  if (fields.length > 0) {
    customFields = `\n${fields.map((f) => fieldToPrisma(f)).join('\n')}`;
  } else {
    customFields = `

  // TODO: Add your ${entity.humanReadable} fields here
  // name      String
  // email     String   @unique`;
  }

  // Add timestamps if enabled
  const timestampFields = timestamps
    ? `
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt`
    : '';

  // Add soft delete if enabled
  const softDeleteField = softDelete
    ? `
  deletedAt DateTime?`
    : '';

  // Generate enum definitions if any
  const enumDefs = fields.length > 0 ? generatePrismaEnums(fields) : '';

  return `/// ${entity.humanReadable} model
/// Add your fields below the id field
${enumDefs}model ${entity.pascal} {
${baseFields.join('\n')}${customFields}${timestampFields}${softDeleteField}

  @@map("${entity.snake}")
}
`;
}

// ============================================================================
// Zod Schema Template
// ============================================================================

/**
 * Helper: Convert field to Zod schema
 */
function fieldToZod(field: FieldDefinition): string {
  const typeInfo = FIELD_TYPES.find((t) => t.type === field.type);
  let zodType: string;

  // Handle enum type specially
  if (field.type === 'enum' && field.enumDef) {
    const values = field.enumDef.values.map((v) => `'${v}'`).join(', ');
    zodType = `z.enum([${values}])`;
  } else {
    zodType = typeInfo?.zodSchema ?? 'z.string()';
  }

  // Optional (nullable)
  if (field.attributes.optional) {
    zodType += '.nullable()';
  }

  return `  ${field.name}: ${zodType},`;
}

/**
 * Helper: Convert field to Zod input schema (for create/update)
 */
function fieldToZodInput(field: FieldDefinition, isUpdate: boolean): string {
  const typeInfo = FIELD_TYPES.find((t) => t.type === field.type);
  let zodType: string;

  // Handle enum type specially
  if (field.type === 'enum' && field.enumDef) {
    const values = field.enumDef.values.map((v) => `'${v}'`).join(', ');
    zodType = `z.enum([${values}])`;
  } else {
    zodType = typeInfo?.zodSchema ?? 'z.string()';
  }

  // For update inputs, make all fields optional
  // For create inputs, respect the field's optional attribute
  if (isUpdate || field.attributes.optional) {
    zodType += '.optional()';
  }

  return `  ${field.name}: ${zodType},`;
}

/**
 * Generate Zod schema file
 */
function generateZodSchema(ctx: TemplateContext<ModelOptions>): string {
  const { entity, options } = ctx;
  const { timestamps, softDelete, fields = [] } = options;

  const schemaFields: string[] = ['  id: z.string().uuid(),'];

  // Add custom fields or placeholder comments
  if (fields.length > 0) {
    schemaFields.push(...fields.map((f) => fieldToZod(f)));
  }

  // Add timestamps if enabled
  if (timestamps) {
    schemaFields.push('  createdAt: z.string().datetime(),');
    schemaFields.push('  updatedAt: z.string().datetime(),');
  }

  // Add soft delete if enabled
  if (softDelete) {
    schemaFields.push('  deletedAt: z.string().datetime().nullable(),');
  }

  // Generate input fields
  const createInputFields: string[] = [];
  const updateInputFields: string[] = [];

  if (fields.length > 0) {
    createInputFields.push(...fields.map((f) => fieldToZodInput(f, false)));
    updateInputFields.push(...fields.map((f) => fieldToZodInput(f, true)));
  }

  const createInputPlaceholder =
    fields.length === 0
      ? `  // TODO: Add required fields for creating a ${entity.humanReadable}
  // name: z.string().min(1).max(100),
  // email: z.string().email(),`
      : '';

  const updateInputPlaceholder =
    fields.length === 0
      ? `  // TODO: Add optional fields for updating a ${entity.humanReadable}
  // name: z.string().min(1).max(100).optional(),
  // email: z.string().email().optional(),`
      : '';

  const responsePlaceholder =
    fields.length === 0
      ? `  // TODO: Add your ${entity.humanReadable} fields here
  // name: z.string().min(1).max(100),
  // email: z.string().email(),
`
      : '';

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
${responsePlaceholder}});

export type ${entity.pascal} = z.infer<typeof ${entity.pascal}Schema>;

// ============================================================================
// Input Schemas
// ============================================================================

/**
 * Create ${entity.pascal} input schema
 */
export const Create${entity.pascal}Input = z.object({
${createInputFields.join('\n')}${createInputPlaceholder}
});

export type Create${entity.pascal}Data = z.infer<typeof Create${entity.pascal}Input>;

/**
 * Update ${entity.pascal} input schema
 */
export const Update${entity.pascal}Input = z.object({
${updateInputFields.join('\n')}${updateInputPlaceholder}
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

  const listInput = options.paginated ? `.input(paginationInputSchema.optional())` : '';

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

  const { fields = [] } = options;

  // Build response fields
  const responseFields = ['id: item.id,'];

  // Add custom fields
  for (const field of fields) {
    if (field.type === 'datetime') {
      responseFields.push(`${field.name}: item.${field.name}.toISOString(),`);
    } else {
      responseFields.push(`${field.name}: item.${field.name},`);
    }
  }

  if (options.timestamps) {
    responseFields.push('createdAt: item.createdAt.toISOString(),');
    responseFields.push('updatedAt: item.updatedAt.toISOString(),');
  }
  if (options.softDelete) {
    responseFields.push('deletedAt: item.deletedAt?.toISOString() ?? null,');
  }

  // Build database interface fields
  const dbInterfaceFields = ['id: string;'];

  // Add custom fields to interface
  for (const field of fields) {
    let tsType = 'string';

    switch (field.type) {
      case 'int':
      case 'float':
        tsType = 'number';
        break;
      case 'boolean':
        tsType = 'boolean';
        break;
      case 'datetime':
        tsType = 'Date';
        break;
      case 'json':
        tsType = 'unknown';
        break;
      case 'enum':
        tsType = field.enumDef?.name ?? 'string';
        break;
      default:
        tsType = 'string';
    }

    const nullable = field.attributes.optional ? ' | null' : '';
    dbInterfaceFields.push(`${field.name}: ${tsType}${nullable};`);
  }

  if (options.timestamps) {
    dbInterfaceFields.push('createdAt: Date;');
    dbInterfaceFields.push('updatedAt: Date;');
  }
  if (options.softDelete) {
    dbInterfaceFields.push('deletedAt: Date | null;');
  }

  // Build placeholder comments
  const dbInterfacePlaceholder = fields.length === 0 ? '// TODO: Add your fields here' : '';
  const responsePlaceholder = fields.length === 0 ? '// TODO: Map your fields here' : '';

  return `/**
 * ${entity.pascal} Procedures
 *
 * CRUD operations for ${entity.humanReadablePlural}.
 */

import { procedure, procedures${paginationImport}, z } from '@veloxts/velox';

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
  ${dbInterfacePlaceholder}
}

// Helper to convert database model to response
function toResponse(item: Db${entity.pascal}) {
  return {
    ${responseFields.join('\n    ')}
    ${responsePlaceholder}
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
