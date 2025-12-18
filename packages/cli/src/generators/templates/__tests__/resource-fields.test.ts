/**
 * Resource Template Integration Tests
 *
 * Tests for resource generation with custom fields.
 */

import { describe, expect, it } from 'vitest';

import type { FieldDefinition } from '../../fields/types.js';
import type { TemplateContext } from '../../types.js';
import { generateResourceFiles, type ResourceOptions } from '../resource.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestContext(
  entityName: string,
  options: Partial<ResourceOptions> = {},
  fields: FieldDefinition[] = []
): TemplateContext<ResourceOptions> {
  return {
    entity: {
      raw: entityName,
      pascal: entityName.charAt(0).toUpperCase() + entityName.slice(1),
      camel: entityName.charAt(0).toLowerCase() + entityName.slice(1),
      kebab: entityName.toLowerCase(),
      snake: entityName.toLowerCase(),
      screamingSnake: entityName.toUpperCase(),
      singular: entityName.charAt(0).toLowerCase() + entityName.slice(1),
      plural: `${entityName.charAt(0).toLowerCase() + entityName.slice(1)}s`,
      pascalPlural: `${entityName.charAt(0).toUpperCase() + entityName.slice(1)}s`,
      humanReadable: entityName,
      humanReadablePlural: `${entityName}s`,
    },
    project: {
      name: 'test-app',
      hasAuth: false,
      database: 'sqlite',
    },
    options: {
      crud: true,
      paginated: true,
      softDelete: false,
      timestamps: true,
      withTests: false,
      skipModel: false,
      skipSchema: false,
      skipProcedure: false,
      fields,
      ...options,
    },
  };
}

function createTestField(
  name: string,
  type: FieldDefinition['type'],
  attrs: Partial<FieldDefinition['attributes']> = {}
): FieldDefinition {
  return {
    name,
    type,
    attributes: {
      optional: false,
      unique: false,
      hasDefault: false,
      ...attrs,
    },
  };
}

function createEnumField(
  name: string,
  enumName: string,
  values: string[],
  attrs: Partial<FieldDefinition['attributes']> = {}
): FieldDefinition {
  return {
    name,
    type: 'enum',
    attributes: {
      optional: false,
      unique: false,
      hasDefault: false,
      ...attrs,
    },
    enumDef: { name: enumName, values },
  };
}

// ============================================================================
// Prisma Model Generation Tests
// ============================================================================

