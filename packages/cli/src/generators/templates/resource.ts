/**
 * Resource Template
 *
 * Generates a complete resource with model, schema, procedures, and tests.
 * This is the "full stack" generator for quickly scaffolding new entities.
 */

import type { TemplateContext, GeneratedFile } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface ResourceOptions {
  /** Include CRUD operations */
  crud: boolean;
  /** Include pagination for list operations */
  paginated: boolean;
  /** Include soft delete support */
  softDelete: boolean;
  /** Include timestamp fields */
  timestamps: boolean;
  /** Generate test files */
  withTests: boolean;
  /** Skip Prisma model generation */
  skipModel: boolean;
  /** Skip schema generation */
  skipSchema: boolean;
  /** Skip procedure generation */
  skipProcedure: boolean;
}

// ============================================================================
// Prisma Model Template
// ============================================================================

function generatePrismaModel(
  entity: { pascal: string; camel: string },
  options: ResourceOptions
): string {
  const { pascal, camel } = entity;
  const { softDelete, timestamps } = options;

  const timestampFields = timestamps
    ? `
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt`
    : '';

  const softDeleteField = softDelete
    ? `
  deletedAt DateTime?`
    : '';

  return `// Add this model to your prisma/schema.prisma file

model ${pascal} {
  id String @id @default(uuid())

  // TODO: Add your fields here
  // name   String
  // email  String  @unique
  // status Status  @default(ACTIVE)
${timestampFields}${softDeleteField}

  // Relations
  // posts Post[]

  @@map("${camel}s")
}

// Optional: Add enum if needed
// enum Status {
//   ACTIVE
//   INACTIVE
//   PENDING
// }
`;
}

// ============================================================================
// Zod Schema Template
// ============================================================================

function generateZodSchema(
  entity: { pascal: string; camel: string },
  options: ResourceOptions
): string {
  const { pascal, camel } = entity;
  const { softDelete, timestamps, crud } = options;

  const timestampFields = timestamps
    ? `
  createdAt: z.date(),
  updatedAt: z.date(),`
    : '';

  const softDeleteField = softDelete
    ? `
  deletedAt: z.date().nullable(),`
    : '';

  // Fields to omit for create/update
  const omitFields = ['id'];
  if (timestamps) omitFields.push('createdAt', 'updatedAt');
  if (softDelete) omitFields.push('deletedAt');

  const crudSchemas = crud
    ? `

// ============================================================================
// Input Schemas
// ============================================================================

/**
 * Create${pascal}Input - For creating new ${camel}s
 */
export const create${pascal}InputSchema = ${camel}Schema.omit({
  ${omitFields.map((f) => `${f}: true`).join(',\n  ')},
});

export type Create${pascal}Input = z.infer<typeof create${pascal}InputSchema>;

/**
 * Update${pascal}Input - For full updates (PUT)
 */
export const update${pascal}InputSchema = ${camel}Schema.omit({
  ${omitFields.map((f) => `${f}: true`).join(',\n  ')},
});

export type Update${pascal}Input = z.infer<typeof update${pascal}InputSchema>;

/**
 * Patch${pascal}Input - For partial updates (PATCH)
 */
export const patch${pascal}InputSchema = update${pascal}InputSchema.partial();

export type Patch${pascal}Input = z.infer<typeof patch${pascal}InputSchema>;

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * ${pascal}IdParam - ID parameter validation
 */
export const ${camel}IdParamSchema = z.object({
  id: z.string().uuid(),
});

export type ${pascal}IdParam = z.infer<typeof ${camel}IdParamSchema>;

/**
 * ${pascal}ListQuery - List/search parameters
 */
export const ${camel}ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

export type ${pascal}ListQuery = z.infer<typeof ${camel}ListQuerySchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * ${pascal}ListResponse - Paginated response
 */
export const ${camel}ListResponseSchema = z.object({
  data: z.array(${camel}Schema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
});

export type ${pascal}ListResponse = z.infer<typeof ${camel}ListResponseSchema>;`
    : '';

  return `/**
 * ${pascal} Schema
 *
 * Zod validation schemas for ${pascal} entity.
 */

import { z } from 'zod';

// ============================================================================
// Base Schema
// ============================================================================

/**
 * ${pascal} - Full entity schema
 */
export const ${camel}Schema = z.object({
  id: z.string().uuid(),
  // TODO: Add your fields here
  // name: z.string().min(1).max(255),
  // email: z.string().email(),
  // status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']),${timestampFields}${softDeleteField}
});

export type ${pascal} = z.infer<typeof ${camel}Schema>;
${crudSchemas}
`;
}

// ============================================================================
// Procedure Template
// ============================================================================

