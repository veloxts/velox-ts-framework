/**
 * Layout Template
 *
 * Generates RSC layout files for VeloxTS full-stack applications.
 */

import type { TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface LayoutOptions {
  /** Include header navigation */
  header: boolean;
  /** Include footer */
  footer: boolean;
  /** Include sidebar navigation */
  sidebar: boolean;
  /** Root layout with html/body tags */
  root: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for a layout file
 */
export function getLayoutPath(entityName: string, project: { layoutsDir?: string }): string {
  const layoutsDir = project.layoutsDir ?? 'app/layouts';

  // Root layout goes in app/layouts/_layout.tsx
  if (entityName.toLowerCase() === 'root') {
    return `${layoutsDir}/_layout.tsx`;
  }

  // Named layouts go in app/layouts/<name>/_layout.tsx
  return `${layoutsDir}/${entityName.toLowerCase()}/_layout.tsx`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate a root layout with html/body
 */
function generateRootLayout(ctx: TemplateContext<LayoutOptions>): string {
  const { entity, options } = ctx;

  const header = options.header
    ? `
        <header className="app-header">
          <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
          </nav>
        </header>`
    : '';

  const footer = options.footer
    ? `
        <footer className="app-footer">
          <p>&copy; {new Date().getFullYear()} ${entity.pascal}</p>
        </footer>`
    : '';

  return `/**
 * Root Layout
 *
 * Wraps all pages with shared UI elements.
 * This is a Server Component by default.
 */
export default function ${entity.pascal}Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>VeloxTS App</title>
      </head>
      <body>${header}
        <main className="app-main">
          {children}
        </main>${footer}
      </body>
    </html>
  );
}
`;
}

/**
 * Generate a nested layout (segment or group)
 */
function generateNestedLayout(ctx: TemplateContext<LayoutOptions>): string {
  const { entity, options } = ctx;

  const sidebar = options.sidebar
    ? `
      <aside className="${entity.kebab}-sidebar">
        <nav>
          {/* Add navigation links */}
        </nav>
      </aside>`
    : '';

  const header = options.header
    ? `
      <header className="${entity.kebab}-header">
        <h2>${entity.humanReadable}</h2>
      </header>`
    : '';

  return `/**
 * ${entity.pascal} Layout
 *
 * Wraps pages in the ${entity.humanReadable} section.
 * This is a Server Component by default.
 */
export default function ${entity.pascal}Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="${entity.kebab}-layout">${header}
      <div className="${entity.kebab}-content">${sidebar}
        <div className="${entity.kebab}-main">
          {children}
        </div>
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
 * Layout template function
 */
export const layoutTemplate: TemplateFunction<LayoutOptions> = (ctx) => {
  if (ctx.options.root) {
    return generateRootLayout(ctx);
  }
  return generateNestedLayout(ctx);
};

// ============================================================================
// Post-generation Instructions
// ============================================================================

export function getLayoutInstructions(entityName: string, options: LayoutOptions): string {
  const lines = [`Your ${entityName} layout has been created.`, '', 'Next steps:'];

  if (options.root) {
    lines.push('  1. Customize the <head> metadata');
    lines.push('  2. Add global styles to the root layout');
    if (options.header) {
      lines.push('  3. Update navigation links in the header');
    }
  } else {
    lines.push(`  1. Customize the ${entityName} layout structure`);
    if (options.sidebar) {
      lines.push('  2. Add navigation items to the sidebar');
    }
    lines.push("  3. Place pages inside this layout's directory");
  }

  return lines.join('\n');
}
