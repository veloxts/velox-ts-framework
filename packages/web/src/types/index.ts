/**
 * @veloxts/web/types
 *
 * Browser-safe type definitions for VeloxTS web applications.
 * These types can be safely imported in both client and server contexts.
 *
 * @example
 * ```typescript
 * // In a client component
 * import type { ActionResult, PageProps } from '@veloxts/web/types';
 *
 * interface Props {
 *   onSubmit: (data: FormData) => Promise<ActionResult<User>>;
 * }
 * ```
 *
 * @packageDocumentation
 */

// Action types (browser-safe)
export type {
  ActionError,
  ActionErrorCode,
  ActionResult,
  ActionSuccess,
} from './actions.js';
// Routing types (browser-safe)
export type {
  DocumentProps,
  ErrorProps,
  FormAction,
  LayoutComponent,
  LayoutConfig,
  LayoutMode,
  LayoutProps,
  LoadingProps,
  NotFoundProps,
  PageConfig,
  PageProps,
  ServerAction,
  SpecialPageType,
} from './routing.js';
