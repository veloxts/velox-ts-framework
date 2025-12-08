/**
 * Test Template
 *
 * Generates Vitest test files for VeloxTS applications.
 */

import type { TemplateContext, TemplateFunction, GeneratedFile } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface TestOptions {
  /** Type of test to generate */
  type: 'unit' | 'integration' | 'e2e';
  /** Target being tested (procedure, schema, model, service) */
  target: 'procedure' | 'schema' | 'model' | 'service' | 'generic';
}

// ============================================================================
// Template Functions
// ============================================================================

/**
 * Generate unit test for procedures
 */
function generateProcedureUnitTest(entity: { pascal: string; camel: string; kebab: string }): string {
  const { pascal, camel, kebab } = entity;

  return `/**
 * ${pascal} Procedures - Unit Tests
 *
 * Tests for ${pascal} procedure handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// import { ${camel}Procedures } from '../procedures/${kebab}.js';

describe('${pascal} Procedures', () => {
  // Mock context
  const mockCtx = {
    db: {
      ${camel}: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
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
      const mock${pascal} = {
        id: 'test-uuid-1234',
        // TODO: Add expected fields
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCtx.db.${camel}.findUnique.mockResolvedValue(mock${pascal});

      // TODO: Call the procedure
      // const result = await ${camel}Procedures.get${pascal}({
      //   input: { id: 'test-uuid-1234' },
      //   ctx: mockCtx,
      // });

      // expect(result).toEqual(mock${pascal});
      // expect(mockCtx.db.${camel}.findUnique).toHaveBeenCalledWith({
      //   where: { id: 'test-uuid-1234' },
      // });
    });

    it('should return null for non-existent ${camel}', async () => {
      mockCtx.db.${camel}.findUnique.mockResolvedValue(null);

      // TODO: Test not found case
    });
  });

  describe('list${pascal}s', () => {
    it('should return paginated ${camel}s', async () => {
      const mock${pascal}s = [
        { id: 'uuid-1', createdAt: new Date(), updatedAt: new Date() },
        { id: 'uuid-2', createdAt: new Date(), updatedAt: new Date() },
      ];

      mockCtx.db.${camel}.findMany.mockResolvedValue(mock${pascal}s);

      // TODO: Test list procedure
    });
  });

  describe('create${pascal}', () => {
    it('should create a new ${camel}', async () => {
      const input = {
        // TODO: Add create input fields
      };

      const created${pascal} = {
        id: 'new-uuid',
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCtx.db.${camel}.create.mockResolvedValue(created${pascal});

      // TODO: Test create procedure
    });

    it('should validate required fields', async () => {
      // TODO: Test validation errors
    });
  });

  describe('update${pascal}', () => {
    it('should update an existing ${camel}', async () => {
      const existing${pascal} = {
        id: 'test-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCtx.db.${camel}.findUnique.mockResolvedValue(existing${pascal});
      mockCtx.db.${camel}.update.mockResolvedValue({
        ...existing${pascal},
        // updated fields
      });

      // TODO: Test update procedure
    });
  });

  describe('delete${pascal}', () => {
    it('should delete a ${camel}', async () => {
      mockCtx.db.${camel}.delete.mockResolvedValue({ id: 'test-uuid' });

      // TODO: Test delete procedure
    });
  });
});
`;
}

/**
 * Generate unit test for schemas
 */
