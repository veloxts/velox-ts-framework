/**
 * VeloxTS API Hooks
 *
 * This file creates typed hooks for accessing your backend procedures.
 * Import `api` in your components for full autocomplete support.
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
 * AppRouter type imported from the type-only router file.
 *
 * The router.types.ts file contains ONLY type imports and declarations,
 * which are completely erased at compile time. This means Vite never
 * scans the @veloxts/* packages when building the frontend.
 */
import type { AppRouter } from '../../api/src/router.types.js';

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
