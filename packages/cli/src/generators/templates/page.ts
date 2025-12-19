/**
 * Page Template
 *
 * Generates RSC page files for VeloxTS full-stack applications.
 */

import type { TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface PageOptions {
  /** Generate a client component with "use client" directive */
  client: boolean;
  /** Include a loading state skeleton */
  loading: boolean;
  /** Include data fetching example */
  fetch: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for a page file
 */
export function getPagePath(entityName: string, project: { pagesDir?: string }): string {
  const pagesDir = project.pagesDir ?? 'app/pages';
  return `${pagesDir}/${entityName.toLowerCase()}.tsx`;
}

/**
 * Get the path for a loading file
 */
export function getLoadingPath(_entityName: string, project: { pagesDir?: string }): string {
  const pagesDir = project.pagesDir ?? 'app/pages';
  return `${pagesDir}/_loading.tsx`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate a server component page
 */
function generateServerPage(ctx: TemplateContext<PageOptions>): string {
  const { entity, options } = ctx;

  const imports = options.fetch
    ? `import { db } from '@/lib/db';

`
    : '';

  const dataFetch = options.fetch
    ? `
  // Fetch data for this page
  const data = await db.${entity.camel}.findMany();
`
    : '';

  return `${imports}/**
 * ${entity.pascal} Page
 *
 * Server Component - runs on the server at request time.
 */
export default async function ${entity.pascal}Page() {${dataFetch}
  return (
    <div className="${entity.kebab}-page">
      <h1>${entity.humanReadable}</h1>
      <p>Welcome to the ${entity.humanReadable} page.</p>
      ${options.fetch ? `{/* Display fetched data */}` : ''}
    </div>
  );
}
`;
}

/**
 * Generate a client component page
 */
function generateClientPage(ctx: TemplateContext<PageOptions>): string {
  const { entity } = ctx;

  return `'use client';

import { useState } from 'react';

/**
 * ${entity.pascal} Page
 *
 * Client Component - hydrated on the client for interactivity.
 */
export default function ${entity.pascal}Page() {
  const [count, setCount] = useState(0);

  return (
    <div className="${entity.kebab}-page">
      <h1>${entity.humanReadable}</h1>
      <p>Welcome to the ${entity.humanReadable} page.</p>

      <div className="counter">
        <button onClick={() => setCount(c => c - 1)}>-</button>
        <span>{count}</span>
        <button onClick={() => setCount(c => c + 1)}>+</button>
      </div>
    </div>
  );
}
`;
}

/**
 * Generate a loading skeleton
 */
export function loadingTemplate(_ctx: TemplateContext<PageOptions>): string {
  return `/**
 * Loading Skeleton
 *
 * Displayed while the page is loading via React Suspense.
 */
export default function Loading() {
  return (
    <div className="loading-skeleton">
      <div className="skeleton-header" />
      <div className="skeleton-content">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
    </div>
  );
}
`;
}

// ============================================================================
// Main Template
// ============================================================================

/**
 * Page template function
 */
export const pageTemplate: TemplateFunction<PageOptions> = (ctx) => {
  if (ctx.options.client) {
    return generateClientPage(ctx);
  }
  return generateServerPage(ctx);
};

// ============================================================================
// Post-generation Instructions
// ============================================================================

export function getPageInstructions(entityName: string, options: PageOptions): string {
  const lines = [
    `Your ${entityName} page has been created.`,
    '',
    'Next steps:',
    `  1. Add content to ${getPagePath(entityName, { pagesDir: 'app/pages' })}`,
  ];

  if (options.client) {
    lines.push('  2. Add state and event handlers for interactivity');
  } else {
    lines.push('  2. Add data fetching if needed');
  }

  if (options.loading) {
    lines.push('  3. Customize the loading skeleton');
  }

  lines.push('  4. Add routing links to navigate to this page');

  return lines.join('\n');
}
