/**
 * Routing Type Definitions (Browser-Safe)
 *
 * Types for pages, layouts, and routing that are safe to import
 * in both client and server contexts.
 *
 * @module @veloxts/web/types/routing
 */

import type { ComponentType, ReactNode } from 'react';

/**
 * Props passed to page components
 * @public
 */
export interface PageProps<TParams = Record<string, string>> {
  /**
   * Route parameters extracted from URL
   */
  params: TParams;

  /**
   * Search parameters from query string
   */
  searchParams: Record<string, string | string[]>;
}

/**
 * Props passed to layout components
 * @public
 */
export interface LayoutProps {
  /**
   * Child content to render
   */
  children: ReactNode;

  /**
   * Route parameters (available in nested layouts)
   */
  params?: Record<string, string>;
}

/**
 * Layout component type for page configuration
 * @public
 */
export type LayoutComponent = ComponentType<LayoutProps>;

/**
 * Layout configuration modes for per-route customization
 * @public
 */
export type LayoutMode =
  | 'inherit' // Use layouts from groups and segments (default)
  | 'replace' // Replace all layouts with specified ones
  | 'prepend' // Add layouts before inherited ones
  | 'append'; // Add layouts after inherited ones

/**
 * Per-route layout configuration
 *
 * Pages can export this to customize their layout chain.
 *
 * @example
 * ```tsx
 * // Replace all inherited layouts
 * export const layoutConfig: LayoutConfig = {
 *   layouts: [MinimalLayout],
 *   mode: 'replace',
 * };
 *
 * // Add a layout after inherited ones
 * export const layoutConfig: LayoutConfig = {
 *   layouts: [SidebarLayout],
 *   mode: 'append',
 * };
 *
 * // Disable all layouts (render page directly)
 * export const layoutConfig: LayoutConfig = {
 *   layouts: [],
 *   mode: 'replace',
 * };
 * ```
 *
 * @public
 */
export interface LayoutConfig {
  /**
   * Layout components to use
   */
  layouts: LayoutComponent[];

  /**
   * How to combine with inherited layouts
   * @default 'inherit'
   */
  mode?: LayoutMode;
}

/**
 * Page configuration export
 *
 * Pages can export this to customize routing behavior.
 *
 * @example
 * ```tsx
 * // pages/admin/dashboard.tsx
 * import { AdminLayout, DashboardLayout } from '../../layouts';
 *
 * export const config: PageConfig = {
 *   layout: {
 *     layouts: [AdminLayout, DashboardLayout],
 *     mode: 'replace',
 *   },
 * };
 *
 * export default function DashboardPage() {
 *   return <div>Dashboard</div>;
 * }
 * ```
 *
 * @public
 */
export interface PageConfig {
  /**
   * Layout configuration for this page
   */
  layout?: LayoutConfig;
}

/**
 * Props passed to not-found (404) page
 * @public
 */
export interface NotFoundProps {
  /**
   * The path that was not found
   */
  pathname: string;
}

/**
 * Props passed to loading page/component
 * @public
 */
export interface LoadingProps {
  /**
   * Optional message to display
   */
  message?: string;
}

/**
 * Props passed to error boundary components
 * @public
 */
export interface ErrorProps {
  /**
   * The error that was thrown
   */
  error: Error;

  /**
   * Function to retry rendering
   */
  reset: () => void;
}

/**
 * Document component props for HTML wrapper
 * @public
 */
export interface DocumentProps {
  /**
   * Content to render in <head>
   */
  head?: ReactNode;

  /**
   * Main page content
   */
  children: ReactNode;

  /**
   * Bootstrap scripts to include
   */
  scripts?: string[];

  /**
   * Initial data for hydration
   */
  initialData?: unknown;

  /**
   * Document language
   * @default 'en'
   */
  lang?: string;
}

/**
 * Server action function type
 * @public
 */
export type ServerAction<TInput = unknown, TOutput = unknown> = (input: TInput) => Promise<TOutput>;

/**
 * Server action with form data support
 * @public
 */
export type FormAction<TOutput = unknown> = (formData: FormData) => Promise<TOutput>;

/**
 * Special page types for error handling
 * @public
 */
export type SpecialPageType = 'not-found' | 'error' | 'loading';
