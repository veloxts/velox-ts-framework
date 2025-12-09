/**
 * Web Package Styles
 *
 * Uses source file compilation for CSS templates.
 */

import { compileTemplate } from '../compiler.js';
import type { TemplateFile } from '../types.js';

// ============================================================================
// Style Compilation
// ============================================================================

export function generateGlobalCss(): string {
  return compileTemplate('web/styles/global.css', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

export function generateAppModuleCss(): string {
  return compileTemplate('web/App.module.css', {
    projectName: '',
    packageManager: 'pnpm',
    template: 'default',
    database: 'sqlite',
  });
}

// ============================================================================
// Generate All Style Files
// ============================================================================

export function generateWebStyleFiles(): TemplateFile[] {
  return [
    { path: 'apps/web/src/styles/global.css', content: generateGlobalCss() },
    { path: 'apps/web/src/App.module.css', content: generateAppModuleCss() },
  ];
}
