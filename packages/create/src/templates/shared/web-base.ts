/**
 * Web Package Base Templates
 *
 * Uses source file compilation for React frontend templates.
 */

import { compileTemplate } from '../compiler.js';
import type { TemplateConfig, TemplateFile } from '../types.js';

// ============================================================================
// Web Template Compilation
// ============================================================================

export function generateWebPackageJson(): string {
  // JSON files use direct reading since they don't have template-specific variants
  return compileTemplate('web/package.json', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

export function generateWebTsConfig(): string {
  return compileTemplate('web/tsconfig.json', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

export function generateViteConfig(config: TemplateConfig): string {
  return compileTemplate('web/vite.config.ts', config);
}

export function generateWebIndexHtml(config: TemplateConfig): string {
  return compileTemplate('web/index.html', config);
}

export function generateFavicon(): string {
  return compileTemplate('web/favicon.svg', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

export function generateMainTsx(): string {
  return compileTemplate('web/main.tsx', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

export function generateRootRoute(): string {
  return compileTemplate('web/routes/__root.tsx', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

export function generateDefaultIndexRoute(): string {
  return compileTemplate('web/routes/index.default.tsx', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

export function generateAuthIndexRoute(): string {
  return compileTemplate('web/routes/index.auth.tsx', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'auth',
    database: 'sqlite',
  });
}

export function generateAboutRoute(): string {
  return compileTemplate('web/routes/about.tsx', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

// ============================================================================
// Generate All Web Base Files
// ============================================================================

export function generateWebBaseFiles(
  config: TemplateConfig,
  isAuthTemplate: boolean
): TemplateFile[] {
  return [
    // Config files
    { path: 'apps/web/package.json', content: generateWebPackageJson() },
    { path: 'apps/web/tsconfig.json', content: generateWebTsConfig() },
    { path: 'apps/web/vite.config.ts', content: generateViteConfig(config) },
    { path: 'apps/web/index.html', content: generateWebIndexHtml(config) },
    { path: 'apps/web/public/favicon.svg', content: generateFavicon() },

    // Entry point
    { path: 'apps/web/src/main.tsx', content: generateMainTsx() },

    // Routes
    { path: 'apps/web/src/routes/__root.tsx', content: generateRootRoute() },
    {
      path: 'apps/web/src/routes/index.tsx',
      content: isAuthTemplate ? generateAuthIndexRoute() : generateDefaultIndexRoute(),
    },
    { path: 'apps/web/src/routes/about.tsx', content: generateAboutRoute() },
  ];
}
