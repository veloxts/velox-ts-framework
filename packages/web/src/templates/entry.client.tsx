/**
 * Client Entry Point Template
 *
 * This file is the entry point for client-side hydration.
 * It's referenced in defineVeloxApp() configuration.
 *
 * When scaffolding a new VeloxTS full-stack project, this template
 * is copied to src/entry.client.tsx and customized for the project.
 *
 * @module @veloxts/web/templates/entry.client
 */

import type { ReactElement } from 'react';
import { StrictMode } from 'react';

import { getInitialData, hydrate } from '../rendering/client-hydrator.js';

/**
 * Root App component.
 *
 * In a real project, this would be imported from your app directory.
 * This template serves as a placeholder that demonstrates the pattern.
 *
 * @example
 * ```tsx
 * // In your actual project:
 * import { App } from './app/App';
 * ```
 */
function App(): ReactElement {
  // Access server-provided initial data if needed
  const data = getInitialData<{ message?: string }>();

  return (
    <StrictMode>
      <div>
        <h1>VeloxTS App</h1>
        {data?.message && <p>{data.message}</p>}
        <p>
          Edit <code>src/entry.client.tsx</code> to customize this component.
        </p>
      </div>
    </StrictMode>
  );
}

/**
 * Hydrate the server-rendered application.
 *
 * This is the main entry point for client-side JavaScript.
 * It:
 * 1. Finds the #root element rendered by the server
 * 2. Hydrates the React tree, making it interactive
 * 3. Extracts initial data passed from the server
 *
 * @example
 * ```tsx
 * // Custom hydration with error handling
 * hydrate(<App />, {
 *   onRecoverableError: (error) => {
 *     // Send to error tracking service
 *     console.error('Hydration error:', error);
 *   },
 * });
 * ```
 */
hydrate(<App />);