describe('generateResourceFiles - Prisma model', () => {
  describe('with custom fields', () => {
    it('includes string field in Prisma model', () => {
      const fields = [createTestField('title', 'string')];
      const ctx = createTestContext('Post', {}, fields);
      const files = generateResourceFiles(ctx);

      const prismaFile = files.find((f) => f.path.endsWith('.prisma'));
      expect(prismaFile).toBeDefined();
      expect(prismaFile?.content).toContain('title String');
    });

    it('includes multiple fields in Prisma model', () => {
      const fields = [
        createTestField('title', 'string'),
        createTestField('content', 'text'),
        createTestField('views', 'int'),
      ];
      const ctx = createTestContext('Post', {}, fields);
      const files = generateResourceFiles(ctx);

      const prismaFile = files.find((f) => f.path.endsWith('.prisma'));
      expect(prismaFile?.content).toContain('title String');
      expect(prismaFile?.content).toContain('content String');
      expect(prismaFile?.content).toContain('views Int');
    });

    it('includes optional field modifier', () => {
      const fields = [createTestField('subtitle', 'string', { optional: true })];
      const ctx = createTestContext('Post', {}, fields);
      const files = generateResourceFiles(ctx);

      const prismaFile = files.find((f) => f.path.endsWith('.prisma'));
      expect(prismaFile?.content).toContain('subtitle String?');
    });

    it('includes unique field modifier', () => {
      const fields = [createTestField('slug', 'string', { unique: true })];
      const ctx = createTestContext('Post', {}, fields);
      const files = generateResourceFiles(ctx);

      const prismaFile = files.find((f) => f.path.endsWith('.prisma'));
      expect(prismaFile?.content).toContain('slug String @unique');
    });

    it('includes default value modifier', () => {
      const fields = [
        createTestField('published', 'boolean', { hasDefault: true, defaultValue: 'false' }),
      ];
      const ctx = createTestContext('Post', {}, fields);
      const files = generateResourceFiles(ctx);

      const prismaFile = files.find((f) => f.path.endsWith('.prisma'));
      expect(prismaFile?.content).toContain('published Boolean @default(false)');
    });

    it('generates enum definition', () => {
      const fields = [createEnumField('status', 'PostStatus', ['DRAFT', 'PUBLISHED', 'ARCHIVED'])];
      const ctx = createTestContext('Post', {}, fields);
      const files = generateResourceFiles(ctx);

      const prismaFile = files.find((f) => f.path.endsWith('.prisma'));
      expect(prismaFile?.content).toContain('status PostStatus');
      expect(prismaFile?.content).toContain('enum PostStatus {');
      expect(prismaFile?.content).toContain('DRAFT');
      expect(prismaFile?.content).toContain('PUBLISHED');
      expect(prismaFile?.content).toContain('ARCHIVED');
    });
  });

  describe('without custom fields', () => {
    it('includes TODO placeholder when no fields', () => {
      const ctx = createTestContext('Post', {}, []);
      const files = generateResourceFiles(ctx);

      const prismaFile = files.find((f) => f.path.endsWith('.prisma'));
      expect(prismaFile?.content).toContain('// TODO: Add your fields here');
    });
  });

  describe('with timestamps', () => {
    it('includes createdAt and updatedAt when timestamps enabled', () => {
      const ctx = createTestContext('Post', { timestamps: true }, [
        createTestField('title', 'string'),
      ]);
      const files = generateResourceFiles(ctx);

      const prismaFile = files.find((f) => f.path.endsWith('.prisma'));
      expect(prismaFile?.content).toContain('createdAt DateTime @default(now())');
      expect(prismaFile?.content).toContain('updatedAt DateTime @updatedAt');
    });

    it('excludes timestamps when disabled', () => {
      const ctx = createTestContext('Post', { timestamps: false }, [
        createTestField('title', 'string'),
      ]);
      const files = generateResourceFiles(ctx);

      const prismaFile = files.find((f) => f.path.endsWith('.prisma'));
      expect(prismaFile?.content).not.toContain('createdAt');
      expect(prismaFile?.content).not.toContain('updatedAt');
    });
  });

  describe('with soft delete', () => {
    it('includes deletedAt when soft delete enabled', () => {
      const ctx = createTestContext('Post', { softDelete: true }, [
        createTestField('title', 'string'),
      ]);
      const files = generateResourceFiles(ctx);

      const prismaFile = files.find((f) => f.path.endsWith('.prisma'));
      expect(prismaFile?.content).toContain('deletedAt DateTime?');
    });
  });
});

// ============================================================================
// Zod Schema Generation Tests
// ============================================================================

describe('generateResourceFiles - Zod schema', () => {
  describe('with custom fields', () => {
    it('includes string field in Zod schema', () => {
      const fields = [createTestField('title', 'string')];
      const ctx = createTestContext('Post', {}, fields);
      const files = generateResourceFiles(ctx);

      const schemaFile = files.find((f) => f.path.endsWith('.schema.ts'));
      expect(schemaFile).toBeDefined();
      expect(schemaFile?.content).toContain('title: z.string().min(1).max(255)');
    });

    it('includes multiple fields in Zod schema', () => {
      const fields = [
        createTestField('title', 'string'),
        createTestField('views', 'int'),
        createTestField('rating', 'float'),
      ];
      const ctx = createTestContext('Post', {}, fields);
      const files = generateResourceFiles(ctx);

      const schemaFile = files.find((f) => f.path.endsWith('.schema.ts'));
      expect(schemaFile?.content).toContain('title: z.string()');
      expect(schemaFile?.content).toContain('views: z.number().int()');
      expect(schemaFile?.content).toContain('rating: z.number()');
    });

    it('includes nullable modifier for optional fields', () => {
      const fields = [createTestField('subtitle', 'string', { optional: true })];
      const ctx = createTestContext('Post', {}, fields);
      const files = generateResourceFiles(ctx);

      const schemaFile = files.find((f) => f.path.endsWith('.schema.ts'));
      expect(schemaFile?.content).toContain('.nullable()');
    });

    it('generates enum schema', () => {
      const fields = [createEnumField('status', 'PostStatus', ['DRAFT', 'PUBLISHED'])];
      const ctx = createTestContext('Post', {}, fields);
      const files = generateResourceFiles(ctx);

      const schemaFile = files.find((f) => f.path.endsWith('.schema.ts'));
      expect(schemaFile?.content).toContain("z.enum(['DRAFT', 'PUBLISHED'])");
    });
  });

  describe('without custom fields', () => {
    it('includes TODO placeholder when no fields', () => {
      const ctx = createTestContext('Post', {}, []);
      const files = generateResourceFiles(ctx);

      const schemaFile = files.find((f) => f.path.endsWith('.schema.ts'));
      expect(schemaFile?.content).toContain('// TODO: Add your fields here');
    });
  });
});

