/**
 * Seeder Templates
 *
 * Template functions for generating seeder files.
 */

import type { TemplateContext } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for seeder generation
 */
export interface SeederOptions {
  /** Also generate a factory for this model */
  factory?: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for a seeder file
 */
export function getSeederPath(pascalName: string): string {
  return `src/database/seeders/${pascalName}Seeder.ts`;
}

/**
 * Get the path for the DatabaseSeeder entry point
 */
export function getDatabaseSeederPath(): string {
  return 'src/database/seeders/DatabaseSeeder.ts';
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate seeder file content
 */
export function seederTemplate(context: TemplateContext<SeederOptions>): string {
  const { entity, options } = context;

  const factoryImport = options.factory
    ? `import { ${entity.pascal}Factory } from '../factories/${entity.pascal}Factory.js';\n`
    : '';

  const factoryUsage = options.factory
    ? `    // Create records using factory
    await ctx.factory.get(${entity.pascal}Factory).createMany(10);
    ctx.log.success('Created 10 ${entity.plural}');`
    : `    // Create records directly via Prisma
    await ctx.db.${entity.camel}.createMany({
      data: [
        // Add your seed data here
        // { name: 'Example', ... },
      ],
    });
    ctx.log.success('Created ${entity.plural}');`;

  const truncateMethod = `

  async truncate(ctx) {
    ctx.log.info('Truncating ${entity.plural} table...');
    await ctx.db.${entity.camel}.deleteMany();
  },`;

  return `/**
 * ${entity.pascal}Seeder
 *
 * Seeds the ${entity.plural} table with initial/test data.
 */

import type { Seeder, SeederContext } from '@veloxts/cli';
${factoryImport}
export const ${entity.pascal}Seeder: Seeder = {
  name: '${entity.pascal}Seeder',

  // Seeders that must run before this one
  dependencies: [],

  // Only run in these environments (empty = all)
  // environments: ['development', 'test'],

  async run(ctx: SeederContext): Promise<void> {
    ctx.log.info('Seeding ${entity.plural}...');

${factoryUsage}
  },${truncateMethod}
};
`;
}

/**
 * Generate DatabaseSeeder entry point
 */
export function databaseSeederTemplate(seederNames: string[]): string {
  const imports = seederNames
    .map((name) => `import { ${name}Seeder } from './${name}Seeder.js';`)
    .join('\n');

  const runs = seederNames.map((name) => `    await ctx.runSeeder(${name}Seeder);`).join('\n');

  return `/**
 * DatabaseSeeder
 *
 * Main entry point for database seeding.
 * Orchestrates the execution of all seeders.
 */

import type { Seeder, SeederContext } from '@veloxts/cli';
${imports}

export const DatabaseSeeder: Seeder = {
  name: 'DatabaseSeeder',

  async run(ctx: SeederContext): Promise<void> {
    // Run seeders in order (dependencies handled automatically)
${runs}
  },
};
`;
}

// ============================================================================
// Instructions
// ============================================================================

/**
 * Get post-generation instructions
 */
export function getSeederInstructions(pascalName: string, hasFactory: boolean): string {
  const factoryNote = hasFactory
    ? `
Your factory has also been created. You can customize the fake data
generation in src/database/factories/${pascalName}Factory.ts`
    : '';

  return `
${pascalName}Seeder created successfully!

Next steps:
  1. Add your seed data to src/database/seeders/${pascalName}Seeder.ts
  2. Run seeders with: velox db:seed

To run only this seeder:
  velox db:seed ${pascalName}Seeder

To truncate and re-seed:
  velox db:seed --fresh${factoryNote}
`;
}