function generateSchemaUnitTest(entity: { pascal: string; camel: string; kebab: string }): string {
  const { pascal, camel, kebab } = entity;

  return `/**
 * ${pascal} Schema - Unit Tests
 *
 * Tests for ${pascal} Zod validation schemas.
 */

import { describe, it, expect } from 'vitest';
// import {
//   ${camel}Schema,
//   create${pascal}InputSchema,
//   update${pascal}InputSchema,
//   ${camel}IdParamSchema,
// } from '../schemas/${kebab}.schema.js';

describe('${pascal} Schema', () => {
  describe('${camel}Schema', () => {
    it('should validate a valid ${camel}', () => {
      const valid${pascal} = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        // TODO: Add required fields
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // const result = ${camel}Schema.safeParse(valid${pascal});
      // expect(result.success).toBe(true);
    });

    it('should reject invalid id format', () => {
      const invalid${pascal} = {
        id: 'not-a-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // const result = ${camel}Schema.safeParse(invalid${pascal});
      // expect(result.success).toBe(false);
    });

    it('should require mandatory fields', () => {
      const incomplete${pascal} = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        // Missing required fields
      };

      // const result = ${camel}Schema.safeParse(incomplete${pascal});
      // expect(result.success).toBe(false);
    });
  });

  describe('create${pascal}InputSchema', () => {
    it('should validate create input', () => {
      const validInput = {
        // TODO: Add create input fields
      };

      // const result = create${pascal}InputSchema.safeParse(validInput);
      // expect(result.success).toBe(true);
    });

    it('should omit auto-generated fields', () => {
      const inputWithId = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        createdAt: new Date(),
        // other fields
      };

      // The schema should strip id and timestamps
      // const result = create${pascal}InputSchema.safeParse(inputWithId);
      // expect(result.success).toBe(true);
      // expect(result.data).not.toHaveProperty('id');
    });
  });

  describe('update${pascal}InputSchema', () => {
    it('should validate full update input', () => {
      const validInput = {
        // TODO: Add all updatable fields
      };

      // const result = update${pascal}InputSchema.safeParse(validInput);
      // expect(result.success).toBe(true);
    });
  });

  describe('${camel}IdParamSchema', () => {
    it('should validate valid UUID', () => {
      const validParam = { id: '550e8400-e29b-41d4-a716-446655440000' };

      // const result = ${camel}IdParamSchema.safeParse(validParam);
      // expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const invalidParam = { id: 'invalid' };

      // const result = ${camel}IdParamSchema.safeParse(invalidParam);
      // expect(result.success).toBe(false);
    });
  });
});
`;
}

/**
 * Generate integration test
 */
function generateIntegrationTest(entity: { pascal: string; camel: string; kebab: string }): string {
  const { pascal, camel, kebab } = entity;

  return `/**
 * ${pascal} - Integration Tests
 *
 * Tests ${pascal} procedures with actual database interactions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
// import { createTestApp, cleanupTestApp } from '../test/setup.js';
// import type { TestApp } from '../test/setup.js';

describe('${pascal} Integration', () => {
  // let app: TestApp;

  beforeAll(async () => {
    // app = await createTestApp();
  });

  afterAll(async () => {
    // await cleanupTestApp(app);
  });

  beforeEach(async () => {
    // Clean up test data before each test
    // await app.db.${camel}.deleteMany();
  });

  describe('CRUD Operations', () => {
    it('should create and retrieve a ${camel}', async () => {
      // const created = await app.procedures.${camel}.create${pascal}({
      //   // input fields
      // });

      // expect(created.id).toBeDefined();

      // const retrieved = await app.procedures.${camel}.get${pascal}({
      //   id: created.id,
      // });

      // expect(retrieved).toEqual(created);
    });

    it('should update a ${camel}', async () => {
      // const created = await app.procedures.${camel}.create${pascal}({
      //   // input fields
      // });

      // const updated = await app.procedures.${camel}.update${pascal}({
      //   id: created.id,
      //   // updated fields
      // });

      // expect(updated.id).toBe(created.id);
      // expect(updated.updatedAt).not.toBe(created.updatedAt);
    });

    it('should delete a ${camel}', async () => {
      // const created = await app.procedures.${camel}.create${pascal}({
      //   // input fields
      // });

      // await app.procedures.${camel}.delete${pascal}({
      //   id: created.id,
      // });

      // const deleted = await app.procedures.${camel}.get${pascal}({
      //   id: created.id,
      // });

      // expect(deleted).toBeNull();
    });

    it('should list ${camel}s with pagination', async () => {
      // Create multiple ${camel}s
      // for (let i = 0; i < 5; i++) {
      //   await app.procedures.${camel}.create${pascal}({
      //     // input fields
      //   });
      // }

      // const page1 = await app.procedures.${camel}.list${pascal}s({
      //   page: 1,
      //   limit: 2,
      // });

      // expect(page1.data).toHaveLength(2);
      // expect(page1.meta.total).toBe(5);
      // expect(page1.meta.totalPages).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle not found errors', async () => {
      // const result = await app.procedures.${camel}.get${pascal}({
      //   id: 'non-existent-uuid',
      // });

      // expect(result).toBeNull();
    });

    it('should handle validation errors', async () => {
      // await expect(
      //   app.procedures.${camel}.create${pascal}({
      //     // invalid input
      //   })
      // ).rejects.toThrow();
    });
  });
});
`;
}

/**
 * Generate E2E test
 */
