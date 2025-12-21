/**
 * Client-Side Hooks for Server Actions
 *
 * React hooks for consuming server actions with state management,
 * pending states, and form integration.
 *
 * @module @veloxts/web/client
 */

'use client';

export type {
  UseActionOptions,
  UseActionReturn,
  UseActionState,
} from './use-action.js';
export { useAction } from './use-action.js';
export type {
  InferFormActionOutput,
  UseFormActionOptions,
  UseFormActionReturn,
  UseFormActionState,
} from './use-form-action.js';
export { useFormAction } from './use-form-action.js';
