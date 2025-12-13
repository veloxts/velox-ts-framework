/**
 * Serialization Utilities for API Responses
 *
 * Provides type-safe Date → string transformation that works with
 * Zod's output validation in the procedure system.
 *
 * @module schemas/serialization
 */

import { type ZodObject, type ZodRawShape, z } from 'zod';

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Recursively transforms Date properties to string in a type
 *
 * This utility type mirrors the runtime transformation that happens
 * when dates pass through Zod transforms.
 *
 * @example
 * ```typescript
 * import type { Prisma } from '@prisma/client';
 *
 * type DbUser = Prisma.UserGetPayload<{}>;
 * // { id: string; name: string; createdAt: Date; updatedAt: Date }
 *
 * type ApiUser = SerializedDates<DbUser>;
 * // { id: string; name: string; createdAt: string; updatedAt: string }
 * ```
 */
export type SerializedDates<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Array<SerializedDates<U>>
    : T extends object
      ? { [K in keyof T]: SerializedDates<T[K]> }
      : T;

/**
 * Makes specified keys optional (useful for create inputs)
 */
export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Omits timestamp fields from a type (useful for create/update inputs)
 */
export type OmitTimestamps<T> = Omit<T, 'createdAt' | 'updatedAt' | 'deletedAt'>;

// ============================================================================
// Date Field Helpers
// ============================================================================

/**
 * Creates a date field that serializes to ISO string
 *
 * Use in output schemas. Accepts Date objects from Prisma
 * and transforms them to ISO strings for JSON responses.
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({
 *   id: z.string().uuid(),
 *   createdAt: dateToISOString(),
 *   updatedAt: dateToISOString(),
 * });
 * ```
 */
export function dateToISOString() {
  return z.coerce.date().transform((date) => date.toISOString());
}

/**
 * Creates a nullable date field that serializes to ISO string or null
 */
export function dateToISOStringNullable() {
  return z.coerce
    .date()
    .nullable()
    .transform((date) => (date ? date.toISOString() : null));
}

/**
 * Creates an optional date field that serializes to ISO string or undefined
 */
export function dateToISOStringOptional() {
  return z.coerce
    .date()
    .optional()
    .transform((date) => (date ? date.toISOString() : undefined));
}

// ============================================================================
// Timestamp Schema Presets
// ============================================================================

/**
 * Standard timestamp fields for entities
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({
 *   id: z.string().uuid(),
 *   name: z.string(),
 * }).merge(timestamps);
 * ```
 */
export const timestamps = z.object({
  createdAt: dateToISOString(),
  updatedAt: dateToISOString(),
});

/**
 * Timestamp fields with soft delete support
 */
export const timestampsWithSoftDelete = z.object({
  createdAt: dateToISOString(),
  updatedAt: dateToISOString(),
  deletedAt: dateToISOStringNullable(),
});

// ============================================================================
// Entity Schema Factory
// ============================================================================

/**
 * Configuration for withTimestamps
 */
interface TimestampConfig {
  /** Include createdAt (default: true) */
  createdAt?: boolean;
  /** Include updatedAt (default: true) */
  updatedAt?: boolean;
  /** Include deletedAt for soft deletes (default: false) */
  deletedAt?: boolean;
}

/**
 * Extends a Zod object schema with timestamp fields
 *
 * This is the primary way to add serialized timestamps to entity schemas.
 * Timestamps are automatically transformed from Date to ISO string.
 *
 * @example
 * ```typescript
 * // Define business fields
 * const UserFields = z.object({
 *   id: z.string().uuid(),
 *   name: z.string(),
 *   email: z.string().email(),
 * });
 *
 * // Add timestamps (createdAt, updatedAt as strings)
 * export const UserSchema = withTimestamps(UserFields);
 *
 * // With soft delete
 * export const UserSchema = withTimestamps(UserFields, { deletedAt: true });
 *
 * // Without updatedAt
 * export const UserSchema = withTimestamps(UserFields, { updatedAt: false });
 * ```
 */
export function withTimestamps<T extends ZodRawShape>(
  schema: ZodObject<T>,
  config: TimestampConfig = {}
): ZodObject<T & typeof timestampShape> {
  const { createdAt = true, updatedAt = true, deletedAt = false } = config;

  const extensions: ZodRawShape = {};

  if (createdAt) {
    extensions.createdAt = dateToISOString();
  }
  if (updatedAt) {
    extensions.updatedAt = dateToISOString();
  }
  if (deletedAt) {
    extensions.deletedAt = dateToISOStringNullable();
  }

  return schema.extend(extensions) as ZodObject<T & typeof timestampShape>;
}

// Type helper for withTimestamps return type inference
const timestampShape = {
  createdAt: dateToISOString(),
  updatedAt: dateToISOString(),
};

/**
 * Type helper to infer the output type of a schema with timestamps
 */
export type InferWithTimestamps<T extends ZodObject<ZodRawShape>> = z.infer<
  ReturnType<typeof withTimestamps<T['shape']>>
>;