function generateE2ETest(entity: { pascal: string; camel: string; kebab: string }): string {
  const { pascal, camel, kebab } = entity;

  return `/**
 * ${pascal} - E2E Tests
 *
 * End-to-end tests for ${pascal} REST API endpoints.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
// import { createTestServer, cleanupTestServer } from '../test/e2e-setup.js';
// import type { TestServer } from '../test/e2e-setup.js';

describe('${pascal} API E2E', () => {
  // let server: TestServer;
  const baseUrl = 'http://localhost:3000/api';

  beforeAll(async () => {
    // server = await createTestServer();
  });

  afterAll(async () => {
    // await cleanupTestServer(server);
  });

  beforeEach(async () => {
    // Clean up test data
    // await server.db.${camel}.deleteMany();
  });

  describe('GET /api/${kebab}s', () => {
    it('should return a list of ${camel}s', async () => {
      // const response = await fetch(\`\${baseUrl}/${kebab}s\`);
      // const data = await response.json();

      // expect(response.status).toBe(200);
      // expect(data).toHaveProperty('data');
      // expect(data).toHaveProperty('meta');
    });

    it('should support pagination', async () => {
      // const response = await fetch(\`\${baseUrl}/${kebab}s?page=1&limit=10\`);
      // const data = await response.json();

      // expect(response.status).toBe(200);
      // expect(data.meta.page).toBe(1);
      // expect(data.meta.limit).toBe(10);
    });
  });

  describe('GET /api/${kebab}s/:id', () => {
    it('should return a single ${camel}', async () => {
      // First create a ${camel}
      // const createResponse = await fetch(\`\${baseUrl}/${kebab}s\`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ /* fields */ }),
      // });
      // const created = await createResponse.json();

      // const response = await fetch(\`\${baseUrl}/${kebab}s/\${created.id}\`);
      // const data = await response.json();

      // expect(response.status).toBe(200);
      // expect(data.id).toBe(created.id);
    });

    it('should return 404 for non-existent ${camel}', async () => {
      // const response = await fetch(\`\${baseUrl}/${kebab}s/non-existent-id\`);

      // expect(response.status).toBe(404);
    });
  });

  describe('POST /api/${kebab}s', () => {
    it('should create a new ${camel}', async () => {
      // const payload = {
      //   // TODO: Add required fields
      // };

      // const response = await fetch(\`\${baseUrl}/${kebab}s\`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload),
      // });
      // const data = await response.json();

      // expect(response.status).toBe(201);
      // expect(data.id).toBeDefined();
    });

    it('should return 400 for invalid input', async () => {
      // const response = await fetch(\`\${baseUrl}/${kebab}s\`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({}),
      // });

      // expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/${kebab}s/:id', () => {
    it('should update a ${camel}', async () => {
      // Create first
      // const createResponse = await fetch(\`\${baseUrl}/${kebab}s\`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ /* fields */ }),
      // });
      // const created = await createResponse.json();

      // Update
      // const response = await fetch(\`\${baseUrl}/${kebab}s/\${created.id}\`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ /* updated fields */ }),
      // });
      // const data = await response.json();

      // expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/${kebab}s/:id', () => {
    it('should delete a ${camel}', async () => {
      // Create first
      // const createResponse = await fetch(\`\${baseUrl}/${kebab}s\`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ /* fields */ }),
      // });
      // const created = await createResponse.json();

      // Delete
      // const response = await fetch(\`\${baseUrl}/${kebab}s/\${created.id}\`, {
      //   method: 'DELETE',
      // });

      // expect(response.status).toBe(200);

      // Verify deleted
      // const getResponse = await fetch(\`\${baseUrl}/${kebab}s/\${created.id}\`);
      // expect(getResponse.status).toBe(404);
    });
  });
});
`;
}

/**
 * Generate generic unit test
 */
function generateGenericUnitTest(entity: { pascal: string; camel: string; kebab: string }): string {
  const { pascal, camel, kebab } = entity;

  return `/**
 * ${pascal} - Unit Tests
 *
 * Tests for ${pascal} module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// import { ${camel} } from '../${kebab}.js';

describe('${pascal}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize correctly', () => {
      // TODO: Test initialization
      expect(true).toBe(true);
    });
  });

  describe('core functionality', () => {
    it('should perform main operation', () => {
      // TODO: Test main functionality
    });

    it('should handle edge cases', () => {
      // TODO: Test edge cases
    });
  });

  describe('error handling', () => {
    it('should handle invalid input', () => {
      // TODO: Test error scenarios
    });

    it('should throw on failure', () => {
      // TODO: Test error throwing
    });
  });
});
`;
}

