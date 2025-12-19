/**
 * Client-Side Hydrator for React Server Components
 *
 * Hydrates server-rendered HTML with client-side React.
 * This module runs in the browser and attaches event handlers
 * and interactivity to the server-rendered DOM.
 *
 * @module @veloxts/web/rendering/client-hydrator
 */

import type { ReactNode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';

import { escapeHtml } from '../utils/html.js';

/**
 * Options for client hydration
 */
export interface HydrateOptions {
  /**
   * Root element to hydrate into
   * @default document.getElementById('root')
   */
  rootElement?: HTMLElement | null;

  /**
   * Error handler for recoverable hydration errors
   */
  onRecoverableError?: (error: Error) => void;

  /**
   * Enable strict mode
   * @default true in development
   */
  strictMode?: boolean;
}

/**
 * Result of hydration
 */
export interface HydrateResult {
  /**
   * React root instance
   */
  root: Root;

  /**
   * Initial data extracted from the page
   */
  initialData: unknown;
}

/**
 * Hydrates the server-rendered application on the client.
 *
 * This function:
 * 1. Finds the root element
 * 2. Extracts initial data from the page
 * 3. Hydrates the React tree using hydrateRoot
 * 4. Attaches Client Components for interactivity
 *
 * @param app - React element to hydrate
 * @param options - Hydration options
 * @returns Hydrate result with root and initial data
 *
 * @example
 * ```typescript
 * // entry.client.tsx
 * import { hydrate } from '@veloxts/web/rendering';
 * import { App } from './app';
 *
 * hydrate(<App />);
 * ```
 *
 * @example
 * ```typescript
 * // With custom options
 * const { root, initialData } = hydrate(<App />, {
 *   rootElement: document.getElementById('app'),
 *   onRecoverableError: (error) => {
 *     console.warn('Recoverable hydration error:', error);
 *   },
 * });
 * ```
 */
export function hydrate(app: ReactNode, options: HydrateOptions = {}): HydrateResult {
  const {
    rootElement = typeof document !== 'undefined' ? document.getElementById('root') : null,
    onRecoverableError = defaultRecoverableErrorHandler,
    // strictMode is available for future StrictMode wrapper support
  } = options;

  if (!rootElement) {
    throw new Error(
      '[VeloxTS] Root element not found. Ensure #root exists in your Document component.'
    );
  }

  // Extract initial data from the page
  const initialData = extractInitialData();

  // Store initial data globally for access by Client Components
  if (initialData !== undefined) {
    setGlobalInitialData(initialData);
  }

  // Hydrate the React tree
  const root = hydrateRoot(rootElement, app, {
    onRecoverableError(error) {
      onRecoverableError(error instanceof Error ? error : new Error(String(error)));
    },
  });

  // Log hydration success in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('[VeloxTS] Hydration complete');
  }

  return { root, initialData };
}

/**
 * Extracts initial data serialized by the server.
 * Looks for the __velox_data__ script tag and parses JSON.
 *
 * @returns Parsed initial data, or undefined if not found
 *
 * @example
 * ```typescript
 * const data = extractInitialData();
 * if (data) {
 *   // Use server-provided data
 * }
 * ```
 */
export function extractInitialData(): unknown {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const dataElement = document.getElementById('__velox_data__');

  if (!dataElement) {
    return undefined;
  }

  try {
    return JSON.parse(dataElement.textContent || '{}');
  } catch (error) {
    console.error('[VeloxTS] Failed to parse initial data:', error);
    return undefined;
  }
}

/**
 * Gets the initial data set during hydration.
 * Use this in Client Components to access server data.
 *
 * @returns Initial data, or undefined if not set
 *
 * @example
 * ```typescript
 * // In a Client Component
 * const data = getInitialData<{ user: User }>();
 * if (data) {
 *   console.log(data.user.name);
 * }
 * ```
 */
export function getInitialData<T = unknown>(): T | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return (window as WindowWithVeloxData).__VELOX_INITIAL_DATA__ as T | undefined;
}

/**
 * Sets the global initial data.
 * Called during hydration.
 *
 * @param data - Initial data from server
 */
function setGlobalInitialData(data: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  (window as WindowWithVeloxData).__VELOX_INITIAL_DATA__ = data;
}

/**
 * Window type with VeloxTS data
 */
interface WindowWithVeloxData extends Window {
  __VELOX_INITIAL_DATA__?: unknown;
}

/**
 * Default handler for recoverable errors (e.g., mismatches).
 */
function defaultRecoverableErrorHandler(error: Error): void {
  console.warn('[VeloxTS Recoverable Error]', error.message);

  // In development, show an overlay for hydration mismatches
  if (process.env.NODE_ENV !== 'production') {
    showHydrationWarning(error);
  }
}

/**
 * Shows a warning overlay for hydration mismatches in development.
 *
 * @param error - The hydration error
 */
function showHydrationWarning(error: Error): void {
  // Only show for hydration mismatch errors
  if (!error.message.includes('Hydration') && !error.message.includes('hydration')) {
    return;
  }

  // Check if overlay already exists
  if (document.getElementById('velox-hydration-warning')) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'velox-hydration-warning';
  overlay.style.cssText = `
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    max-width: 400px;
    background: #fef3c7;
    border: 1px solid #f59e0b;
    border-radius: 8px;
    padding: 1rem;
    font-family: system-ui, sans-serif;
    font-size: 0.875rem;
    z-index: 999999;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `;

  overlay.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
      <div>
        <div style="font-weight: 600; color: #92400e; margin-bottom: 0.5rem;">
          Hydration Warning
        </div>
        <div style="color: #78350f;">
          ${escapeHtml(error.message.slice(0, 200))}${error.message.length > 200 ? '...' : ''}
        </div>
      </div>
      <button
        onclick="this.parentElement.parentElement.remove()"
        style="
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          color: #92400e;
          padding: 0;
          line-height: 1;
        "
      >&times;</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    overlay.remove();
  }, 10000);
}

/**
 * Shows a fatal error overlay.
 *
 * @param error - The fatal error
 */
export function showErrorOverlay(error: Error): void {
  if (typeof document === 'undefined') {
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'velox-error-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 2rem;
    overflow: auto;
    z-index: 999999;
    font-family: monospace;
  `;

  overlay.innerHTML = `
    <h1 style="color: #ef4444; margin-top: 0;">Hydration Error</h1>
    <pre style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(error.stack || error.message)}</pre>
    <button
      onclick="location.reload()"
      style="
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
      "
    >Reload Page</button>
  `;

  document.body.appendChild(overlay);
}

/**
 * Re-export hydrateRoot for advanced use cases.
 */
export { hydrateRoot } from 'react-dom/client';
