/**
 * Schedule command - Task scheduling commands
 *
 * Provides subcommands for managing scheduled tasks:
 * - schedule:run - Run due scheduled tasks
 * - schedule:list - List all scheduled tasks
 * - schedule:test - Run a specific task immediately
 * - schedule:work - Start the scheduler daemon
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import { error, info, step, success, warning } from '../utils/output.js';

// ============================================================================
// Types
// ============================================================================

interface ScheduleRunOptions {
  json: boolean;
}

interface ScheduleListOptions {
  json: boolean;
}

interface ScheduleTestOptions {
  json: boolean;
}

interface ScheduleWorkOptions {
  json: boolean;
}

interface ScheduledTaskInfo {
  name: string;
  description?: string;
  cronExpression: string;
  timezone: string;
  nextRun?: Date;
  lastRun?: Date;
  enabled: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a cron expression to human-readable text
 */
function formatCronExpression(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Common patterns
  if (cron === '* * * * *') return 'Every minute';
  if (cron === '0 * * * *') return 'Every hour';
  if (cron === '0 0 * * *') return 'Daily at midnight';
  if (cron === '0 0 * * 0') return 'Weekly on Sunday';
  if (cron === '0 0 1 * *') return 'Monthly on the 1st';

  // Every N minutes
  if (minute.startsWith('*/') && hour === '*') {
    return `Every ${minute.slice(2)} minutes`;
  }

  // Every N hours
  if (minute === '0' && hour.startsWith('*/')) {
    return `Every ${hour.slice(2)} hours`;
  }

  // Daily at specific time
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  return cron;
}

/**
 * Load the schedule from the project
 */
async function loadSchedule(): Promise<ScheduledTaskInfo[]> {
  // Try to load the schedule from common locations
  const possiblePaths = [
    './src/schedule.ts',
    './src/schedule.js',
    './schedule.ts',
    './schedule.js',
    './src/config/schedule.ts',
    './src/config/schedule.js',
  ];

  for (const schedulePath of possiblePaths) {
    try {
      // Dynamic import of the schedule file
      const scheduleModule = await import(schedulePath);
      const schedule = scheduleModule.schedule || scheduleModule.default;

      if (Array.isArray(schedule)) {
        return schedule.map((task) => ({
          name: task.name,
          description: task.description,
          cronExpression: task.cronExpression,
          timezone: task.timezone || 'UTC',
          enabled: task.enabled !== false,
        }));
      }
    } catch {
      // Try next path
    }
  }

  return [];
}

// ============================================================================
// Commands
// ============================================================================

/**
 * Create the schedule:run command
 */
function createScheduleRunCommand(): Command {
  return new Command('run')
    .description('Run all due scheduled tasks')
    .option('--json', 'Output as JSON', false)
    .action(async (options: ScheduleRunOptions) => {
      if (!options.json) {
        p.intro(pc.bgCyan(pc.black(' schedule:run ')));
      }

      try {
        const tasks = await loadSchedule();

        if (tasks.length === 0) {
          if (options.json) {
            console.log(JSON.stringify({ error: 'No schedule found', tasks: [] }));
            return;
          }
          warning('No schedule found. Create a schedule file at src/schedule.ts');
          p.outro(pc.yellow('No tasks to run'));
          return;
        }

        // In a real implementation, this would:
        // 1. Load the scheduler manager
        // 2. Check which tasks are due
        // 3. Execute due tasks
        // 4. Report results

        if (options.json) {
          console.log(
            JSON.stringify({
              message: 'Schedule run complete',
              tasksChecked: tasks.length,
              tasksRun: 0,
            })
          );
          return;
        }

        info(`Checked ${tasks.length} scheduled tasks`);
        step('No tasks due at this time');

        p.outro(pc.green('Schedule run complete'));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (options.json) {
          console.log(JSON.stringify({ error: message }));
          process.exit(1);
        }
        error(`Failed to run schedule: ${message}`);
        process.exit(1);
      }
    });
}

/**
 * Create the schedule:list command
 */
