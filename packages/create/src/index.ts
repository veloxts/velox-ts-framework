/**
 * create-velox-app - Project scaffolding tool
 *
 * CLI tool for bootstrapping new VeloxTS applications with multiple templates.
 * Provides an interactive setup experience similar to create-next-app.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import * as p from '@clack/prompts';
import pc from 'picocolors';

import type { TemplateConfig, TemplateType } from './templates/index.js';
import {
  generateTemplateFiles,
  getAvailableTemplates,
  getTemplateDirectories,
} from './templates/index.js';

// ============================================================================
// Constants
// ============================================================================

// Read version from package.json dynamically
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

/** Create-velox-app package version */
export const CREATE_VERSION: string = packageJson.version ?? '0.0.0-unknown';

// ============================================================================
// Types
// ============================================================================

interface ProjectConfig {
  name: string;
  directory: string;
  packageManager: 'npm' | 'pnpm' | 'yarn';
  template: TemplateType;
}

// ============================================================================
// Main Scaffolder
// ============================================================================

/**
 * Main scaffolding function that creates a new VeloxTS project
 */
export async function createVeloxApp(
  initialProjectName?: string,
  initialTemplate?: TemplateType
): Promise<void> {
  // Print welcome banner
  console.log('');
  p.intro(pc.cyan(pc.bold('create-velox-app')));

  try {
    // Collect project configuration
    const config = await promptProjectConfig(initialProjectName, initialTemplate);

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
async function promptProjectConfig(
  initialName?: string,
  initialTemplate?: TemplateType
): Promise<ProjectConfig> {
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

  // Template selection (if not provided via CLI flag)
  let template = initialTemplate;
  if (!template) {
    const templates = getAvailableTemplates();
    const selectedTemplate = await p.select({
      message: 'Choose a template',
      options: templates.map((t) => ({
        value: t.type,
        label: t.label,
        hint: t.hint,
      })),
    });

    if (p.isCancel(selectedTemplate)) {
      throw new Error('canceled');
    }

    template = selectedTemplate as TemplateType;
  }

  // Detect package manager
  const packageManager = detectPackageManager();

  return {
    name: name as string,
    directory: path.resolve(process.cwd(), name as string),
    packageManager,
    template,
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
  spinner.start(`Creating project files (template: ${config.template})`);

  try {
    // Create directory structure
    const directories = getTemplateDirectories(config.template);
    for (const dir of directories) {
      await fs.mkdir(path.join(config.directory, dir), { recursive: true });
    }

    // Generate template files
    const templateConfig: TemplateConfig = {
      projectName: config.name,
      packageManager: config.packageManager,
      template: config.template,
    };

    const files = generateTemplateFiles(templateConfig);

    // Write all files
    for (const file of files) {
      const filePath = path.join(config.directory, file.path);
      const fileDir = path.dirname(filePath);

      // Ensure directory exists
      await fs.mkdir(fileDir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, file.content);
    }

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
  console.log(pc.green(`  Success! Created ${pc.bold(config.name)} with ${config.template} template`));
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

  // Auth template specific message
  if (config.template === 'auth') {
    console.log('');
    console.log(pc.yellow('  Note: Set JWT_SECRET and JWT_REFRESH_SECRET in .env for production'));
  }

  console.log('');
}
