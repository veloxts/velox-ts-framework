/**
 * Event Template
 *
 * Generates event-related files for VeloxTS applications.
 */

import type { ProjectContext, TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface EventOptions {
  /** Generate event listener/handler */
  listener: boolean;
  /** Generate channel configuration with authorization */
  channel: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for an event file based on variant
 */
export function getEventPath(
  entityName: string,
  _project: ProjectContext,
  options: EventOptions
): string {
  if (options.listener) {
    return `src/events/listeners/${entityName.toLowerCase()}.ts`;
  }
  if (options.channel) {
    return `src/events/channels/${entityName.toLowerCase()}.ts`;
  }
  // Default: broadcastable event
  return `src/events/${entityName.toLowerCase()}.ts`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate broadcastable event definition
 */
function generateBroadcastEvent(ctx: TemplateContext<EventOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Event
 *
 * Broadcastable event for ${entity.humanReadable} notifications.
 */

import { defineEvent } from '@veloxts/events';
import { z } from 'zod';

// ============================================================================
// Schema
// ============================================================================

const ${entity.pascal}EventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number(),
  // TODO: Add your event payload fields
});

export type ${entity.pascal}EventData = z.infer<typeof ${entity.pascal}EventSchema>;

// ============================================================================
// Event Definition
// ============================================================================

/**
 * ${entity.pascal} event
 *
 * Fired when ${entity.humanReadable} occurs. Can be broadcast to connected clients
 * via WebSocket channels.
 *
 * @example
 * \`\`\`typescript
 * import { ${entity.camel}Event } from '@/events/${entity.kebab}';
 * import { events } from '@/events';
 *
 * // Dispatch event locally
 * await events.dispatch(${entity.camel}Event, {
 *   id: '...',
 *   timestamp: Date.now(),
 * });
 *
 * // Broadcast to specific channel
 * await events.broadcast('user.123', ${entity.camel}Event, {
 *   id: '...',
 *   timestamp: Date.now(),
 * });
 * \`\`\`
 */
export const ${entity.camel}Event = defineEvent({
  name: '${entity.kebab}',
  schema: ${entity.pascal}EventSchema,

  /**
   * Determine which channels should receive this event broadcast.
   * Return an array of channel names to broadcast to.
   */
  broadcastOn: ({ id }) => [
    \`${entity.kebab}.\${id}\`,  // Specific ${entity.humanReadable}
    '${entity.kebab}',          // All ${entity.plural}
  ],

  /**
   * Optional: Transform data before broadcasting to clients.
   * Useful for removing sensitive fields or adding computed properties.
   */
  // broadcastWith: (data) => ({
  //   id: data.id,
  //   timestamp: data.timestamp,
  // }),

  /**
   * Optional: Determine if event should be broadcast.
   * Return false to prevent broadcasting (local event only).
   */
  // shouldBroadcast: ({ id }) => {
  //   // Only broadcast for specific conditions
  //   return true;
  // },
});
`;
}

/**
 * Generate event listener/handler
 */
function generateEventListener(ctx: TemplateContext<EventOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Listener
 *
 * Event listener for handling ${entity.humanReadable} events.
 */

import { defineListener } from '@veloxts/events';
import { z } from 'zod';

// ============================================================================
// Event Schema
// ============================================================================

const ${entity.pascal}EventSchema = z.object({
  id: z.string().uuid(),
  // TODO: Add event payload fields matching your event definition
});

export type ${entity.pascal}EventData = z.infer<typeof ${entity.pascal}EventSchema>;

// ============================================================================
// Listener Definition
// ============================================================================

/**
 * ${entity.pascal} event listener
 *
 * Handles ${entity.humanReadable} events when they are dispatched.
 *
 * @example
 * \`\`\`typescript
 * import { ${entity.camel}Listener } from '@/events/listeners/${entity.kebab}';
 * import { events } from '@/events';
 *
 * // Register listener
 * events.listen('${entity.kebab}', ${entity.camel}Listener);
 *
 * // Or in your event service configuration:
 * const eventService = createEventService({
 *   listeners: {
 *     '${entity.kebab}': [${entity.camel}Listener],
 *   },
 * });
 * \`\`\`
 */
export const ${entity.camel}Listener = defineListener({
  name: '${entity.kebab}-handler',
  schema: ${entity.pascal}EventSchema,

  /**
   * Handle the event
   */
  handler: async ({ data, ctx }) => {
    // TODO: Implement your event handling logic
    // Access database via ctx.db (if ORM plugin registered)
    // Access user context via ctx.user (if auth plugin registered)

    console.log(\`Handling ${entity.humanReadable} event:\`, data.id);

    // Example: Update database
    // await ctx.db.${entity.camel}.update({
    //   where: { id: data.id },
    //   data: { processedAt: new Date() },
    // });

    // Example: Send notification
    // await sendNotification(data.id);

    // Example: Dispatch another event
    // await ctx.events.dispatch(anotherEvent, { ... });
  },

  /**
   * Optional: Determine if this listener should handle the event.
   * Return false to skip handling.
   */
  // shouldHandle: ({ data }) => {
  //   // Only handle specific conditions
  //   return true;
  // },

  /**
   * Optional: Queue configuration for async processing.
   * If provided, listener will be queued instead of executed immediately.
   */
  // queue: {
  //   name: '${entity.kebab}-events',
  //   attempts: 3,
  //   backoff: {
  //     type: 'exponential',
  //     delay: 1000,
  //   },
  // },
});
`;
}

/**
 * Generate channel configuration with authorization
 */
function generateChannel(ctx: TemplateContext<EventOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Channel
 *
 * Channel configuration and authorization for ${entity.humanReadable} events.
 */

import { defineChannel } from '@veloxts/events';
import { z } from 'zod';

// ============================================================================
// Channel Parameters Schema
// ============================================================================

const ${entity.pascal}ChannelParamsSchema = z.object({
  ${entity.camel}Id: z.string().uuid(),
});

export type ${entity.pascal}ChannelParams = z.infer<typeof ${entity.pascal}ChannelParamsSchema>;

// ============================================================================
// Channel Definition
// ============================================================================

/**
 * ${entity.pascal} channel configuration
 *
 * Defines authorization rules and configuration for subscribing to
 * ${entity.humanReadable} events via WebSocket.
 *
 * Channel name pattern: \`${entity.kebab}.{${entity.camel}Id}\`
 *
 * @example
 * \`\`\`typescript
 * // Frontend client subscribing to channel
 * import { socket } from '@/lib/socket';
 *
 * socket.subscribe('${entity.kebab}.123', (event) => {
 *   console.log('Received event:', event);
 * });
 * \`\`\`
 */
export const ${entity.camel}Channel = defineChannel({
  /**
   * Channel name pattern (use {param} for dynamic segments)
   */
  pattern: '${entity.kebab}.{${entity.camel}Id}',

  /**
   * Channel parameters schema for validation
   */
  schema: ${entity.pascal}ChannelParamsSchema,

  /**
   * Authorization logic - determine if user can subscribe to this channel
   *
   * @returns true to allow, false to deny, or throw error for specific messages
   */
  authorize: async ({ params, ctx }) => {
    // TODO: Implement authorization logic

    // Example: Public channel (anyone can subscribe)
    // return true;

    // Example: Authenticated users only
    if (!ctx.user) {
      return false;
    }

    // Example: Check ownership or permissions
    const ${entity.camel} = await ctx.db.${entity.camel}.findUnique({
      where: { id: params.${entity.camel}Id },
    });

    if (!${entity.camel}) {
      return false;
    }

    // Check if user owns the ${entity.humanReadable} or has permission
    return ${entity.camel}.userId === ctx.user.id;

    // Example: Role-based access
    // return ctx.user.role === 'admin' || ${entity.camel}.userId === ctx.user.id;
  },

  /**
   * Optional: Transform channel params before matching
   * Useful for normalizing IDs or adding computed values
   */
  // transform: (params) => ({
  //   ...params,
  //   ${entity.camel}Id: params.${entity.camel}Id.toLowerCase(),
  // }),

  /**
   * Optional: Rate limiting configuration
   * Prevents abuse by limiting subscription attempts
   */
  // rateLimit: {
  //   maxAttempts: 10,
  //   windowMs: 60000, // 1 minute
  // },
});

// ============================================================================
// Public Channel Variant
// ============================================================================

/**
 * Public ${entity.pascal} channel (no authentication required)
 *
 * Use this for public ${entity.humanReadable} updates that don't require authorization.
 *
 * Channel name: \`public.${entity.kebab}\`
 */
export const public${entity.pascal}Channel = defineChannel({
  pattern: 'public.${entity.kebab}',
  schema: z.object({}),

  /**
   * Public channel - anyone can subscribe
   */
  authorize: async () => true,
});
`;
}

// ============================================================================
// Main Template
// ============================================================================

/**
 * Event template function
 */
export const eventTemplate: TemplateFunction<EventOptions> = (ctx) => {
  if (ctx.options.listener) {
    return generateEventListener(ctx);
  }
  if (ctx.options.channel) {
    return generateChannel(ctx);
  }
  // Default: broadcastable event
  return generateBroadcastEvent(ctx);
};

// ============================================================================
// Post-generation Instructions
// ============================================================================

export function getEventInstructions(entityName: string, options: EventOptions): string {
  const lines: string[] = [];

  if (options.listener) {
    lines.push(`Your ${entityName} listener has been created.`, '', 'Next steps:');
    lines.push('  1. Update the Zod schema to match your event payload');
    lines.push('  2. Implement the handler logic');
    lines.push('  3. Register the listener in your event service:');
    lines.push('');
    lines.push("     import { events } from '@/events';");
    lines.push(
      `     import { ${entityName}Listener } from '@/events/listeners/${entityName.toLowerCase()}';`
    );
    lines.push('');
    lines.push(`     events.listen('${entityName.toLowerCase()}', ${entityName}Listener);`);
    lines.push('');
    lines.push('  4. Optional: Configure queue settings for async processing');
  } else if (options.channel) {
    lines.push(`Your ${entityName} channel has been created.`, '', 'Next steps:');
    lines.push('  1. Update the channel pattern and schema for your use case');
    lines.push('  2. Implement authorization logic');
    lines.push('  3. Register the channel in your WebSocket server:');
    lines.push('');
    lines.push("     import { channels } from '@/events';");
    lines.push(
      `     import { ${entityName}Channel } from '@/events/channels/${entityName.toLowerCase()}';`
    );
    lines.push('');
    lines.push(`     channels.register(${entityName}Channel);`);
    lines.push('');
    lines.push('  4. Subscribe from your frontend:');
    lines.push('');
    lines.push("     socket.subscribe('pattern', (event) => { ... });");
  } else {
    lines.push(`Your ${entityName} event has been created.`, '', 'Next steps:');
    lines.push('  1. Update the Zod schema with your event payload fields');
    lines.push('  2. Customize the broadcast channels in broadcastOn()');
    lines.push('  3. Dispatch the event from your procedures:');
    lines.push('');
    lines.push("     import { events } from '@/events';");
    lines.push(`     import { ${entityName}Event } from '@/events/${entityName.toLowerCase()}';`);
    lines.push('');
    lines.push(`     await events.dispatch(${entityName}Event, {`);
    lines.push("       id: '...',");
    lines.push('       timestamp: Date.now(),');
    lines.push('     });');
    lines.push('');
    lines.push('  4. Optional: Add event listeners to handle the event');
    lines.push(`     velox make event ${entityName} --listener`);
  }

  return lines.join('\n');
}