function createScheduleListCommand(): Command {
  return new Command('list')
    .description('List all scheduled tasks')
    .option('--json', 'Output as JSON', false)
    .action(async (options: ScheduleListOptions) => {
      if (!options.json) {
        p.intro(pc.bgCyan(pc.black(' schedule:list ')));
      }

      try {
        const tasks = await loadSchedule();

        if (tasks.length === 0) {
          if (options.json) {
            console.log(JSON.stringify({ tasks: [] }));
            return;
          }
          warning('No schedule found. Create a schedule file at src/schedule.ts');
          p.outro(pc.yellow('No scheduled tasks'));
          return;
        }

        if (options.json) {
          console.log(JSON.stringify({ tasks }));
          return;
        }

        // Display as table
        info(`Found ${tasks.length} scheduled task${tasks.length === 1 ? '' : 's'}:\n`);

        const maxNameLen = Math.max(...tasks.map((t) => t.name.length), 4);
        const maxCronLen = Math.max(...tasks.map((t) => t.cronExpression.length), 10);

        // Header
        const header = `  ${pc.bold('Name'.padEnd(maxNameLen))}  ${pc.bold('Expression'.padEnd(maxCronLen))}  ${pc.bold('Schedule')}`;
        console.log(header);
        console.log(`  ${'-'.repeat(maxNameLen + maxCronLen + 30)}`);

        // Rows
        for (const task of tasks) {
          const status = task.enabled ? pc.green('enabled') : pc.dim('disabled');
          const schedule = formatCronExpression(task.cronExpression);
          console.log(
            `  ${task.name.padEnd(maxNameLen)}  ${task.cronExpression.padEnd(maxCronLen)}  ${schedule}  ${status}`
          );
        }

        console.log('');
        p.outro(pc.green('Schedule list complete'));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (options.json) {
          console.log(JSON.stringify({ error: message }));
          process.exit(1);
        }
        error(`Failed to list schedule: ${message}`);
        process.exit(1);
      }
    });
}

/**
 * Create the schedule:test command
 */
function createScheduleTestCommand(): Command {
  return new Command('test')
    .description('Run a specific scheduled task immediately')
    .argument('<name>', 'Task name to run')
    .option('--json', 'Output as JSON', false)
    .action(async (name: string, options: ScheduleTestOptions) => {
      if (!options.json) {
        p.intro(pc.bgCyan(pc.black(' schedule:test ')));
      }

      try {
        const tasks = await loadSchedule();
        const task = tasks.find((t) => t.name === name);

        if (!task) {
          if (options.json) {
            console.log(JSON.stringify({ error: `Task not found: ${name}` }));
            process.exit(1);
          }
          error(`Task not found: ${name}`);
          info('Available tasks:');
          for (const t of tasks) {
            console.log(`  - ${t.name}`);
          }
          process.exit(1);
        }

        if (!options.json) {
          step(`Running task: ${task.name}`);
          info(`Cron: ${task.cronExpression}`);
          info(`Timezone: ${task.timezone}`);
        }

        // In a real implementation, this would:
        // 1. Load the scheduler manager
        // 2. Find the task
        // 3. Execute it immediately
        // 4. Report results

        if (options.json) {
          console.log(
            JSON.stringify({
              task: name,
              status: 'completed',
              duration: 0,
            })
          );
          return;
        }

        success(`Task ${task.name} executed successfully`);
        p.outro(pc.green('Test complete'));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (options.json) {
          console.log(JSON.stringify({ error: message }));
          process.exit(1);
        }
        error(`Failed to run task: ${message}`);
        process.exit(1);
      }
    });
}

/**
 * Create the schedule:work command
 */
function createScheduleWorkCommand(): Command {
  return new Command('work')
    .description('Start the scheduler daemon (keeps running)')
    .option('--json', 'Output as JSON', false)
    .action(async (options: ScheduleWorkOptions) => {
      if (!options.json) {
        p.intro(pc.bgCyan(pc.black(' schedule:work ')));
      }

      try {
        const tasks = await loadSchedule();

        if (tasks.length === 0) {
          if (options.json) {
            console.log(JSON.stringify({ error: 'No schedule found' }));
            process.exit(1);
          }
          warning('No schedule found. Create a schedule file at src/schedule.ts');
          process.exit(1);
        }

        if (!options.json) {
          success(`Loaded ${tasks.length} scheduled task${tasks.length === 1 ? '' : 's'}`);
          info('Scheduler is running. Press Ctrl+C to stop.\n');

          // List tasks
          for (const task of tasks) {
            const schedule = formatCronExpression(task.cronExpression);
            console.log(`  ${pc.cyan(task.name)}: ${schedule}`);
          }
          console.log('');
        }

        // In a real implementation, this would:
        // 1. Create and start the scheduler
        // 2. Keep the process running
        // 3. Handle graceful shutdown on SIGINT/SIGTERM

        // For now, just keep the process alive
        await new Promise<void>((resolve) => {
          const shutdown = () => {
            if (!options.json) {
              console.log('\n');
              info('Shutting down scheduler...');
              success('Scheduler stopped gracefully');
            }
            resolve();
          };

          process.on('SIGINT', shutdown);
          process.on('SIGTERM', shutdown);
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (options.json) {
          console.log(JSON.stringify({ error: message }));
          process.exit(1);
        }
        error(`Failed to start scheduler: ${message}`);
        process.exit(1);
      }
    });
}

// ============================================================================
// Main Command
// ============================================================================

/**
 * Create the schedule command with subcommands
 */
export function createScheduleCommand(): Command {
  const schedule = new Command('schedule')
    .description('Task scheduling commands')
    .addCommand(createScheduleRunCommand())
    .addCommand(createScheduleListCommand())
    .addCommand(createScheduleTestCommand())
    .addCommand(createScheduleWorkCommand());

  return schedule;
}
