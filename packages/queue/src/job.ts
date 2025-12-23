/**
 * Job Definition
 *
 * Type-safe job definitions with Zod schema validation.
 */

import type { z } from 'zod';

import type { JobDefinition, JobDefinitionConfig, JobOptions } from './types.js';
import { validateJobName } from './utils.js';

// Re-export JobDefinition type for consumer convenience
export type { JobDefinition } from './types.js';

/**
 * Default job options.
 */
const DEFAULT_JOB_OPTIONS: JobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  priority: 0,
  removeOnComplete: true,
  removeOnFail: false,
};

/**
 * Define a type-safe job with Zod schema validation.
 *
 * @param config - Job definition configuration
 * @returns Job definition
 *
 * @example
 * ```typescript
 * import { defineJob } from '@veloxts/queue';
 * import { z } from 'zod';
 *
 * export const sendWelcomeEmail = defineJob({
 *   name: 'email.welcome',
 *   schema: z.object({
 *     userId: z.string().uuid(),
 *     email: z.string().email(),
 *   }),
 *   handler: async ({ data, progress }) => {
 *     await progress(10);
 *     const user = await db.user.findUnique({ where: { id: data.userId } });
 *     await progress(50);
 *     await sendEmail(data.email, 'Welcome!', user);
 *     await progress(100);
 *   },
 *   options: {
 *     attempts: 5,
 *     backoff: { type: 'exponential', delay: 2000 },
 *   },
 * });
 * ```
 */
export function defineJob<TSchema extends z.ZodType>(
  config: JobDefinitionConfig<TSchema>
): JobDefinition<TSchema> {
  validateJobName(config.name);

  const mergedOptions: JobOptions = {
    ...DEFAULT_JOB_OPTIONS,
    ...config.options,
  };

  return {
    name: config.name,
    schema: config.schema,
    handler: config.handler,
    options: mergedOptions,
    queue: config.queue ?? 'default',
  };
}

/**
 * Alias for defineJob.
 */
export const job = defineJob;
