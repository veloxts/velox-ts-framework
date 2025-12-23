/**
 * Task Generator
 *
 * Scaffolds scheduled task files for VeloxTS applications.
 *
 * Usage:
 *   velox make task <name> [options]
 *
 * Examples:
 *   velox make task cleanup-tokens          # Simple daily task
 *   velox make task send-digest --callbacks # Task with success/failure callbacks
 *   velox make task backup-db --no-overlap  # Task that prevents overlapping runs
 *   velox make task report --constraints    # Task with time/day constraints
 */

import { BaseGenerator } from '../base.js';
import {
  getTaskInstructions,
  getTaskPath,
  type TaskOptions,
  taskTemplate,
} from '../templates/task.js';
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
 * Task generator - creates scheduled task files
 */
export class TaskGenerator extends BaseGenerator<TaskOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'task',
    description: 'Generate scheduled task definitions',
    longDescription: `
Scaffold scheduled task definitions for VeloxTS applications.

Tasks are background operations that run on a cron-like schedule using the
@veloxts/scheduler package. They support fluent scheduling, constraints,
overlap prevention, and success/failure callbacks.

Examples:
  velox make task cleanup-tokens          # Simple daily task
  velox make task send-digest --callbacks # Task with success/failure callbacks
  velox make task backup-db --no-overlap  # Task that prevents overlapping runs
  velox make task report --constraints    # Task with time/day constraints
`,
    aliases: ['scheduled-task', 'cron'],
    category: 'infrastructure',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'callbacks',
      short: 'c',
      description: 'Generate task with onSuccess/onFailure callbacks',
      type: 'boolean',
      default: false,
    },
    {
      name: 'constraints',
      short: 't',
      description: 'Generate task with time/day constraints',
      type: 'boolean',
      default: false,
    },
    {
      name: 'no-overlap',
      short: 'n',
      description: 'Generate task with overlap prevention',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): TaskOptions {
    return {
      callbacks: Boolean(raw.callbacks ?? false),
      constraints: Boolean(raw.constraints ?? false),
      noOverlap: Boolean(raw['no-overlap'] ?? raw.noOverlap ?? false),
    };
  }

  /**
   * Generate task files
   */
  async generate(config: GeneratorConfig<TaskOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const files: GeneratedFile[] = [];

    // Generate task file
    const taskContent = taskTemplate(context);
    files.push({
      path: getTaskPath(config.entityName, config.project),
      content: taskContent,
    });

    return {
      files,
      postInstructions: getTaskInstructions(config.entityName, config.options),
    };
  }
}

/**
 * Factory function for creating a TaskGenerator instance
 */
export function createTaskGenerator(): TaskGenerator {
  return new TaskGenerator();
}
