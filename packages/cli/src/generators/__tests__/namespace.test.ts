/**
 * Namespace Generator - Unit Tests
 *
 * Tests for namespace template generation (procedure + schema files).
 */

import { describe, expect, it } from 'vitest';

import type { FieldDefinition } from '../fields/types.js';
import { createNamespaceGenerator } from '../generators/namespace.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('NamespaceGenerator', () => {
  const generator = createNamespaceGenerator();

  // Mock project context
  const mockProject: ProjectContext = {
    hasVeloxConfig: true,
    hasPrisma: true,
    hasTsConfig: true,
    srcDir: 'src',
    isMonorepo: false,
  };

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(generator.metadata.name).toBe('namespace');
    });

    it('should have ns alias', () => {
      expect(generator.metadata.aliases).toContain('ns');
    });

    it('should be in resource category', () => {
      expect(generator.metadata.category).toBe('resource');
    });

    it('should have helpful description mentioning existing models', () => {
      expect(generator.metadata.description).toContain('existing');
    });

    it('should have longDescription with usage guidance', () => {
      expect(generator.metadata.longDescription).toContain('When to use');
      expect(generator.metadata.longDescription).toContain('When NOT to use');
      expect(generator.metadata.longDescription).toContain('resource');
    });
  });

  describe('validateEntityName', () => {
    it('should accept valid names', () => {
      expect(generator.validateEntityName('product')).toBeUndefined();
      expect(generator.validateEntityName('Product')).toBeUndefined();
      expect(generator.validateEntityName('order-item')).toBeUndefined();
      expect(generator.validateEntityName('order_item')).toBeUndefined();
    });

    it('should reject names starting with numbers', () => {
      expect(generator.validateEntityName('123product')).not.toBeNull();
    });

    it('should reject names with special characters', () => {
      expect(generator.validateEntityName('product@item')).not.toBeNull();
      expect(generator.validateEntityName('product.item')).not.toBeNull();
    });

    it('should reject empty names', () => {
      expect(generator.validateEntityName('')).not.toBeNull();
    });
  });

  describe('validateOptions', () => {
    it('should return defaults for empty options', () => {
      const options = generator.validateOptions({});

      expect(options.withExample).toBe(false);
      expect(options.withTests).toBe(true); // Tests enabled by default
      expect(options.skipRegistration).toBe(false);
    });

    it('should accept example option', () => {
      const options = generator.validateOptions({ example: true });

      expect(options.withExample).toBe(true);
    });

    it('should accept with-tests option', () => {
      const options = generator.validateOptions({ 'with-tests': false });

      expect(options.withTests).toBe(false);
    });

    it('should accept skip-registration option', () => {
      const options = generator.validateOptions({ 'skip-registration': true });

      expect(options.skipRegistration).toBe(true);
    });

    it('should coerce string to boolean', () => {
      const options = generator.validateOptions({ example: 'true' });

      expect(options.withExample).toBe(true);
    });
  });

  describe('generate', () => {
    it('should generate schema, procedure, and test files by default', async () => {
      const config: GeneratorConfig = {
        entityName: 'product',
        options: { withExample: false, withTests: true, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(3);

      // Should have schema file
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));
      expect(schemaFile).toBeDefined();
      expect(schemaFile?.path).toBe('src/schemas/product.ts');

      // Should have procedure file
      const procedureFile = output.files.find(
        (f) => f.path.includes('procedures') && !f.path.includes('__tests__')
      );
      expect(procedureFile).toBeDefined();
      expect(procedureFile?.path).toBe('src/procedures/products.ts');

      // Should have test file
      const testFile = output.files.find((f) => f.path.includes('__tests__'));
      expect(testFile).toBeDefined();
      expect(testFile?.path).toBe('src/procedures/__tests__/products.test.ts');
    });

    it('should skip test file when withTests is false', async () => {
      const config: GeneratorConfig = {
        entityName: 'product',
        options: { withExample: false, withTests: false, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(2);

      // Should NOT have test file
      const testFile = output.files.find((f) => f.path.includes('__tests__'));
      expect(testFile).toBeUndefined();
    });

    it('should generate empty namespace without --example', async () => {
      const config: GeneratorConfig = {
        entityName: 'order',
        options: { withExample: false, withTests: true, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const procedureFile = output.files.find(
        (f) => f.path.includes('procedures') && !f.path.includes('__tests__')
      );

      expect(procedureFile?.content).toContain('// Add your procedures here');
      expect(procedureFile?.content).toContain('// Examples:');
      // Examples are commented out (prefixed with //)
      expect(procedureFile?.content).toContain('//     return ctx.db.order.findUnique');
      // Should NOT have uncommented CRUD implementations like the --example version
      expect(procedureFile?.content).not.toMatch(/^\s+getOrder:\s+procedure\(\)/m);
    });

    it('should generate CRUD examples with --example', async () => {
      const config: GeneratorConfig = {
        entityName: 'order',
        options: { withExample: true, withTests: true, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const procedureFile = output.files.find(
        (f) => f.path.includes('procedures') && !f.path.includes('__tests__')
      );

      // Should have CRUD operations
      expect(procedureFile?.content).toContain('getOrder');
      expect(procedureFile?.content).toContain('listOrders');
      expect(procedureFile?.content).toContain('createOrder');
      expect(procedureFile?.content).toContain('updateOrder');
      expect(procedureFile?.content).toContain('deleteOrder');
      // Should have actual implementations
      expect(procedureFile?.content).toContain('ctx.db.order.findUnique');
    });

    it('should generate test file with minimal scaffold when withExample is false', async () => {
      const config: GeneratorConfig = {
        entityName: 'report',
        options: { withExample: false, withTests: true, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const testFile = output.files.find((f) => f.path.includes('__tests__'));

      expect(testFile).toBeDefined();
      expect(testFile?.content).toContain("describe('Report Procedures'");
      expect(testFile?.content).toContain('mockCtx');
      expect(testFile?.content).toContain('vi.clearAllMocks');
      expect(testFile?.content).toContain('// Add your tests here');
    });

    it('should generate test file with CRUD tests when withExample is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'invoice',
        options: { withExample: true, withTests: true, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const testFile = output.files.find((f) => f.path.includes('__tests__'));

      expect(testFile).toBeDefined();
      expect(testFile?.content).toContain("describe('Invoice Procedures'");
      expect(testFile?.content).toContain("describe('getInvoice'");
      expect(testFile?.content).toContain("describe('listInvoices'");
      expect(testFile?.content).toContain("describe('createInvoice'");
      expect(testFile?.content).toContain("describe('updateInvoice'");
      expect(testFile?.content).toContain("describe('deleteInvoice'");
    });

    it('should generate schema with base and input schemas', async () => {
      const config: GeneratorConfig = {
        entityName: 'category',
        options: { withExample: false, withTests: true, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      // Base schema
      expect(schemaFile?.content).toContain('CategorySchema');
      expect(schemaFile?.content).toContain('type Category = z.infer');

      // Input schemas
      expect(schemaFile?.content).toContain('CreateCategoryInput');
      expect(schemaFile?.content).toContain('UpdateCategoryInput');
    });

    it('should import schema in procedure file', async () => {
      const config: GeneratorConfig = {
        entityName: 'tag',
        options: { withExample: true, withTests: true, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const procedureFile = output.files.find(
        (f) => f.path.includes('procedures') && !f.path.includes('__tests__')
      );

      // Should import from schema file
      expect(procedureFile?.content).toContain("from '../schemas/tag.js'");
      expect(procedureFile?.content).toContain('TagSchema');
      expect(procedureFile?.content).toContain('CreateTagInput');
      expect(procedureFile?.content).toContain('UpdateTagInput');
    });

    it('should use kebab-case for schema filename', async () => {
      const config: GeneratorConfig = {
        entityName: 'UserProfile',
        options: { withExample: false, withTests: true, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      expect(schemaFile?.path).toBe('src/schemas/user-profile.ts');
    });

    it('should use plural for procedure filename', async () => {
      const config: GeneratorConfig = {
        entityName: 'inventory',
        options: { withExample: false, withTests: true, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const procedureFile = output.files.find(
        (f) => f.path.includes('procedures') && !f.path.includes('__tests__')
      );

      expect(procedureFile?.path).toBe('src/procedures/inventories.ts');
    });

    it('should include post-generation instructions', async () => {
      const config: GeneratorConfig = {
        entityName: 'customer',
        options: { withExample: false, withTests: true, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('Prisma');
      expect(output.postInstructions).toContain('schema');
    });

    it('should use PascalCase for type names', async () => {
      const config: GeneratorConfig = {
        entityName: 'order-item',
        options: { withExample: true, withTests: true, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      const schemaFile = output.files.find((f) => f.path.includes('schemas'));
      expect(schemaFile?.content).toContain('OrderItemSchema');
      expect(schemaFile?.content).toContain('CreateOrderItemInput');

      const procedureFile = output.files.find(
        (f) => f.path.includes('procedures') && !f.path.includes('__tests__')
      );
      expect(procedureFile?.content).toContain('getOrderItem');
      expect(procedureFile?.content).toContain('orderItemProcedures');
    });

    it('should use plural for test filename', async () => {
      const config: GeneratorConfig = {
        entityName: 'widget',
        options: { withExample: false, withTests: true, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const testFile = output.files.find((f) => f.path.includes('__tests__'));

      expect(testFile?.path).toBe('src/procedures/__tests__/widgets.test.ts');
    });

    it('should render actual Zod fields when fields option is provided', async () => {
      const fields: FieldDefinition[] = [
        {
          name: 'title',
          type: 'string',
          attributes: { optional: false, unique: false, hasDefault: false },
        },
        {
          name: 'content',
          type: 'text',
          attributes: { optional: true, unique: false, hasDefault: false },
        },
        {
          name: 'published',
          type: 'boolean',
          attributes: { optional: false, unique: false, hasDefault: true },
        },
        {
          name: 'authorId',
          type: 'string',
          attributes: { optional: false, unique: false, hasDefault: false },
        },
      ];

      const config: GeneratorConfig = {
        entityName: 'post',
        options: { withExample: false, withTests: true, skipRegistration: true, fields },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      // Should NOT have TODO placeholder
      expect(schemaFile?.content).not.toContain('// TODO');

      // Base schema should contain all fields with Zod types
      expect(schemaFile?.content).toContain('title: z.string().min(1).max(255),');
      expect(schemaFile?.content).toContain('content: z.string().nullable(),');
      expect(schemaFile?.content).toContain('published: z.boolean()');
      expect(schemaFile?.content).toContain('authorId: z.string().min(1).max(255),');
    });

    it('should omit auto-generated fields from CreateInput', async () => {
      const fields: FieldDefinition[] = [
        {
          name: 'title',
          type: 'string',
          attributes: { optional: false, unique: false, hasDefault: false },
        },
        {
          name: 'views',
          type: 'int',
          attributes: { optional: false, unique: false, hasDefault: true },
        },
      ];

      const config: GeneratorConfig = {
        entityName: 'article',
        options: { withExample: false, withTests: true, skipRegistration: true, fields },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      // Base schema should have both fields
      expect(schemaFile?.content).toContain('title:');
      expect(schemaFile?.content).toContain('views:');

      // Extract just the CreateArticleInput section
      const createSection = schemaFile?.content?.split('CreateArticleInput')[1];
      // 'views' has a default, so it should NOT appear in CreateInput
      expect(createSection).not.toContain('views:');
      // 'title' should appear in CreateInput
      expect(createSection).toContain('title:');
    });

    it('should fall back to TODO placeholder when no fields provided', async () => {
      const config: GeneratorConfig = {
        entityName: 'event',
        options: { withExample: false, withTests: true, skipRegistration: true },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      expect(schemaFile?.content).toContain('// TODO: Add Event fields');
    });

    it('should fall back to TODO placeholder when fields array is empty', async () => {
      const config: GeneratorConfig = {
        entityName: 'event',
        options: { withExample: false, withTests: true, skipRegistration: true, fields: [] },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      expect(schemaFile?.content).toContain('// TODO: Add Event fields');
    });

    it('should render int field as z.number().int()', async () => {
      const fields: FieldDefinition[] = [
        {
          name: 'count',
          type: 'int',
          attributes: { optional: false, unique: false, hasDefault: false },
        },
      ];

      const config: GeneratorConfig = {
        entityName: 'metric',
        options: { withExample: false, withTests: true, skipRegistration: true, fields },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      expect(schemaFile?.content).toContain('count: z.number().int()');
    });

    it('should render datetime field as z.date()', async () => {
      const fields: FieldDefinition[] = [
        {
          name: 'scheduledAt',
          type: 'datetime',
          attributes: { optional: false, unique: false, hasDefault: false },
        },
      ];

      const config: GeneratorConfig = {
        entityName: 'task',
        options: { withExample: false, withTests: true, skipRegistration: true, fields },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      expect(schemaFile?.content).toContain('scheduledAt: z.date()');
    });

    it('should render json field as z.record(z.string(), z.unknown())', async () => {
      const fields: FieldDefinition[] = [
        {
          name: 'metadata',
          type: 'json',
          attributes: { optional: false, unique: false, hasDefault: false },
        },
      ];

      const config: GeneratorConfig = {
        entityName: 'config',
        options: { withExample: false, withTests: true, skipRegistration: true, fields },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      expect(schemaFile?.content).toContain('metadata: z.record(z.string(), z.unknown())');
    });

    it('should render boolean field as z.boolean()', async () => {
      const fields: FieldDefinition[] = [
        {
          name: 'active',
          type: 'boolean',
          attributes: { optional: false, unique: false, hasDefault: false },
        },
      ];

      const config: GeneratorConfig = {
        entityName: 'feature',
        options: { withExample: false, withTests: true, skipRegistration: true, fields },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      expect(schemaFile?.content).toContain('active: z.boolean()');
    });

    it('should render float field as z.number()', async () => {
      const fields: FieldDefinition[] = [
        {
          name: 'price',
          type: 'float',
          attributes: { optional: false, unique: false, hasDefault: false },
        },
      ];

      const config: GeneratorConfig = {
        entityName: 'product',
        options: { withExample: false, withTests: true, skipRegistration: true, fields },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      expect(schemaFile?.content).toContain('price: z.number(),');
    });

    it('should use .optional() for optional fields in CreateInput', async () => {
      const fields: FieldDefinition[] = [
        {
          name: 'title',
          type: 'string',
          attributes: { optional: false, unique: false, hasDefault: false },
        },
        {
          name: 'description',
          type: 'string',
          attributes: { optional: true, unique: false, hasDefault: false },
        },
      ];

      const config: GeneratorConfig = {
        entityName: 'note',
        options: { withExample: false, withTests: true, skipRegistration: true, fields },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      // Base schema uses .nullable() for optional fields (via fieldToZod)
      expect(schemaFile?.content).toContain('description: z.string().min(1).max(255).nullable(),');

      // CreateInput uses .optional() instead of .nullable()
      const createSection = schemaFile?.content?.split('CreateNoteInput')[1];
      expect(createSection).toContain('description: z.string().min(1).max(255).optional(),');
      // Required fields in CreateInput should NOT have .optional()
      expect(createSection).toContain('title: z.string().min(1).max(255),');
    });

    it('should have .partial() on UpdateInput', async () => {
      const fields: FieldDefinition[] = [
        {
          name: 'name',
          type: 'string',
          attributes: { optional: false, unique: false, hasDefault: false },
        },
      ];

      const config: GeneratorConfig = {
        entityName: 'label',
        options: { withExample: false, withTests: true, skipRegistration: true, fields },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      expect(schemaFile?.content).toContain('}).partial();');
    });

    it('should produce empty CreateInput when all fields have defaults', async () => {
      const fields: FieldDefinition[] = [
        {
          name: 'views',
          type: 'int',
          attributes: { optional: false, unique: false, hasDefault: true },
        },
        {
          name: 'active',
          type: 'boolean',
          attributes: { optional: false, unique: false, hasDefault: true },
        },
      ];

      const config: GeneratorConfig = {
        entityName: 'counter',
        options: { withExample: false, withTests: true, skipRegistration: true, fields },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      // Base schema should have both fields
      expect(schemaFile?.content).toContain('views:');
      expect(schemaFile?.content).toContain('active:');

      // CreateInput should be empty (both fields have defaults)
      const createSection = schemaFile?.content
        ?.split('CreateCounterInput = z.object({')[1]
        ?.split('})')[0];
      expect(createSection?.trim()).toBe('');
    });

    it('should NOT have TODO placeholders when fields are provided', async () => {
      const fields: FieldDefinition[] = [
        {
          name: 'name',
          type: 'string',
          attributes: { optional: false, unique: false, hasDefault: false },
        },
      ];

      const config: GeneratorConfig = {
        entityName: 'item',
        options: { withExample: false, withTests: true, skipRegistration: true, fields },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      expect(schemaFile?.content).not.toContain('// TODO');
    });

    it('should include id, createdAt, updatedAt in base schema even with custom fields', async () => {
      const fields: FieldDefinition[] = [
        {
          name: 'name',
          type: 'string',
          attributes: { optional: false, unique: false, hasDefault: false },
        },
      ];

      const config: GeneratorConfig = {
        entityName: 'widget',
        options: { withExample: false, withTests: true, skipRegistration: true, fields },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      expect(schemaFile?.content).toContain('id: z.string().uuid(),');
      expect(schemaFile?.content).toContain('createdAt: z.coerce.date(),');
      expect(schemaFile?.content).toContain('updatedAt: z.coerce.date(),');
    });

    it('should generate correct type exports with fields', async () => {
      const fields: FieldDefinition[] = [
        {
          name: 'title',
          type: 'string',
          attributes: { optional: false, unique: false, hasDefault: false },
        },
      ];

      const config: GeneratorConfig = {
        entityName: 'document',
        options: { withExample: false, withTests: true, skipRegistration: true, fields },
        cwd: '/test',
        project: mockProject,
        dryRun: true,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.includes('schemas'));

      expect(schemaFile?.content).toContain(
        'export type Document = z.infer<typeof DocumentSchema>;'
      );
      expect(schemaFile?.content).toContain(
        'export type CreateDocumentInputType = z.infer<typeof CreateDocumentInput>;'
      );
      expect(schemaFile?.content).toContain(
        'export type UpdateDocumentInputType = z.infer<typeof UpdateDocumentInput>;'
      );
    });
  });
});
