/**
 * User Schemas
 *
 * Uses withTimestamps() for automatic Date → string serialization.
 * No manual transformation needed in procedure handlers.
 */

import { createIdSchema, emailSchema, withTimestamps, z } from '@veloxts/velox';

// Business fields only - timestamps added separately
const UserFields = z.object({
  id: createIdSchema('uuid'),
  name: z.string().min(1).max(100),
  email: emailSchema,
});

// Complete schema with automatic Date → string serialization
export const UserSchema = withTimestamps(UserFields);

export type User = z.infer<typeof UserSchema>;

export const CreateUserInput = z.object({
  name: z.string().min(1).max(100),
  email: emailSchema,
});

export type CreateUserData = z.infer<typeof CreateUserInput>;

export const UpdateUserInput = z.object({
  name: z.string().min(1).max(100).optional(),
  email: emailSchema.optional(),
});

export type UpdateUserData = z.infer<typeof UpdateUserInput>;
