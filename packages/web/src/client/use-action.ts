/**
 * useAction Hook
 *
 * React hook for calling server actions with state management.
 * Provides pending state, error handling, and data access.
 *
 * @module @veloxts/web/client/use-action
 */

'use client';

import { useCallback, useState, useTransition } from 'react';

import type { ActionError, ActionResult } from '../types/actions.js';

// ============================================================================
// Types
// ============================================================================

/**
 * State returned by useAction hook
 */
export interface UseActionState<TOutput> {
  /** The data from the last successful action call */
  data: TOutput | null;
  /** The error from the last failed action call */
  error: ActionError['error'] | null;
  /** Whether an action is currently executing */
  isPending: boolean;
  /** Whether the action has been called at least once */
  isIdle: boolean;
  /** Whether the last call was successful */
  isSuccess: boolean;
  /** Whether the last call failed */
  isError: boolean;
}

/**
 * Return type of useAction hook
 */
export interface UseActionReturn<TInput, TOutput> extends UseActionState<TOutput> {
  /** Execute the action with the given input */
  mutate: (input: TInput) => Promise<ActionResult<TOutput>>;
  /** Execute the action and return only the data (throws on error) */
  mutateAsync: (input: TInput) => Promise<TOutput>;
  /** Reset the state to initial values */
  reset: () => void;
}

/**
 * Options for useAction hook
 */
export interface UseActionOptions<TOutput> {
  /**
   * Callback when action succeeds
   */
  onSuccess?: (data: TOutput) => void;

  /**
   * Callback when action fails
   */
  onError?: (error: ActionError['error']) => void;

  /**
   * Callback when action completes (success or failure)
   */
  onSettled?: (data: TOutput | null, error: ActionError['error'] | null) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook for calling server actions with state management.
 *
 * Provides:
 * - Pending state during action execution
 * - Error state for failed actions
 * - Data state for successful results
 * - Callbacks for success, error, and settled states
 *
 * @example
 * ```tsx
 * 'use client';
 *
 * import { useAction } from '@veloxts/web/client';
 * import { createUser } from '@/actions/users';
 *
 * export function CreateUserForm() {
 *   const { mutate, isPending, error, data } = useAction(createUser, {
 *     onSuccess: (user) => {
 *       console.log('User created:', user);
 *     },
 *     onError: (error) => {
 *       console.error('Failed:', error.message);
 *     },
 *   });
 *
 *   return (
 *     <form onSubmit={(e) => {
 *       e.preventDefault();
 *       const formData = new FormData(e.currentTarget);
 *       mutate({
 *         name: formData.get('name') as string,
 *         email: formData.get('email') as string,
 *       });
 *     }}>
 *       <input name="name" required />
 *       <input name="email" type="email" required />
 *       <button type="submit" disabled={isPending}>
 *         {isPending ? 'Creating...' : 'Create User'}
 *       </button>
 *       {error && <p className="error">{error.message}</p>}
 *       {data && <p className="success">Created: {data.name}</p>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useAction<TInput, TOutput>(
  action: (input: TInput) => Promise<ActionResult<TOutput>>,
  options?: UseActionOptions<TOutput>
): UseActionReturn<TInput, TOutput> {
  const { onSuccess, onError, onSettled } = options ?? {};

  // Use React's useTransition for pending state
  const [isPending, startTransition] = useTransition();

  // State
  const [data, setData] = useState<TOutput | null>(null);
  const [error, setError] = useState<ActionError['error'] | null>(null);
  const [isIdle, setIsIdle] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

  /**
   * Reset state to initial values
   */
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsIdle(true);
    setIsSuccess(false);
    setIsError(false);
  }, []);

  /**
   * Execute the action with state management
   */
  const mutate = useCallback(
    async (input: TInput): Promise<ActionResult<TOutput>> => {
      return new Promise((resolve) => {
        startTransition(async () => {
          setIsIdle(false);
          setError(null);

          const result = await action(input);

          if (result.success) {
            setData(result.data);
            setError(null);
            setIsSuccess(true);
            setIsError(false);
            onSuccess?.(result.data);
            onSettled?.(result.data, null);
          } else {
            setData(null);
            setError(result.error);
            setIsSuccess(false);
            setIsError(true);
            onError?.(result.error);
            onSettled?.(null, result.error);
          }

          resolve(result);
        });
      });
    },
    [action, onSuccess, onError, onSettled]
  );

  /**
   * Execute the action and return data directly (throws on error)
   */
  const mutateAsync = useCallback(
    async (input: TInput): Promise<TOutput> => {
      const result = await mutate(input);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    [mutate]
  );

  return {
    data,
    error,
    isPending,
    isIdle,
    isSuccess,
    isError,
    mutate,
    mutateAsync,
    reset,
  };
}