// ============================================================================
// File Generation Tests
// ============================================================================

describe('generateResourceFiles - file structure', () => {
  it('generates all expected files by default', () => {
    const ctx = createTestContext('Post', {}, [createTestField('title', 'string')]);
    const files = generateResourceFiles(ctx);

    const paths = files.map((f) => f.path);
    expect(paths).toContain('src/models/post.prisma');
    expect(paths).toContain('src/schemas/post.schema.ts');
    expect(paths).toContain('src/procedures/post.ts');
  });

  it('skips model when skipModel is true', () => {
    const ctx = createTestContext('Post', { skipModel: true }, [
      createTestField('title', 'string'),
    ]);
    const files = generateResourceFiles(ctx);

    const paths = files.map((f) => f.path);
    expect(paths).not.toContain('src/models/post.prisma');
  });

  it('skips schema when skipSchema is true', () => {
    const ctx = createTestContext('Post', { skipSchema: true }, [
      createTestField('title', 'string'),
    ]);
    const files = generateResourceFiles(ctx);

    const paths = files.map((f) => f.path);
    expect(paths).not.toContain('src/schemas/post.schema.ts');
  });

  it('skips procedure when skipProcedure is true', () => {
    const ctx = createTestContext('Post', { skipProcedure: true }, [
      createTestField('title', 'string'),
    ]);
    const files = generateResourceFiles(ctx);

    const paths = files.map((f) => f.path);
    expect(paths).not.toContain('src/procedures/post.ts');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('generateResourceFiles - edge cases', () => {
  it('handles all field types together', () => {
    const fields: FieldDefinition[] = [
      createTestField('title', 'string'),
      createTestField('content', 'text'),
      createTestField('count', 'int'),
      createTestField('price', 'float'),
      createTestField('active', 'boolean'),
      createTestField('publishedAt', 'datetime'),
      createTestField('metadata', 'json'),
      createEnumField('status', 'Status', ['ACTIVE', 'INACTIVE']),
    ];
    const ctx = createTestContext('Item', {}, fields);
    const files = generateResourceFiles(ctx);

    const prismaFile = files.find((f) => f.path.endsWith('.prisma'));
    expect(prismaFile).toBeDefined();

    // All fields should be present
    expect(prismaFile?.content).toContain('title String');
    expect(prismaFile?.content).toContain('content String');
    expect(prismaFile?.content).toContain('count Int');
    expect(prismaFile?.content).toContain('price Float');
    expect(prismaFile?.content).toContain('active Boolean');
    expect(prismaFile?.content).toContain('publishedAt DateTime');
    expect(prismaFile?.content).toContain('metadata Json');
    expect(prismaFile?.content).toContain('status Status');
    expect(prismaFile?.content).toContain('enum Status {');
  });

  it('handles fields with all modifiers', () => {
    const fields = [
      createTestField('email', 'string', { optional: true, unique: true }),
      createTestField('role', 'string', { hasDefault: true, defaultValue: 'user' }),
    ];
    const ctx = createTestContext('User', {}, fields);
    const files = generateResourceFiles(ctx);

    const prismaFile = files.find((f) => f.path.endsWith('.prisma'));
    expect(prismaFile?.content).toContain('email String? @unique');
    expect(prismaFile?.content).toContain('role String @default("user")');
  });

  it('handles multiple enum fields', () => {
    const fields = [
      createEnumField('status', 'Status', ['ACTIVE', 'INACTIVE']),
      createEnumField('role', 'Role', ['ADMIN', 'USER', 'GUEST']),
    ];
    const ctx = createTestContext('User', {}, fields);
    const files = generateResourceFiles(ctx);

    const prismaFile = files.find((f) => f.path.endsWith('.prisma'));
    expect(prismaFile?.content).toContain('enum Status {');
    expect(prismaFile?.content).toContain('enum Role {');
    expect(prismaFile?.content).toContain('status Status');
    expect(prismaFile?.content).toContain('role Role');
  });
});
