/**
 * Job Template
 *
 * Generates background job files for VeloxTS applications.
 */

import type { ProjectContext, TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface JobOptions {
  /** Custom queue assignment */
  queue: boolean;
  /** Retry and backoff configuration */
  retry: boolean;
  /** Progress tracking */
  progress: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for a job file
 */
export function getJobPath(entityName: string, _project: ProjectContext): string {
  return `src/jobs/${entityName.toLowerCase()}.ts`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate job with custom queue
 */
function generateQueueJob(ctx: TemplateContext<JobOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Job
 *
 * Background job for ${entity.humanReadable} processing with custom queue.
 */

import { defineJob } from '@veloxts/queue';
import { z } from 'zod';

// ============================================================================
// Schema
// ============================================================================

const ${entity.pascal}JobSchema = z.object({
  id: z.string().uuid(),
  // TODO: Add your job payload fields
});

export type ${entity.pascal}JobData = z.infer<typeof ${entity.pascal}JobSchema>;

// ============================================================================
// Job Definition
// ============================================================================

/**
 * ${entity.pascal} job
 *
 * Processes ${entity.humanReadable} tasks in the background.
 *
 * @example
 * \`\`\`typescript
 * import { ${entity.camel}Job } from '@/jobs/${entity.kebab}';
 * import { queue } from '@/queue';
 *
 * await queue.dispatch(${entity.camel}Job, { id: '...' });
 * \`\`\`
 */
export const ${entity.camel}Job = defineJob({
  name: '${entity.kebab}',
  schema: ${entity.pascal}JobSchema,
  queue: '${entity.camel}', // Custom queue for this job type
  handler: async ({ data, jobId, log }) => {
    await log(\`Processing ${entity.humanReadable}: \${data.id}\`);

    // TODO: Implement job logic
    // Example: await sendEmail(data.id);

    await log(\`${entity.pascal} job completed: \${jobId}\`);
  },
  options: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    priority: 0,
    removeOnComplete: true,
    removeOnFail: false,
  },
});
`;
}

/**
 * Generate job with retry configuration
 */
function generateRetryJob(ctx: TemplateContext<JobOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Job
 *
 * Background job for ${entity.humanReadable} processing with retry configuration.
 */

import { defineJob } from '@veloxts/queue';
import { z } from 'zod';

// ============================================================================
// Schema
// ============================================================================

const ${entity.pascal}JobSchema = z.object({
  id: z.string().uuid(),
  // TODO: Add your job payload fields
});

export type ${entity.pascal}JobData = z.infer<typeof ${entity.pascal}JobSchema>;

// ============================================================================
// Job Definition
// ============================================================================

/**
 * ${entity.pascal} job with advanced retry configuration
 *
 * Handles ${entity.humanReadable} tasks with exponential backoff on failure.
 *
 * @example
 * \`\`\`typescript
 * import { ${entity.camel}Job } from '@/jobs/${entity.kebab}';
 * import { queue } from '@/queue';
 *
 * await queue.dispatch(${entity.camel}Job, { id: '...' });
 * \`\`\`
 */
export const ${entity.camel}Job = defineJob({
  name: '${entity.kebab}',
  schema: ${entity.pascal}JobSchema,
  handler: async ({ data, attemptNumber, log }) => {
    await log(\`Attempt \${attemptNumber}: Processing ${entity.humanReadable} \${data.id}\`);

    try {
      // TODO: Implement job logic
      // Example: await externalApiCall(data.id);

      await log(\`${entity.pascal} job completed successfully\`);
    } catch (error) {
      await log(\`Error in ${entity.camel} job: \${error}\`);
      throw error; // Re-throw to trigger retry
    }
  },
  options: {
    // Retry configuration
    attempts: 5,
    backoff: {
      type: 'exponential', // Delay doubles each retry: 2s, 4s, 8s, 16s
      delay: 2000,
    },

    // Job priority (lower = higher priority)
    priority: 5,

    // Cleanup configuration
    removeOnComplete: true, // Auto-remove successful jobs
    removeOnFail: false, // Keep failed jobs for debugging

    // Optional: Set a timeout for the job
    timeout: 60000, // 1 minute
  },
});
`;
}

/**
 * Generate job with progress tracking
 */
function generateProgressJob(ctx: TemplateContext<JobOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Job
 *
 * Background job for ${entity.humanReadable} processing with progress tracking.
 */

import { defineJob } from '@veloxts/queue';
import { z } from 'zod';

// ============================================================================
// Schema
// ============================================================================

const ${entity.pascal}JobSchema = z.object({
  items: z.array(z.string()),
  // TODO: Add your job payload fields
});

export type ${entity.pascal}JobData = z.infer<typeof ${entity.pascal}JobSchema>;

// ============================================================================
// Job Definition
// ============================================================================

/**
 * ${entity.pascal} job with progress tracking
 *
 * Processes ${entity.humanReadable} tasks with real-time progress updates.
 *
 * @example
 * \`\`\`typescript
 * import { ${entity.camel}Job } from '@/jobs/${entity.kebab}';
 * import { queue } from '@/queue';
 *
 * await queue.dispatch(${entity.camel}Job, { items: ['a', 'b', 'c'] });
 * \`\`\`
 */
export const ${entity.camel}Job = defineJob({
  name: '${entity.kebab}',
  schema: ${entity.pascal}JobSchema,
  handler: async ({ data, progress, log }) => {
    const total = data.items.length;
    await log(\`Starting ${entity.camel} job with \${total} items\`);

    // Report initial progress
    await progress(0);

    for (let i = 0; i < total; i++) {
      const item = data.items[i];

      // TODO: Process each item
      // Example: await processItem(item);
      await log(\`Processing item: \${item}\`);

      // Update progress (0-100)
      const percentComplete = Math.round(((i + 1) / total) * 100);
      await progress(percentComplete);
    }

    await log(\`${entity.pascal} job completed: processed \${total} items\`);
  },
  options: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
`;
}

/**
 * Generate simple job template
 */
function generateSimpleJob(ctx: TemplateContext<JobOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Job
 *
 * Background job for ${entity.humanReadable} processing.
 */

import { defineJob } from '@veloxts/queue';
import { z } from 'zod';

// ============================================================================
// Schema
// ============================================================================

const ${entity.pascal}JobSchema = z.object({
  id: z.string().uuid(),
  // TODO: Add your job payload fields
});

export type ${entity.pascal}JobData = z.infer<typeof ${entity.pascal}JobSchema>;

// ============================================================================
// Job Definition
// ============================================================================

/**
 * ${entity.pascal} job
 *
 * Processes ${entity.humanReadable} tasks in the background.
 *
 * @example
 * \`\`\`typescript
 * import { ${entity.camel}Job } from '@/jobs/${entity.kebab}';
 * import { queue } from '@/queue';
 *
 * // Dispatch job for immediate processing
 * await queue.dispatch(${entity.camel}Job, { id: '...' });
 *
 * // Dispatch with delay
 * await queue.dispatch(${entity.camel}Job, { id: '...' }, { delay: '5m' });
 * \`\`\`
 */
export const ${entity.camel}Job = defineJob({
  name: '${entity.kebab}',
  schema: ${entity.pascal}JobSchema,
  handler: async ({ data, ctx }) => {
    // TODO: Implement your job logic here
    // Access database via ctx.db (if ORM plugin registered)
    // Example: const item = await ctx.db.item.findUnique({ where: { id: data.id } });

    console.log(\`Processing ${entity.humanReadable}:\`, data.id);
  },
  options: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});
`;
}

// ============================================================================
// Main Template
// ============================================================================

/**
 * Job template function
 */
export const jobTemplate: TemplateFunction<JobOptions> = (ctx) => {
  if (ctx.options.queue) {
    return generateQueueJob(ctx);
  }
  if (ctx.options.retry) {
    return generateRetryJob(ctx);
  }
  if (ctx.options.progress) {
    return generateProgressJob(ctx);
  }
  return generateSimpleJob(ctx);
};

// ============================================================================
// Post-generation Instructions
// ============================================================================

export function getJobInstructions(entityName: string, options: JobOptions): string {
  const lines = [`Your ${entityName} job has been created.`, '', 'Next steps:'];

  lines.push('  1. Update the Zod schema with your job payload fields');
  lines.push('  2. Implement the job handler logic');
  lines.push('  3. Dispatch the job from your procedures:');
  lines.push('');
  lines.push("     import { queue } from '@/queue';");
  lines.push(`     import { ${entityName}Job } from '@/jobs/${entityName.toLowerCase()}';`);
  lines.push('');
  lines.push(`     await queue.dispatch(${entityName}Job, { id: '...' });`);

  if (options.queue) {
    lines.push('');
    lines.push(`  4. Ensure the '${entityName}' queue is configured in your queue manager`);
  } else if (options.retry) {
    lines.push('');
    lines.push('  4. Adjust retry attempts and backoff strategy as needed');
  } else if (options.progress) {
    lines.push('');
    lines.push('  4. Monitor job progress in your queue dashboard');
  }

  return lines.join('\n');
}
