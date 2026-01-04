/**
 * Namespace Generator - Unit Tests
 *
 * Tests for namespace template generation (procedure + schema files).
 */

import { describe, expect, it } from 'vitest';

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
  });
});
