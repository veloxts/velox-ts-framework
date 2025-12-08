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

import type { DatabaseType, TemplateConfig, TemplateType } from './templates/index.js';
import {
  generateTemplateFiles,
  getAvailableDatabases,
  getAvailableTemplates,
  getTemplateDirectories,
  isDatabaseAvailable,
} from './templates/index.js';

// ============================================================================
// Constants
// ============================================================================

// Read version from package.json dynamically
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

/** Create-velox-app package version */
export const CREATE_VERSION: string = packageJson.version ?? '0.0.0-unknown';

/** Timeout for exec commands (5 minutes) */
const EXEC_TIMEOUT_MS = 5 * 60 * 1000;

/** Reserved project names that could cause issues */
const RESERVED_NAMES = new Set([
  'node_modules',
  'test',
  'tests',
  'src',
  'dist',
  'build',
  'public',
  'lib',
  'package',
  'npm',
  'pnpm',
  'yarn',
]);

// ============================================================================
// Types
// ============================================================================

interface ProjectConfig {
  name: string;
  directory: string;
  packageManager: 'npm' | 'pnpm' | 'yarn';
  template: TemplateType;
  database: DatabaseType;
}

// ============================================================================
// Security Utilities
// ============================================================================

/**
 * Check if a file path is safe (no path traversal attacks)
 */
function isPathSafe(baseDir: string, targetPath: string): boolean {
  const resolved = path.resolve(baseDir, targetPath);
  const normalizedBase = path.normalize(baseDir);
  return resolved.startsWith(normalizedBase);
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

  let projectDirectory: string | undefined;
  let projectCreated = false;

  try {
    // Collect project configuration
    const config = await promptProjectConfig(initialProjectName, initialTemplate);
    projectDirectory = config.directory;

    // Show configuration summary
    p.log.info(pc.dim('Configuration:'));
    p.log.message(`  ${pc.cyan('Template:')} ${config.template}`);
    p.log.message(`  ${pc.cyan('Database:')} ${config.database}`);
    p.log.message(`  ${pc.cyan('Package manager:')} ${config.packageManager}`);
    console.log('');

    // Validate project directory doesn't exist
    await validateProjectDirectory(config.directory);

    // Create project structure
    await createProjectStructure(config);
    projectCreated = true;

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
      // Clean up partial project on cancellation
      if (projectCreated && projectDirectory) {
        try {
          await fs.rm(projectDirectory, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors on cancellation
        }
      }
      p.cancel('Setup cancelled');
      process.exit(0);
    }

    // Handle other errors - provide recovery instructions
    p.cancel('Setup failed');
    if (error instanceof Error) {
      console.error(pc.red(`\nError: ${error.message}`));

      // If project was created but install failed, provide recovery instructions
      if (projectCreated && projectDirectory) {
        const projectName = path.basename(projectDirectory);
        console.error(pc.yellow('\nTo recover your project:'));
        console.error(pc.dim(`  cd ${projectName}`));
        console.error(pc.dim('  npm install'));
        console.error(pc.dim('  npx prisma generate'));
      }
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
          if (RESERVED_NAMES.has(value)) {
            return `"${value}" is a reserved name. Please choose another.`;
          }
          return undefined;
        },
      });

  if (p.isCancel(name)) {
    throw new Error('canceled');
  }

  // Validate project name format (for CLI-provided names)
  if (typeof name === 'string') {
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error('Project name must use lowercase letters, numbers, and hyphens only');
    }
    if (RESERVED_NAMES.has(name)) {
      throw new Error(`"${name}" is a reserved name. Please choose another.`);
    }
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

  // Database selection (only in interactive mode - default to SQLite for CLI)
  let database: DatabaseType = 'sqlite';

  // Only show database prompt in interactive mode (when template wasn't provided via CLI)
  if (!initialTemplate) {
    const databases = getAvailableDatabases();
    const selectedDatabase = await p.select({
      message: 'Choose a database',
      options: databases.map((db) => ({
        value: db.type,
        label: db.disabled ? pc.dim(`${db.label} (coming soon)`) : db.label,
        hint: db.hint,
        disabled: db.disabled,
      })),
    });

    if (p.isCancel(selectedDatabase)) {
      throw new Error('canceled');
    }

    database = selectedDatabase as DatabaseType;

    // Validate database is available
    if (!isDatabaseAvailable(database)) {
      throw new Error(`Database "${database}" is not yet available. Please choose SQLite for now.`);
    }
  }

  // Detect package manager
  const packageManager = detectPackageManager();

  return {
    name: name as string,
    directory: path.resolve(process.cwd(), name as string),
    packageManager,
    template,
    database,
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
  spinner.start(`Creating project files (template: ${config.template}, database: ${config.database})`);

  try {
    // Create directory structure
    const directories = getTemplateDirectories(config.template);
    for (const dir of directories) {
      // Validate path safety
      if (!isPathSafe(config.directory, dir)) {
        throw new Error(`Invalid directory path detected: ${dir}`);
      }
      await fs.mkdir(path.join(config.directory, dir), { recursive: true });
    }

    // Generate template files
    const templateConfig: TemplateConfig = {
      projectName: config.name,
      packageManager: config.packageManager,
      template: config.template,
      database: config.database,
    };

    const files = generateTemplateFiles(templateConfig);

    // Write all files
    for (const file of files) {
      // Validate path safety to prevent path traversal attacks
      if (!isPathSafe(config.directory, file.path)) {
        throw new Error(`Invalid file path detected: ${file.path}`);
      }

      const filePath = path.join(config.directory, file.path);
      const fileDir = path.dirname(filePath);

      // Ensure directory exists
      await fs.mkdir(fileDir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, file.content);
    }

    spinner.stop(`Project files created ${pc.dim(`(${files.length} files)`)}`);
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
      timeout: EXEC_TIMEOUT_MS,
    });

    spinner.stop('Dependencies installed');
  } catch (error) {
    spinner.stop('Failed to install dependencies');
    // Enhance error message for timeout
    if (error instanceof Error && error.message.includes('ETIMEDOUT')) {
      throw new Error('Dependency installation timed out. Check your network connection.');
    }
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
      timeout: EXEC_TIMEOUT_MS,
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
      timeout: 30000, // 30 seconds for git operations
    });

    execSync('git add .', {
      cwd: config.directory,
      stdio: 'ignore',
      timeout: 30000,
    });

    execSync('git commit -m "Initial commit from create-velox-app"', {
      cwd: config.directory,
      stdio: 'ignore',
      timeout: 30000,
    });

    spinner.stop('Git repository initialized');
  } catch (error) {
    // Git init is optional - provide context on why it was skipped
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    if (errorMessage.includes('command not found') || errorMessage.includes('not recognized')) {
      spinner.stop('Skipped git initialization (git not installed)');
    } else {
      spinner.stop('Skipped git initialization');
    }
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
  console.log(
    pc.green(`  Success! Created ${pc.bold(config.name)} with ${config.template} template`)
  );
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
