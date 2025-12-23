/**
 * Validation Schemas
 *
 * Zod schemas for validating request bodies and WebSocket messages.
 */

import { z } from 'zod';

import type { PresenceMember } from './types.js';

// =============================================================================
// Presence Member Schema
// =============================================================================

/**
 * Presence member schema for channel subscriptions.
 */
export const PresenceMemberSchema = z.object({
  id: z.string().min(1, 'Member ID is required'),
  info: z.record(z.unknown()).optional(),
}) satisfies z.ZodType<PresenceMember>;

// =============================================================================
// SSE Endpoint Schemas
// =============================================================================

/**
 * Schema for SSE subscribe endpoint.
 * POST /events/subscribe
 */
export const SseSubscribeBodySchema = z.object({
  connectionId: z.string().min(1, 'Connection ID is required'),
  channel: z.string().min(1, 'Channel name is required'),
  member: PresenceMemberSchema.optional(),
});

export type SseSubscribeBody = z.infer<typeof SseSubscribeBodySchema>;

/**
 * Schema for SSE unsubscribe endpoint.
 * POST /events/unsubscribe
 */
export const SseUnsubscribeBodySchema = z.object({
  connectionId: z.string().min(1, 'Connection ID is required'),
  channel: z.string().min(1, 'Channel name is required'),
});

export type SseUnsubscribeBody = z.infer<typeof SseUnsubscribeBodySchema>;

// =============================================================================
// WebSocket Endpoint Schemas
// =============================================================================

/**
 * Schema for WebSocket auth endpoint.
 * POST /ws/auth
 */
export const WsAuthBodySchema = z.object({
  socketId: z.string().min(1, 'Socket ID is required'),
  channel: z.string().min(1, 'Channel name is required'),
});

export type WsAuthBody = z.infer<typeof WsAuthBodySchema>;

// =============================================================================
// WebSocket Client Message Schemas
// =============================================================================

/**
 * Schema for WebSocket client messages.
 * Uses discriminated union for type-safe message handling.
 */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('subscribe'),
    channel: z.string().min(1),
    auth: z.string().optional(),
    channelData: z.string().optional(),
    data: PresenceMemberSchema.optional(),
  }),
  z.object({
    type: z.literal('unsubscribe'),
    channel: z.string().min(1),
  }),
  z.object({
    type: z.literal('ping'),
  }),
  z.object({
    type: z.literal('message'),
    channel: z.string().min(1),
    event: z.string().min(1),
    data: z.unknown().optional(),
  }),
]);

export type ValidatedClientMessage = z.infer<typeof ClientMessageSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validation result type - discriminated union for type-safe error handling.
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodIssue[] };

/**
 * Validate request body against a Zod schema.
 * Returns a discriminated union for type-safe error handling.
 *
 * @template TSchema - The Zod schema type
 */
export function validateBody<TSchema extends z.ZodTypeAny>(
  body: unknown,
  schema: TSchema
): ValidationResult<z.infer<TSchema>> {
  const result = schema.safeParse(body);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error.issues };
}

/**
 * Format Zod validation errors for API response.
 */
export function formatValidationErrors(errors: z.ZodIssue[]): {
  error: string;
  details: Array<{ path: string; message: string }>;
} {
  return {
    error: 'Validation failed',
    details: errors.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}
