/**
 * useFormAction Hook
 *
 * React hook for form-based server actions with progressive enhancement.
 * Works with HTML forms for no-JS fallback, enhanced with JS when available.
 *
 * @module @veloxts/web/client/use-form-action
 */

'use client';

import { useCallback, useRef, useState, useTransition } from 'react';

import type { ActionError, ActionResult } from '../types/actions.js';

// ============================================================================
// Types
// ============================================================================

/**
 * State returned by useFormAction hook
 */
export interface UseFormActionState<TOutput> {
  /** The data from the last successful submission */
  data: TOutput | null;
  /** The error from the last failed submission */
  error: ActionError['error'] | null;
  /** Whether a form submission is in progress */
  isPending: boolean;
  /** Whether the form has been submitted at least once */
  isSubmitted: boolean;
  /** Whether the last submission was successful */
  isSuccess: boolean;
  /** Whether the last submission failed */
  isError: boolean;
}

/**
 * Return type of useFormAction hook
 */
export interface UseFormActionReturn<TOutput> extends UseFormActionState<TOutput> {
  /** Form action handler for use in form's action prop */
  formAction: (formData: FormData) => Promise<void>;
  /** Submit the form programmatically */
  submit: (formData: FormData) => Promise<ActionResult<TOutput>>;
  /** Reset the state and optionally the form */
  reset: (form?: HTMLFormElement | null) => void;
  /** Ref to attach to form for programmatic reset */
  formRef: React.RefObject<HTMLFormElement | null>;
}

/**
 * Options for useFormAction hook
 */
export interface UseFormActionOptions<TOutput> {
  /**
   * Callback when form submission succeeds
   */
  onSuccess?: (data: TOutput) => void;

  /**
   * Callback when form submission fails
   */
  onError?: (error: ActionError['error']) => void;

  /**
   * Callback when form submission completes
   */
  onSettled?: (data: TOutput | null, error: ActionError['error'] | null) => void;

  /**
   * Reset the form after successful submission
   * @default false
   */
  resetOnSuccess?: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook for form-based server actions.
 *
 * Provides progressive enhancement:
 * - Works without JavaScript (form POSTs to server)
 * - Enhanced with JavaScript (async submission with state)
 *
 * @example
 * ```tsx
 * 'use client';
 *
 * import { useFormAction } from '@veloxts/web/client';
 * import { createUser } from '@/actions/users';
 *
 * export function CreateUserForm() {
 *   const {
 *     formAction,
 *     formRef,
 *     isPending,
 *     error,
 *     data,
 *     reset,
 *   } = useFormAction(createUser, {
 *     onSuccess: (user) => {
 *       console.log('User created:', user);
 *     },
 *     resetOnSuccess: true,
 *   });
 *
 *   return (
 *     <form ref={formRef} action={formAction}>
 *       <input name="name" required />
 *       <input name="email" type="email" required />
 *
 *       <button type="submit" disabled={isPending}>
 *         {isPending ? 'Creating...' : 'Create User'}
 *       </button>
 *
 *       <button type="button" onClick={() => reset()}>
 *         Clear
 *       </button>
 *
 *       {error && <p className="error">{error.message}</p>}
 *       {data && <p className="success">Created: {data.name}</p>}
 *     </form>
 *   );
 * }
 * ```
 *
 * @example Progressive Enhancement (No JS Fallback)
 * ```tsx
 * // When JavaScript is disabled, the form still works!
 * // The form action URL will POST to the server action endpoint.
 * // The server will process the FormData and respond appropriately.
 * ```
 */
export function useFormAction<TOutput>(
  action: (formData: FormData) => Promise<ActionResult<TOutput>>,
  options?: UseFormActionOptions<TOutput>
): UseFormActionReturn<TOutput> {
  const { onSuccess, onError, onSettled, resetOnSuccess = false } = options ?? {};

  // Use React's useTransition for pending state
  const [isPending, startTransition] = useTransition();

  // Form ref for programmatic reset
  const formRef = useRef<HTMLFormElement>(null);

  // State
  const [data, setData] = useState<TOutput | null>(null);
  const [error, setError] = useState<ActionError['error'] | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

  /**
   * Reset state and optionally the form
   */
  const reset = useCallback((form?: HTMLFormElement | null) => {
    setData(null);
    setError(null);
    setIsSubmitted(false);
    setIsSuccess(false);
    setIsError(false);

    // Reset the form if provided or use the ref
    const targetForm = form ?? formRef.current;
    targetForm?.reset();
  }, []);

  /**
   * Submit form data and get result
   */
  const submit = useCallback(
    async (formData: FormData): Promise<ActionResult<TOutput>> => {
      return new Promise((resolve) => {
        startTransition(async () => {
          setIsSubmitted(true);
          setError(null);

          const result = await action(formData);

          if (result.success) {
            setData(result.data);
            setError(null);
            setIsSuccess(true);
            setIsError(false);
            onSuccess?.(result.data);
            onSettled?.(result.data, null);

            // Reset form if option is set
            if (resetOnSuccess) {
              formRef.current?.reset();
            }
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
    [action, onSuccess, onError, onSettled, resetOnSuccess]
  );

  /**
   * Form action handler for use with form's action prop
   */
  const formAction = useCallback(
    async (formData: FormData): Promise<void> => {
      await submit(formData);
    },
    [submit]
  );

  return {
    data,
    error,
    isPending,
    isSubmitted,
    isSuccess,
    isError,
    formAction,
    submit,
    reset,
    formRef,
  };
}

/**
 * Type helper to extract the output type from an action function
 */
export type InferFormActionOutput<T> = T extends (
  formData: FormData
) => Promise<ActionResult<infer O>>
  ? O
  : never;
