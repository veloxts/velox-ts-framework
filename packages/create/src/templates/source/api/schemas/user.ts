/**
 * User Schemas
 */

import { createIdSchema, emailSchema, z } from '@veloxts/velox';

export const UserSchema = z.object({
  id: createIdSchema('uuid'),
  name: z.string().min(1).max(100),
  email: emailSchema,
  createdAt: z.coerce.date().transform((d) => d.toISOString()),
  updatedAt: z.coerce.date().transform((d) => d.toISOString()),
});

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
