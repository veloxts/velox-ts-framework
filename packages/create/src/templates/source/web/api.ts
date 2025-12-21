/**
 * VeloxTS API Hooks
 *
 * This file creates typed hooks for accessing your backend procedures.
 * Import `api` in your components for full autocomplete support.
 *
 * NOTE: The AppRouter type is imported from the API at BUILD time only.
 * During development, Vite's hot reload works without needing the full
 * type chain, and TypeScript provides type checking separately.
 *
 * @example
 * ```tsx
 * import { api } from '@/api';
 * import { useQueryClient } from '@veloxts/client/react';
 *
 * function UserProfile({ userId }: { userId: string }) {
 *   const queryClient = useQueryClient();
 *
 *   const { data: user } = api.users.getUser.useQuery({ id: userId });
 *   const { mutate } = api.users.updateUser.useMutation({
 *     onSuccess: () => api.users.getUser.invalidate({ id: userId }, queryClient),
 *   });
 * }
 * ```
 */

import { createVeloxHooks } from '@veloxts/client/react';

/**
 * AppRouter type imported from the API.
 *
 * This uses TypeScript's import() type syntax which is erased at runtime.
 * The actual type comes from the API's router.ts file.
 */
type AppRouter = import('../../api/src/router.js').AppRouter;

/**
 * Type-safe API hooks with full autocomplete
 *
 * Hooks (call inside components):
 * - api.namespace.procedure.useQuery(input, options)
 * - api.namespace.procedure.useMutation(options)
 * - api.namespace.procedure.useSuspenseQuery(input, options)
 *
 * Cache utilities (input first, queryClient last):
 * - api.namespace.procedure.getQueryKey(input)
 * - api.namespace.procedure.invalidate(input, queryClient)
 * - api.namespace.procedure.prefetch(input, queryClient)
 * - api.namespace.procedure.getData(input, queryClient)
 * - api.namespace.procedure.setData(input, data, queryClient)
 */
export const api = createVeloxHooks<AppRouter>();