/**
 * Generate service unit test
 */
function generateServiceUnitTest(entity: { pascal: string; camel: string; kebab: string }): string {
  const { pascal, camel, kebab } = entity;

  return `/**
 * ${pascal}Service - Unit Tests
 *
 * Tests for ${pascal}Service business logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// import { ${pascal}Service } from '../services/${kebab}.service.js';

describe('${pascal}Service', () => {
  // let service: ${pascal}Service;
  // let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // mockDb = {
    //   ${camel}: {
    //     findUnique: vi.fn(),
    //     findMany: vi.fn(),
    //     create: vi.fn(),
    //     update: vi.fn(),
    //     delete: vi.fn(),
    //   },
    // };

    // service = new ${pascal}Service(mockDb);
  });

  describe('findById', () => {
    it('should find ${camel} by id', async () => {
      // const mock${pascal} = { id: 'test-id', name: 'Test' };
      // mockDb.${camel}.findUnique.mockResolvedValue(mock${pascal});

      // const result = await service.findById('test-id');

      // expect(result).toEqual(mock${pascal});
      // expect(mockDb.${camel}.findUnique).toHaveBeenCalledWith({
      //   where: { id: 'test-id' },
      // });
    });

    it('should return null when not found', async () => {
      // mockDb.${camel}.findUnique.mockResolvedValue(null);

      // const result = await service.findById('non-existent');

      // expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new ${camel}', async () => {
      // const input = { name: 'New ${pascal}' };
      // const created = { id: 'new-id', ...input };
      // mockDb.${camel}.create.mockResolvedValue(created);

      // const result = await service.create(input);

      // expect(result).toEqual(created);
    });

    it('should validate input before creation', async () => {
      // TODO: Test validation
    });
  });

  describe('update', () => {
    it('should update an existing ${camel}', async () => {
      // const existing = { id: 'test-id', name: 'Old' };
      // const updated = { ...existing, name: 'New' };
      // mockDb.${camel}.findUnique.mockResolvedValue(existing);
      // mockDb.${camel}.update.mockResolvedValue(updated);

      // const result = await service.update('test-id', { name: 'New' });

      // expect(result.name).toBe('New');
    });
  });

  describe('delete', () => {
    it('should delete a ${camel}', async () => {
      // mockDb.${camel}.delete.mockResolvedValue({ id: 'test-id' });

      // await service.delete('test-id');

      // expect(mockDb.${camel}.delete).toHaveBeenCalledWith({
      //   where: { id: 'test-id' },
      // });
    });
  });

  describe('business logic', () => {
    it('should apply business rules', async () => {
      // TODO: Test specific business logic
    });
  });
});
`;
}

/**
 * Generate model unit test
 */
function generateModelUnitTest(entity: { pascal: string; camel: string; kebab: string }): string {
  const { pascal, camel, kebab } = entity;

  return `/**
 * ${pascal} Model - Unit Tests
 *
 * Tests for ${pascal} Prisma model operations.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
// import { PrismaClient } from '@prisma/client';
// import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';

describe('${pascal} Model', () => {
  // let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    // mockReset(prisma);
  });

  describe('findUnique', () => {
    it('should find ${camel} by id', async () => {
      // const mock${pascal} = {
      //   id: 'test-uuid',
      //   createdAt: new Date(),
      //   updatedAt: new Date(),
      // };

      // prisma.${camel}.findUnique.mockResolvedValue(mock${pascal});

      // const result = await prisma.${camel}.findUnique({
      //   where: { id: 'test-uuid' },
      // });

      // expect(result).toEqual(mock${pascal});
    });
  });

  describe('findMany', () => {
    it('should find all ${camel}s', async () => {
      // const mock${pascal}s = [
      //   { id: 'uuid-1', createdAt: new Date(), updatedAt: new Date() },
      //   { id: 'uuid-2', createdAt: new Date(), updatedAt: new Date() },
      // ];

      // prisma.${camel}.findMany.mockResolvedValue(mock${pascal}s);

      // const result = await prisma.${camel}.findMany();

      // expect(result).toHaveLength(2);
    });

    it('should filter ${camel}s', async () => {
      // prisma.${camel}.findMany.mockResolvedValue([]);

      // const result = await prisma.${camel}.findMany({
      //   where: { /* filter */ },
      // });

      // expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create a ${camel}', async () => {
      // const input = {
      //   // TODO: Add fields
      // };

      // const created = {
      //   id: 'new-uuid',
      //   ...input,
      //   createdAt: new Date(),
      //   updatedAt: new Date(),
      // };

      // prisma.${camel}.create.mockResolvedValue(created);

      // const result = await prisma.${camel}.create({ data: input });

      // expect(result.id).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update a ${camel}', async () => {
      // const updated = {
      //   id: 'test-uuid',
      //   // updated fields
      //   createdAt: new Date(),
      //   updatedAt: new Date(),
      // };

      // prisma.${camel}.update.mockResolvedValue(updated);

      // const result = await prisma.${camel}.update({
      //   where: { id: 'test-uuid' },
      //   data: { /* updates */ },
      // });

      // expect(result).toEqual(updated);
    });
  });

  describe('delete', () => {
    it('should delete a ${camel}', async () => {
      // const deleted = { id: 'test-uuid' };

      // prisma.${camel}.delete.mockResolvedValue(deleted);

      // const result = await prisma.${camel}.delete({
      //   where: { id: 'test-uuid' },
      // });

      // expect(result.id).toBe('test-uuid');
    });
  });
});
`;
}