function generateProcedure(
  entity: { pascal: string; camel: string; kebab: string },
  options: ResourceOptions
): string {
  const { pascal, camel, kebab } = entity;
  const { crud, paginated, softDelete } = options;

  if (!crud) {
    // Simple procedure without CRUD
    return `/**
 * ${pascal} Procedures
 *
 * API procedures for ${pascal} operations.
 */

import { procedure, defineProcedures } from '@veloxts/router';
import { ${camel}Schema, ${camel}IdParamSchema } from '../schemas/${kebab}.schema.js';

export const ${camel}Procedures = defineProcedures('${kebab}s', {
  /**
   * Get a single ${camel} by ID
   * GET /api/${kebab}s/:id
   */
  get${pascal}: procedure
    .input(${camel}IdParamSchema)
    .output(${camel}Schema.nullable())
    .query(async ({ input, ctx }) => {
      return ctx.db.${camel}.findUnique({
        where: { id: input.id },
      });
    }),
});
`;
  }

  // CRUD procedures
  const softDeleteWhere = softDelete ? ', deletedAt: null' : '';
  const paginationCode = paginated
    ? `
      const total = await ctx.db.${camel}.count({ where: { ${softDelete ? 'deletedAt: null' : ''} } });
      const totalPages = Math.ceil(total / input.limit);

      return {
        data: ${camel}s,
        meta: {
          total,
          page: input.page,
          limit: input.limit,
          totalPages,
        },
      };`
    : `
      return ${camel}s;`;

  const listOutput = paginated
    ? `${camel}ListResponseSchema`
    : `z.array(${camel}Schema)`;

  const deleteOperation = softDelete
    ? `// Soft delete
      return ctx.db.${camel}.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });`
    : `return ctx.db.${camel}.delete({
        where: { id: input.id },
      });`;

  return `/**
 * ${pascal} Procedures
 *
 * CRUD procedures for ${pascal} entity.
 */

import { z } from 'zod';
import { procedure, defineProcedures } from '@veloxts/router';
import {
  ${camel}Schema,
  ${camel}IdParamSchema,
  ${camel}ListQuerySchema,
  ${paginated ? `${camel}ListResponseSchema,\n  ` : ''}create${pascal}InputSchema,
  update${pascal}InputSchema,
  patch${pascal}InputSchema,
} from '../schemas/${kebab}.schema.js';

export const ${camel}Procedures = defineProcedures('${kebab}s', {
  /**
   * Get a single ${camel} by ID
   * GET /api/${kebab}s/:id
   */
  get${pascal}: procedure
    .input(${camel}IdParamSchema)
    .output(${camel}Schema.nullable())
    .query(async ({ input, ctx }) => {
      return ctx.db.${camel}.findUnique({
        where: { id: input.id${softDeleteWhere} },
      });
    }),

  /**
   * List all ${camel}s with pagination
   * GET /api/${kebab}s
   */
  list${pascal}s: procedure
    .input(${camel}ListQuerySchema)
    .output(${listOutput})
    .query(async ({ input, ctx }) => {
      const ${camel}s = await ctx.db.${camel}.findMany({
        where: { ${softDelete ? 'deletedAt: null' : ''} },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: input.sortBy
          ? { [input.sortBy]: input.sortOrder }
          : { createdAt: 'desc' },
      });
${paginationCode}
    }),

  /**
   * Create a new ${camel}
   * POST /api/${kebab}s
   */
  create${pascal}: procedure
    .input(create${pascal}InputSchema)
    .output(${camel}Schema)
    .mutation(async ({ input, ctx }) => {
      return ctx.db.${camel}.create({
        data: input,
      });
    }),

  /**
   * Update a ${camel} (full replacement)
   * PUT /api/${kebab}s/:id
   */
  update${pascal}: procedure
    .input(${camel}IdParamSchema.merge(update${pascal}InputSchema))
    .output(${camel}Schema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.db.${camel}.update({
        where: { id },
        data,
      });
    }),

  /**
   * Patch a ${camel} (partial update)
   * PATCH /api/${kebab}s/:id
   */
  patch${pascal}: procedure
    .input(${camel}IdParamSchema.merge(patch${pascal}InputSchema))
    .output(${camel}Schema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.db.${camel}.update({
        where: { id },
        data,
      });
    }),

  /**
   * Delete a ${camel}
   * DELETE /api/${kebab}s/:id
   */
  delete${pascal}: procedure
    .input(${camel}IdParamSchema)
    .output(${camel}Schema)
    .mutation(async ({ input, ctx }) => {
      ${deleteOperation}
    }),
});
`;
}

// ============================================================================
// Test Template
// ============================================================================

