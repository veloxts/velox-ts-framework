/**
 * Job Generator
 *
 * Scaffolds background job files for VeloxTS applications.
 *
 * Usage:
 *   velox make job <name> [options]
 *
 * Examples:
 *   velox make job send-email              # Simple job
 *   velox make job process-payment --queue # Job with custom queue
 *   velox make job import-data --retry     # Job with retry configuration
 *   velox make job batch-export --progress # Job with progress tracking
 */

import { BaseGenerator } from '../base.js';
import { getJobInstructions, getJobPath, type JobOptions, jobTemplate } from '../templates/job.js';
import type {
  GeneratedFile,
  GeneratorConfig,
  GeneratorMetadata,
  GeneratorOption,
  GeneratorOutput,
} from '../types.js';

// ============================================================================
// Generator Implementation
// ============================================================================

/**
 * Job generator - creates background job files
 */
export class JobGenerator extends BaseGenerator<JobOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'job',
    description: 'Generate background job definitions',
    longDescription: `
Scaffold background job definitions for VeloxTS applications.

Jobs are background tasks that run asynchronously using the @veloxts/queue package.
They support retry logic, progress tracking, and custom queue assignment.

Examples:
  velox make job send-email              # Simple job
  velox make job process-payment --queue # Job with custom queue
  velox make job import-data --retry     # Job with retry configuration
  velox make job batch-export --progress # Job with progress tracking
`,
    aliases: ['j'],
    category: 'infrastructure',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'queue',
      short: 'q',
      description: 'Generate job with custom queue assignment',
      type: 'boolean',
      default: false,
    },
    {
      name: 'retry',
      short: 'r',
      description: 'Generate job with retry/backoff configuration',
      type: 'boolean',
      default: false,
    },
    {
      name: 'progress',
      short: 'p',
      description: 'Generate job with progress tracking',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): JobOptions {
    return {
      queue: Boolean(raw.queue ?? false),
      retry: Boolean(raw.retry ?? false),
      progress: Boolean(raw.progress ?? false),
    };
  }

  /**
   * Generate job files
   */
  async generate(config: GeneratorConfig<JobOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const files: GeneratedFile[] = [];

    // Generate job file
    const jobContent = jobTemplate(context);
    files.push({
      path: getJobPath(config.entityName, config.project),
      content: jobContent,
    });

    return {
      files,
      postInstructions: getJobInstructions(config.entityName, config.options),
    };
  }
}

/**
 * Factory function for creating a JobGenerator instance
 */
export function createJobGenerator(): JobGenerator {
  return new JobGenerator();
}
