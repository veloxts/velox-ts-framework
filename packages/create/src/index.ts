/**
 * create-velox-app - Project scaffolding tool
 *
 * CLI tool for bootstrapping new VeloxTS applications with a default template.
 * Provides an interactive setup experience similar to create-next-app.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import type { ProjectTemplate } from './templates.js';
import {
  generateConfigApp,
  generateConfigIndex,
  generateDatabaseIndex,
  generateEnvExample,
  generateGitignore,
  generateHealthProcedures,
  generateIndexHtml,
  generateIndexTs,
  generatePackageJson,
  generatePrismaConfig,
  generatePrismaSchema,
  generateProceduresIndex,
  generateReadme,
  generateSchemasIndex,
  generateTsConfig,
  generateTsupConfig,
  generateUserProcedures,
  generateUserSchema,
} from './templates.js';

// ============================================================================
// Constants
// ============================================================================

export const CREATE_VERSION = '0.1.0';

// ============================================================================
// Types
// ============================================================================

interface ProjectConfig {
  name: string;
  directory: string;
  packageManager: 'npm' | 'pnpm' | 'yarn';
}

// ============================================================================
// Main Scaffolder
// ============================================================================

/**
 * Main scaffolding function that creates a new VeloxTS project
 */
export async function createVeloxApp(initialProjectName?: string): Promise<void> {
  // Print welcome banner
  console.log('');
  p.intro(pc.cyan(pc.bold('create-velox-app')));

  try {
    // Collect project configuration
    const config = await promptProjectConfig(initialProjectName);

    // Validate project directory doesn't exist
    await validateProjectDirectory(config.directory);

    // Create project structure
    await createProjectStructure(config);

    // Install dependencies
    await installDependencies(config);

    // Generate Prisma client
    await generatePrismaClient(config);

    // Initialize git
    await initializeGit(config);

    // Print success message
    printSuccessMessage(config);

    p.outro(pc.green('Done! Your VeloxTS app is ready.'));
  } catch (error) {
    // Handle cancellation
    if (error === Symbol.for('clack.cancel') || (error as Error).message === 'canceled') {
      p.cancel('Setup cancelled');
      process.exit(0);
    }

    // Handle other errors
    p.cancel('Setup failed');
    if (error instanceof Error) {
      console.error(pc.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}

// ============================================================================
// Configuration Prompts
// ============================================================================

/**
 * Prompt user for project configuration
 */
async function promptProjectConfig(initialName?: string): Promise<ProjectConfig> {
  // Project name
  const name = initialName
    ? initialName
    : await p.text({
        message: 'What is your project named?',
        placeholder: 'my-velox-app',
        validate: (value) => {
          if (!value) return 'Project name is required';
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Use lowercase letters, numbers, and hyphens only';
          }
          return undefined;
        },
      });

  if (p.isCancel(name)) {
    throw new Error('canceled');
  }

  // Validate project name format
  if (typeof name === 'string' && !/^[a-z0-9-]+$/.test(name)) {
    throw new Error('Project name must use lowercase letters, numbers, and hyphens only');
  }

  // Detect package manager
  const packageManager = detectPackageManager();

  return {
    name: name as string,
    directory: path.resolve(process.cwd(), name as string),
    packageManager,
  };
}

/**
 * Detect which package manager is being used
 */
function detectPackageManager(): 'npm' | 'pnpm' | 'yarn' {
  const userAgent = process.env.npm_config_user_agent || '';

  if (userAgent.includes('pnpm')) return 'pnpm';
  if (userAgent.includes('yarn')) return 'yarn';
  return 'npm';
}

// ============================================================================
// Project Creation
// ============================================================================

/**
 * Validate that project directory doesn't already exist
 */
async function validateProjectDirectory(directory: string): Promise<void> {
  try {
    await fs.access(directory);
    throw new Error(`Directory ${path.basename(directory)} already exists`);
  } catch (error) {
    // Directory doesn't exist - this is what we want
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Create the complete project structure with all files
 */
async function createProjectStructure(config: ProjectConfig): Promise<void> {
  const spinner = p.spinner();
  spinner.start('Creating project files');

  try {
    // Create directory structure
    await fs.mkdir(config.directory, { recursive: true });
    await fs.mkdir(path.join(config.directory, 'src'), { recursive: true });
    await fs.mkdir(path.join(config.directory, 'src', 'config'), { recursive: true });
    await fs.mkdir(path.join(config.directory, 'src', 'database'), { recursive: true });
    await fs.mkdir(path.join(config.directory, 'src', 'procedures'), { recursive: true });
    await fs.mkdir(path.join(config.directory, 'src', 'schemas'), { recursive: true });
    await fs.mkdir(path.join(config.directory, 'prisma'), { recursive: true });
    await fs.mkdir(path.join(config.directory, 'public'), { recursive: true });

    // Template data
    const template: ProjectTemplate = {
      projectName: config.name,
      packageManager: config.packageManager,
    };

    // Write root files
    await fs.writeFile(path.join(config.directory, 'package.json'), generatePackageJson(template));
    await fs.writeFile(path.join(config.directory, 'tsconfig.json'), generateTsConfig());
    await fs.writeFile(path.join(config.directory, 'tsup.config.ts'), generateTsupConfig());
    await fs.writeFile(path.join(config.directory, '.env.example'), generateEnvExample());
    await fs.writeFile(path.join(config.directory, '.env'), generateEnvExample());
    await fs.writeFile(path.join(config.directory, '.gitignore'), generateGitignore());
    await fs.writeFile(path.join(config.directory, 'README.md'), generateReadme(config.name));

    // Write Prisma files
    await fs.writeFile(
      path.join(config.directory, 'prisma', 'schema.prisma'),
      generatePrismaSchema()
    );
    await fs.writeFile(path.join(config.directory, 'prisma.config.ts'), generatePrismaConfig());

    // Write source files
    await fs.writeFile(path.join(config.directory, 'src', 'index.ts'), generateIndexTs());

    // Write config files
    await fs.writeFile(
      path.join(config.directory, 'src', 'config', 'index.ts'),
      generateConfigIndex()
    );
    await fs.writeFile(path.join(config.directory, 'src', 'config', 'app.ts'), generateConfigApp());

    // Write database files
    await fs.writeFile(
      path.join(config.directory, 'src', 'database', 'index.ts'),
      generateDatabaseIndex()
    );

    // Write procedure files
    await fs.writeFile(
      path.join(config.directory, 'src', 'procedures', 'index.ts'),
      generateProceduresIndex()
    );
    await fs.writeFile(
      path.join(config.directory, 'src', 'procedures', 'health.ts'),
      generateHealthProcedures()
    );
    await fs.writeFile(
      path.join(config.directory, 'src', 'procedures', 'users.ts'),
      generateUserProcedures()
    );

    // Write schema files
    await fs.writeFile(
      path.join(config.directory, 'src', 'schemas', 'index.ts'),
      generateSchemasIndex()
    );
    await fs.writeFile(
      path.join(config.directory, 'src', 'schemas', 'user.ts'),
      generateUserSchema()
    );

    // Write public files
    await fs.writeFile(path.join(config.directory, 'public', 'index.html'), generateIndexHtml());

    spinner.stop('Project files created');
  } catch (error) {
    spinner.stop('Failed to create project files');
    throw error;
  }
}

// ============================================================================
// Dependency Installation
// ============================================================================

/**
 * Install project dependencies using the detected package manager
 */
async function installDependencies(config: ProjectConfig): Promise<void> {
  // Skip installation if SKIP_INSTALL is set (used in smoke tests)
  if (process.env.SKIP_INSTALL === 'true') {
    return;
  }

  const spinner = p.spinner();
  spinner.start('Installing dependencies');

  try {
    const installCommand = getInstallCommand(config.packageManager);

    execSync(installCommand, {
      cwd: config.directory,
      stdio: 'ignore',
    });

    spinner.stop('Dependencies installed');
  } catch (error) {
    spinner.stop('Failed to install dependencies');
    throw error;
  }
}

/**
 * Get the install command for the package manager
 */
function getInstallCommand(packageManager: string): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm install';
    case 'yarn':
      return 'yarn install';
    default:
      return 'npm install';
  }
}

// ============================================================================
// Prisma Client Generation
// ============================================================================

/**
 * Generate Prisma client after dependencies are installed
 */
async function generatePrismaClient(config: ProjectConfig): Promise<void> {
  // Skip if SKIP_INSTALL is set (used in smoke tests)
  if (process.env.SKIP_INSTALL === 'true') {
    return;
  }

  const spinner = p.spinner();
  spinner.start('Generating Prisma client');

  try {
    execSync('npx prisma generate', {
      cwd: config.directory,
      stdio: 'ignore',
    });

    spinner.stop('Prisma client generated');
  } catch (error) {
    spinner.stop('Failed to generate Prisma client');
    throw error;
  }
}

// ============================================================================
// Git Initialization
// ============================================================================

/**
 * Initialize git repository
 */
async function initializeGit(config: ProjectConfig): Promise<void> {
  const spinner = p.spinner();
  spinner.start('Initializing git repository');

  try {
    execSync('git init', {
      cwd: config.directory,
      stdio: 'ignore',
    });

    execSync('git add .', {
      cwd: config.directory,
      stdio: 'ignore',
    });

    execSync('git commit -m "Initial commit from create-velox-app"', {
      cwd: config.directory,
      stdio: 'ignore',
    });

    spinner.stop('Git repository initialized');
  } catch (_error) {
    // Git init is optional - don't fail if it doesn't work
    spinner.stop('Skipped git initialization');
  }
}

// ============================================================================
// Success Message
// ============================================================================

/**
 * Print success message with next steps
 */
function printSuccessMessage(config: ProjectConfig): void {
  const cdCommand = `cd ${config.name}`;
  const devCommand = `${config.packageManager} dev`;
  const dbCommand = `${config.packageManager} db:push`;

  console.log('');
  console.log(pc.green(`  Success! Created ${pc.bold(config.name)}`));
  console.log('');
  console.log('  Next steps:');
  console.log('');
  console.log(`    ${pc.cyan(cdCommand)}`);

  // Add pnpm-specific instruction for native module builds
  if (config.packageManager === 'pnpm') {
    console.log(
      `    ${pc.cyan('pnpm approve-builds')}${pc.dim('  # Allow native module compilation')}`
    );
  }

  console.log(`    ${pc.cyan(dbCommand)}${pc.dim('  # Setup database')}`);
  console.log(`    ${pc.cyan(devCommand)}${pc.dim('   # Start dev server')}`);
  console.log('');
  console.log(`  Your app will be available at ${pc.cyan('http://localhost:3210')}`);
  console.log('');
}
