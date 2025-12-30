'use server';

/**
 * Post Server Actions - Procedure Bridge Pattern
 *
 * Demonstrates the VeloxTS procedure bridge, which allows server actions
 * to reuse procedure validation, guards, and business logic.
 *
 * This pattern bridges the gap between:
 * - Procedures (API logic with validation and guards)
 * - Server Actions (form submissions and direct calls)
 *
 * Benefits:
 * - Single source of truth for validation (Zod schemas in procedures)
 * - Reuse of business logic across REST API and server actions
 * - Type safety flows from procedure to action
 *
 * @example
 * ```tsx
 * // In a server component
 * import { createPost } from '@/actions/posts';
 *
 * // Call directly with typed input
 * const result = await createPost({
 *   userId: '123',
 *   title: 'My Post',
 *   content: 'Content here',
 * });
 *
 * // Or use in a form
 * <form action={createPost}>
 *   <input name="title" />
 *   <button type="submit">Create</button>
 * </form>
 * ```
 */

import { action } from '@veloxts/web/server';

import { postProcedures } from '@/api/procedures/posts';

// ============================================================================
// Procedure-Bridged Actions
// ============================================================================

/**
 * Creates a new post for a user.
 *
 * This action bridges to the createPost procedure, reusing:
 * - Input validation (CreatePostSchema)
 * - Output validation (PostSchema)
 * - Parent resource validation (.parent('users'))
 * - Any guards or middleware defined on the procedure
 *
 * The procedure's REST endpoint is: POST /api/users/:userId/posts
 */
export const createPost = action.fromProcedure(postProcedures.procedures.createPost, {
  parseFormData: true,
});

/**
 * Gets a specific post.
 *
 * Bridges to getPost procedure which validates:
 * - userId: UUID format
 * - id: UUID format (post ID)
 */
export const getPost = action.fromProcedure(postProcedures.procedures.getPost);

/**
 * Updates an existing post.
 *
 * Bridges to updatePost procedure which validates:
 * - userId and id must exist
 * - Only title and content can be updated
 */
export const updatePost = action.fromProcedure(postProcedures.procedures.updatePost, {
  parseFormData: true,
});

/**
 * Deletes a post.
 *
 * Bridges to deletePost procedure.
 */
export const deletePost = action.fromProcedure(postProcedures.procedures.deletePost);

/**
 * Lists all posts for a user.
 *
 * Bridges to listPosts procedure.
 */
export const listPosts = action.fromProcedure(postProcedures.procedures.listPosts);
