/**
 * Factory Templates
 *
 * Template functions for generating factory files.
 */

import type { TemplateContext } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for factory generation
 */
export interface FactoryOptions {
  /** Include a model type import hint */
  model?: string;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for a factory file
 */
export function getFactoryPath(pascalName: string): string {
  return `src/database/factories/${pascalName}Factory.ts`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate factory file content
 */
export function factoryTemplate(context: TemplateContext<FactoryOptions>): string {
  const { entity } = context;

  return `/**
 * ${entity.pascal}Factory
 *
 * Factory for generating ${entity.pascal} model instances with fake data.
 *
 * Usage:
 *   const user = await factory.get(${entity.pascal}Factory).create();
 *   const users = await factory.get(${entity.pascal}Factory).createMany(10);
 *   const admin = await factory.get(${entity.pascal}Factory).state('admin').create();
 */

import { BaseFactory, type PrismaClientLike } from '@veloxts/cli';
import { faker } from '@faker-js/faker';

// ============================================================================
// Types
// ============================================================================

/**
 * Input type for creating a ${entity.pascal}.
 * Adjust these fields to match your Prisma model.
 */
export interface ${entity.pascal}Input {
  // TODO: Add fields that match your Prisma ${entity.pascal} model
  // Example fields:
  // id?: string;
  // name: string;
  // email: string;
  // createdAt?: Date;
}

// ============================================================================
// Factory
// ============================================================================

export class ${entity.pascal}Factory extends BaseFactory<${entity.pascal}Input> {
  readonly modelName = '${entity.camel}';

  constructor(prisma: PrismaClientLike) {
    super(prisma);

    // Register named states for variations
    // Example: admin state
    // this.registerState('admin', (attrs) => ({
    //   ...attrs,
    //   role: 'admin',
    // }));
  }

  /**
   * Define default attributes for a ${entity.pascal}.
   * Uses faker to generate realistic fake data.
   */
  definition(): ${entity.pascal}Input {
    return {
      // TODO: Generate fake data for your model
      // Example:
      // name: faker.person.fullName(),
      // email: faker.internet.email(),
    };
  }

  // ============================================================================
  // Named States (Convenience Methods)
  // ============================================================================

  // Example: Create an admin ${entity.camel}
  // admin(): this {
  //   return this.state('admin') as this;
  // }

  // Example: Create a verified ${entity.camel}
  // verified(): this {
  //   return this.state('verified') as this;
  // }
}
`;
}

// ============================================================================
// Instructions
// ============================================================================

/**
 * Get post-generation instructions
 */
export function getFactoryInstructions(pascalName: string): string {
  return `
${pascalName}Factory created successfully!

Next steps:
  1. Update ${pascalName}Input interface to match your Prisma model
  2. Fill in the definition() method with faker data
  3. Add named states for common variations (admin, verified, etc.)

Usage in seeders:
  await ctx.factory.get(${pascalName}Factory).create();
  await ctx.factory.get(${pascalName}Factory).createMany(10);
  await ctx.factory.get(${pascalName}Factory).state('admin').create();

Note: Make sure @faker-js/faker is installed:
  npm install @faker-js/faker
`;
}