function generateTest(
  entity: { pascal: string; camel: string; kebab: string },
  options: ResourceOptions
): string {
  const { pascal, camel, kebab } = entity;
  const { crud } = options;

  if (!crud) {
    return `/**
 * ${pascal} Procedures - Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// import { ${camel}Procedures } from '../procedures/${kebab}.js';

describe('${pascal} Procedures', () => {
  const mockCtx = {
    db: {
      ${camel}: {
        findUnique: vi.fn(),
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get${pascal}', () => {
    it('should return a ${camel} by id', async () => {
      const mock${pascal} = { id: 'test-uuid' };
      mockCtx.db.${camel}.findUnique.mockResolvedValue(mock${pascal});

      // TODO: Implement test
    });
  });
});
`;
  }

  return `/**
 * ${pascal} Procedures - Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// import { ${camel}Procedures } from '../procedures/${kebab}.js';

describe('${pascal} Procedures', () => {
  const mockCtx = {
    db: {
      ${camel}: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get${pascal}', () => {
    it('should return a ${camel} by id', async () => {
      const mock${pascal} = { id: 'test-uuid', createdAt: new Date(), updatedAt: new Date() };
      mockCtx.db.${camel}.findUnique.mockResolvedValue(mock${pascal});

      // TODO: Call procedure and assert
    });

    it('should return null for non-existent ${camel}', async () => {
      mockCtx.db.${camel}.findUnique.mockResolvedValue(null);

      // TODO: Call procedure and assert
    });
  });

  describe('list${pascal}s', () => {
    it('should return paginated ${camel}s', async () => {
      const mock${pascal}s = [
        { id: 'uuid-1', createdAt: new Date(), updatedAt: new Date() },
        { id: 'uuid-2', createdAt: new Date(), updatedAt: new Date() },
      ];
      mockCtx.db.${camel}.findMany.mockResolvedValue(mock${pascal}s);
      mockCtx.db.${camel}.count.mockResolvedValue(2);

      // TODO: Call procedure and assert
    });
  });

  describe('create${pascal}', () => {
    it('should create a new ${camel}', async () => {
      const input = { /* TODO: Add fields */ };
      const created = { id: 'new-uuid', ...input, createdAt: new Date(), updatedAt: new Date() };
      mockCtx.db.${camel}.create.mockResolvedValue(created);

      // TODO: Call procedure and assert
    });
  });

  describe('update${pascal}', () => {
    it('should update an existing ${camel}', async () => {
      const updated = { id: 'test-uuid', createdAt: new Date(), updatedAt: new Date() };
      mockCtx.db.${camel}.update.mockResolvedValue(updated);

      // TODO: Call procedure and assert
    });
  });

  describe('delete${pascal}', () => {
    it('should delete a ${camel}', async () => {
      mockCtx.db.${camel}.delete.mockResolvedValue({ id: 'test-uuid' });

      // TODO: Call procedure and assert
    });
  });
});
`;
}

// ============================================================================
// Template Export
// ============================================================================

/**
 * Generate all files for a resource
 */
export function generateResourceFiles(ctx: TemplateContext<ResourceOptions>): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const { entity, options } = ctx;

  // Prisma model (added to models folder for reference)
  if (!options.skipModel) {
    files.push({
      path: `src/models/${entity.kebab}.prisma`,
      content: generatePrismaModel(entity, options),
    });
  }

  // Zod schema
  if (!options.skipSchema) {
    files.push({
      path: `src/schemas/${entity.kebab}.schema.ts`,
      content: generateZodSchema(entity, options),
    });
  }

  // Procedures
  if (!options.skipProcedure) {
    files.push({
      path: `src/procedures/${entity.kebab}.ts`,
      content: generateProcedure(entity, options),
    });
  }

  // Tests
  if (options.withTests && !options.skipProcedure) {
    files.push({
      path: `src/procedures/__tests__/${entity.kebab}.test.ts`,
      content: generateTest(entity, options),
    });
  }

  return files;
}

/**
 * Generate post-generation instructions
 */
export function getResourceInstructions(
  entityName: string,
  options: ResourceOptions
): string {
  const steps: string[] = [];
  let stepNum = 1;

  if (!options.skipModel) {
    steps.push(`${stepNum}. Add the Prisma model to your schema:

     Copy the contents of src/models/${entityName.toLowerCase()}.prisma
     into your prisma/schema.prisma file.

     Then run:
       npx prisma db push
       # or
       npx prisma migrate dev --name add_${entityName.toLowerCase()}`);
    stepNum++;
  }

  if (!options.skipSchema) {
    steps.push(`${stepNum}. Customize the Zod schema:

     Edit src/schemas/${entityName.toLowerCase()}.schema.ts
     to match your Prisma model fields.`);
    stepNum++;
  }

  if (!options.skipProcedure) {
    steps.push(`${stepNum}. Register the procedures in your router:

     import { ${entityName.charAt(0).toLowerCase() + entityName.slice(1)}Procedures } from './procedures/${entityName.toLowerCase()}.js';

     // Add to your router
     const router = createRouter({
       ${entityName.charAt(0).toLowerCase() + entityName.slice(1)}: ${entityName.charAt(0).toLowerCase() + entityName.slice(1)}Procedures,
     });`);
    stepNum++;
  }

  if (options.withTests) {
    steps.push(`${stepNum}. Run the tests:

     pnpm test src/procedures/__tests__/${entityName.toLowerCase()}.test.ts`);
    stepNum++;
  }

  steps.push(`${stepNum}. Your ${entityName} API is ready:

     GET    /api/${entityName.toLowerCase()}s      - List all
     GET    /api/${entityName.toLowerCase()}s/:id  - Get by ID
     POST   /api/${entityName.toLowerCase()}s      - Create new
     PUT    /api/${entityName.toLowerCase()}s/:id  - Full update
     PATCH  /api/${entityName.toLowerCase()}s/:id  - Partial update
     DELETE /api/${entityName.toLowerCase()}s/:id  - Delete`);

  return '\n  ' + steps.join('\n\n  ');
}