// ============================================================================
// Template Export
// ============================================================================

/**
 * Test template function
 */
export const testTemplate: TemplateFunction<TestOptions> = (ctx) => {
  const { type, target } = ctx.options;

  // E2E tests
  if (type === 'e2e') {
    return generateE2ETest(ctx.entity);
  }

  // Integration tests
  if (type === 'integration') {
    return generateIntegrationTest(ctx.entity);
  }

  // Unit tests by target
  switch (target) {
    case 'procedure':
      return generateProcedureUnitTest(ctx.entity);
    case 'schema':
      return generateSchemaUnitTest(ctx.entity);
    case 'model':
      return generateModelUnitTest(ctx.entity);
    case 'service':
      return generateServiceUnitTest(ctx.entity);
    case 'generic':
    default:
      return generateGenericUnitTest(ctx.entity);
  }
};

/**
 * Get output path for test file
 */
export function getTestPath(
  entity: { kebab: string },
  options: TestOptions
): string {
  const { type, target } = options;

  const suffix = type === 'e2e' ? 'e2e' : type === 'integration' ? 'integration' : 'test';

  // Determine directory based on test type
  if (type === 'e2e') {
    return `tests/e2e/${entity.kebab}.${suffix}.ts`;
  }

  if (type === 'integration') {
    return `tests/integration/${entity.kebab}.${suffix}.ts`;
  }

  // Unit tests go alongside the source or in __tests__
  switch (target) {
    case 'procedure':
      return `src/procedures/__tests__/${entity.kebab}.${suffix}.ts`;
    case 'schema':
      return `src/schemas/__tests__/${entity.kebab}.${suffix}.ts`;
    case 'model':
      return `src/models/__tests__/${entity.kebab}.${suffix}.ts`;
    case 'service':
      return `src/services/__tests__/${entity.kebab}.${suffix}.ts`;
    default:
      return `src/__tests__/${entity.kebab}.${suffix}.ts`;
  }
}

/**
 * Generate all files for a test
 */
export function generateTestFiles(ctx: TemplateContext<TestOptions>): GeneratedFile[] {
  const content = testTemplate(ctx);

  return [
    {
      path: getTestPath(ctx.entity, ctx.options),
      content,
    },
  ];
}

/**
 * Generate post-generation instructions
 */
export function getTestInstructions(entityName: string, options: TestOptions): string {
  const { type, target } = options;

  const runCommand = type === 'e2e'
    ? 'pnpm test:e2e'
    : type === 'integration'
    ? 'pnpm test:integration'
    : 'pnpm test';

  return `
  1. Uncomment and customize the test cases in the generated file.

  2. Run the tests:

     ${runCommand}

     Or run specific test file:
       pnpm vitest ${getTestPath({ kebab: entityName.toLowerCase() }, options)}

  3. Test types:
     - Unit tests: Fast, isolated, mock dependencies
     - Integration tests: Test with real database
     - E2E tests: Full HTTP request/response cycle

  Tip: Start with unit tests, add integration tests for critical paths,
       and E2E tests for user-facing workflows.
`;
}
