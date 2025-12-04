/**
 * Migrate command - Run database migrations
 *
 * Wrapper around Prisma migrations with beautiful Laravel-inspired output
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import { error, formatCommand, info, instruction, success } from '../utils/output.js';
import { fileExists } from '../utils/paths.js';

interface MigrateOptions {
  deploy?: boolean;
  force?: boolean;
}

/**
 * Create the migrate command
 */
export function createMigrateCommand(): Command {
  return new Command('migrate')
    .description('Run database migrations')
    .option('--deploy', 'Run migrations in production mode (prisma migrate deploy)')
    .option('--force', 'Force push schema without migration (development only)')
    .action(async (options: MigrateOptions) => {
      await runMigrations(options);
    });
}

/**
 * Run database migrations
 */
async function runMigrations(options: MigrateOptions): Promise<void> {
  const s = p.spinner();

  try {
    // Check if Prisma schema exists
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');

    if (!fileExists(schemaPath)) {
      error('Prisma schema not found.');
      instruction('Expected to find prisma/schema.prisma in the current directory.');
      instruction(`Initialize Prisma with: ${formatCommand('npx prisma init')}`);
      process.exit(1);
    }

    // Determine which command to run
    let command: string[];
    let description: string;

    if (options.deploy) {
      // Production: Apply pending migrations
      command = ['prisma', 'migrate', 'deploy'];
      description = 'Applying production migrations';
    } else if (options.force) {
      // Development: Force push schema
      command = ['prisma', 'db', 'push', '--skip-generate'];
      description = 'Pushing database schema (development mode)';
    } else {
      // Development: Push with generate
      command = ['prisma', 'db', 'push'];
      description = 'Synchronizing database schema';
    }

    info(description);
    console.log('');

    s.start('Running Prisma...');

    // Run the Prisma command
    await new Promise<void>((resolve, reject) => {
      const prismaProcess = spawn('npx', command, {
        stdio: 'inherit',
        shell: true,
        env: process.env,
      });

      prismaProcess.on('error', (err) => {
        reject(new Error(`Failed to run Prisma: ${err.message}`));
      });

      prismaProcess.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Prisma exited with code ${code}`));
        }
      });
    });

    s.stop('Migration completed');
    console.log('');
    success('Database schema synchronized successfully!');

    // Show next steps for production migrations
    if (options.deploy) {
      instruction('Your database is now up to date with the latest migrations.');
    } else {
      console.log('');
      info('Development tips:');
      console.log(
        `  ${pc.dim('•')} Use ${formatCommand('velox migrate')} to sync schema changes during development`
      );
      console.log(
        `  ${pc.dim('•')} Use ${formatCommand('velox migrate --deploy')} in production to apply migrations`
      );
      console.log(
        `  ${pc.dim('•')} Use ${formatCommand('npx prisma studio')} to explore your database`
      );
      console.log('');
    }
  } catch (err) {
    s.stop('Migration failed');
    console.log('');

    if (err instanceof Error) {
      error(err.message);

      // Provide helpful suggestions based on error
      if (err.message.includes('P1001')) {
        instruction('Cannot reach database server. Check your connection:');
        console.log(`  ${pc.dim('1.')} Verify DATABASE_URL in .env file`);
        console.log(`  ${pc.dim('2.')} Ensure database server is running`);
        console.log(`  ${pc.dim('3.')} Check network connectivity`);
      } else if (err.message.includes('P3009')) {
        instruction('Migration failed. Your changes may conflict with existing data.');
        console.log(`  ${pc.dim('•')} Review the Prisma error above`);
        console.log(`  ${pc.dim('•')} Consider creating a manual migration`);
      } else if (err.message.includes('P1003')) {
        instruction('Database does not exist. Create it first:');
        console.log(`  ${pc.dim('•')} Check your DATABASE_URL`);
        console.log(`  ${pc.dim('•')} Create the database manually if needed`);
      } else {
        instruction('Common solutions:');
        console.log(`  ${pc.dim('1.')} Check your DATABASE_URL in .env`);
        console.log(
          `  ${pc.dim('2.')} Ensure Prisma schema is valid: ${formatCommand('npx prisma validate')}`
        );
        console.log(`  ${pc.dim('3.')} Review Prisma logs above for specific errors`);
      }

      console.log('');
      instruction(
        `For more help, see: ${pc.cyan('https://www.prisma.io/docs/reference/api-reference/command-reference')}`
      );
    } else {
      error('An unknown error occurred');
    }

    process.exit(1);
  }
}
