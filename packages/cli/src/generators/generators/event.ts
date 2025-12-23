/**
 * Event Generator
 *
 * Scaffolds event-related files for VeloxTS applications.
 *
 * Usage:
 *   velox make event <name> [options]
 *
 * Examples:
 *   velox make event user-registered           # Broadcastable event
 *   velox make event order-created --listener  # Event listener
 *   velox make event notifications --channel   # Channel with authorization
 */

import { BaseGenerator } from '../base.js';
import {
  type EventOptions,
  eventTemplate,
  getEventInstructions,
  getEventPath,
} from '../templates/event.js';
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
 * Event generator - creates event-related files
 */
export class EventGenerator extends BaseGenerator<EventOptions> {
  readonly metadata: GeneratorMetadata = {
    name: 'event',
    description: 'Generate event definitions, listeners, and channels',
    longDescription: `
Scaffold event-related files for VeloxTS applications using @veloxts/events.

Events enable real-time communication between backend and frontend, as well as
internal event-driven architecture patterns.

Variants:
  - Broadcast (default): Event definition with WebSocket broadcasting
  - Listener: Event handler for responding to dispatched events
  - Channel: WebSocket channel configuration with authorization

Examples:
  velox make event user-registered           # Broadcastable event
  velox make event order-created --listener  # Event listener
  velox make event notifications --channel   # Channel with authorization
`,
    aliases: ['ev', 'broadcast'],
    category: 'infrastructure',
  };

  readonly options: ReadonlyArray<GeneratorOption> = [
    {
      name: 'listener',
      short: 'l',
      description: 'Generate event listener/handler',
      type: 'boolean',
      default: false,
    },
    {
      name: 'channel',
      short: 'c',
      description: 'Generate channel configuration with authorization',
      type: 'boolean',
      default: false,
    },
  ];

  /**
   * Validate and transform raw options
   */
  validateOptions(raw: Record<string, unknown>): EventOptions {
    const listener = Boolean(raw.listener ?? false);
    const channel = Boolean(raw.channel ?? false);

    // Ensure only one variant is selected
    if (listener && channel) {
      throw new Error(
        'Cannot use both --listener and --channel options. Choose one variant per generator call.'
      );
    }

    return {
      listener,
      channel,
    };
  }

  /**
   * Generate event files
   */
  async generate(config: GeneratorConfig<EventOptions>): Promise<GeneratorOutput> {
    const context = this.createContext(config);
    const files: GeneratedFile[] = [];

    // Generate event file
    const eventContent = eventTemplate(context);
    files.push({
      path: getEventPath(config.entityName, config.project, config.options),
      content: eventContent,
    });

    return {
      files,
      postInstructions: getEventInstructions(config.entityName, config.options),
    };
  }
}

/**
 * Factory function for creating an EventGenerator instance
 */
export function createEventGenerator(): EventGenerator {
  return new EventGenerator();
}
