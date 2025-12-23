/**
 * Task Template
 *
 * Template for generating scheduled task files.
 */

import type { ProjectContext, TemplateContext } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options specific to task generation
 */
export interface TaskOptions {
  /** Generate task with callback handlers */
  callbacks: boolean;
  /** Generate task with constraints */
  constraints: boolean;
  /** Generate task with overlap prevention */
  noOverlap: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the output path for a task file
 */
export function getTaskPath(entityName: string, _project?: ProjectContext): string {
  return `src/tasks/${entityName}.ts`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate a scheduled task file
 */
export function taskTemplate(context: TemplateContext<TaskOptions>): string {
  const { entity, options } = context;
  const className = entity.pascal;

  const callbacksCode = options.callbacks
    ? `
    .onSuccess((ctx, duration) => {
      console.log(\`[${className}] Completed in \${duration}ms\`);
    })
    .onFailure((ctx, error) => {
      console.error(\`[${className}] Failed:\`, error.message);
    })`
    : '';

  const constraintsCode = options.constraints
    ? `
    .weekdays()  // Only run on Mon-Fri
    .between('09:00', '17:00')  // Only during business hours`
    : '';

  const noOverlapCode = options.noOverlap
    ? `
    .withoutOverlapping()`
    : '';

  return `/**
 * ${className} Task
 *
 * A scheduled task that runs on a cron-like schedule.
 *
 * @example Add to your schedule file:
 * \`\`\`typescript
 * import { ${className}Task } from './tasks/${entity.kebab}';
 *
 * export const schedule = defineSchedule([
 *   ${className}Task,
 *   // ... other tasks
 * ]);
 * \`\`\`
 */

import { task } from '@veloxts/scheduler';
// import { db } from '../db';

/**
 * ${className} scheduled task
 *
 * Runs daily at 2:00 AM by default.
 * Modify the schedule chain to adjust timing.
 */
export const ${className}Task = task('${entity.kebab}', async (ctx) => {
  console.log(\`[${className}] Starting at \${ctx.startedAt.toISOString()}\`);

  // TODO: Add your task logic here
  // Example:
  // const deleted = await db.expiredToken.deleteMany({
  //   where: { expiresAt: { lt: new Date() } }
  // });
  // console.log(\`[${className}] Cleaned up \${deleted.count} expired tokens\`);

  console.log(\`[${className}] Completed\`);
})
  .description('${className} scheduled task')
  .daily()
  .at('02:00')
  .timezone('UTC')${noOverlapCode}${constraintsCode}${callbacksCode}
  .build();
`;
}

/**
 * Generate a schedule file that imports and exports all tasks
 */
export function scheduleFileTemplate(taskNames: string[]): string {
  const imports = taskNames
    .map((name) => {
      const className =
        name
          .replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase())
          .charAt(0)
          .toUpperCase() + name.replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase()).slice(1);
      return `import { ${className}Task } from './tasks/${name}';`;
    })
    .join('\n');

  const taskList = taskNames
    .map((name) => {
      const className =
        name
          .replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase())
          .charAt(0)
          .toUpperCase() + name.replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase()).slice(1);
      return `  ${className}Task,`;
    })
    .join('\n');

  return `/**
 * Application Schedule
 *
 * Define all scheduled tasks for your application here.
 *
 * Tasks are run via the scheduler:
 * - velox schedule:work  # Start the scheduler daemon
 * - velox schedule:run   # Run due tasks (call from system cron)
 * - velox schedule:list  # List all scheduled tasks
 */

import { defineSchedule } from '@veloxts/scheduler';

${imports}

/**
 * Application schedule definition
 *
 * Add to your app.ts:
 * \`\`\`typescript
 * import { schedulerPlugin } from '@veloxts/scheduler';
 * import { schedule } from './schedule';
 *
 * app.register(schedulerPlugin, {
 *   tasks: schedule,
 *   autoStart: true,
 * });
 * \`\`\`
 */
export const schedule = defineSchedule([
${taskList}
]);
`;
}

// ============================================================================
// Post-generation Instructions
// ============================================================================

/**
 * Get instructions to display after generating a task
 */
export function getTaskInstructions(entityName: string, options: TaskOptions): string {
  const lines: string[] = [
    `Task file created at src/tasks/${entityName}.ts`,
    '',
    'Next steps:',
    '1. Implement your task logic in the handler function',
    '2. Add the task to your schedule:',
    '',
    '   // src/schedule.ts',
    `   import { ${toPascalCase(entityName)}Task } from './tasks/${entityName}';`,
    '',
    '   export const schedule = defineSchedule([',
    `     ${toPascalCase(entityName)}Task,`,
    '   ]);',
    '',
    '3. Register the scheduler plugin in your app:',
    '',
    '   // app.ts',
    "   import { schedulerPlugin } from '@veloxts/scheduler';",
    "   import { schedule } from './schedule';",
    '',
    '   app.register(schedulerPlugin, {',
    '     tasks: schedule,',
    '     autoStart: true,',
    '   });',
  ];

  if (options.callbacks) {
    lines.push('', '4. Customize the onSuccess/onFailure callbacks as needed');
  }

  if (options.constraints) {
    lines.push('', '4. Adjust the weekdays() and between() constraints as needed');
  }

  return lines.join('\n');
}

/**
 * Convert kebab-case or snake_case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}
