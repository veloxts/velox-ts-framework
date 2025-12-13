/**
 * Typed Procedure Factory
 *
 * Creates a procedure builder bound to a specific context type,
 * eliminating the need to specify context on each procedure.
 *
 * @module procedure/factory
 */

import type { BaseContext } from '@veloxts/core';

import { procedure } from './builder.js';
import type { ProcedureBuilder } from './types.js';

/**
 * Creates a procedure factory bound to your application's context type
 *
 * Use this to avoid repeating context types on every procedure definition.
 * Define once in your procedures index, use everywhere.
 *
 * @example
 * ```typescript
 * // In api/procedures/index.ts
 * import { createProcedure } from '@veloxts/router';
 * import type { AppContext } from '../context.js';
 *
 * // Create typed procedure factory
 * export const p = createProcedure<AppContext>();
 *
 * // In api/procedures/users.ts
 * import { defineProcedures } from '@veloxts/router';
 * import { p } from './index.js';
 *
 * export const userProcedures = defineProcedures('users', {
 *   getUser: p()  // ctx is typed as AppContext
 *     .input(z.object({ id: z.string() }))
 *     .query(async ({ ctx }) => {
 *       // ctx.db is PrismaClient with full autocomplete
 *       return ctx.db.user.findUnique({ where: { id: input.id } });
 *     }),
 * });
 * ```
 *
 * @template TContext - Your application's context type
 * @returns A function that creates ProcedureBuilders with the bound context type
 */
export function createProcedure<TContext extends BaseContext>(): () => ProcedureBuilder<
  unknown,
  unknown,
  TContext
> {
  // Cast through unknown to handle variance issues between BaseContext and TContext
  // This is safe because TContext extends BaseContext and the runtime behavior is identical
  return () => procedure() as unknown as ProcedureBuilder<unknown, unknown, TContext>;
}

/**
 * Alias for createProcedure with shorter name
 *
 * @example
 * ```typescript
 * import { typedProcedure } from '@veloxts/router';
 * import type { AppContext } from '../context.js';
 *
 * export const p = typedProcedure<AppContext>();
 * ```
 */
export const typedProcedure = createProcedure;
