/**
 * Root Workspace Configuration Templates
 *
 * Uses source file compilation for workspace root files.
 */

import { compileTemplate } from '../compiler.js';
import { DEFAULT_CONFIG } from '../placeholders.js';
import type { TemplateConfig, TemplateFile } from '../types.js';

// ============================================================================
// Root Template Compilation
// ============================================================================

export function generateRootPackageJson(config: TemplateConfig): string {
  return compileTemplate('root/package.json', config);
}

export function generatePnpmWorkspaceYaml(): string {
  return compileTemplate('root/pnpm-workspace.yaml', DEFAULT_CONFIG);
}

export function generateRootTsConfig(): string {
  return compileTemplate('root/tsconfig.json', DEFAULT_CONFIG);
}

export function generateRootGitignore(): string {
  return compileTemplate('root/gitignore', DEFAULT_CONFIG);
}

export function generateRootReadme(config: TemplateConfig): string {
  return compileTemplate('root/README.md', config);
}

export function generateRootClaudeMd(config: TemplateConfig, isAuthTemplate: boolean): string {
  const sourceFile = isAuthTemplate ? 'root/CLAUDE.auth.md' : 'root/CLAUDE.default.md';
  return compileTemplate(sourceFile, config);
}

// ============================================================================
// Generate All Root Files
// ============================================================================

export function generateRootFiles(config: TemplateConfig, isAuthTemplate: boolean): TemplateFile[] {
  return [
    { path: 'package.json', content: generateRootPackageJson(config) },
    { path: 'pnpm-workspace.yaml', content: generatePnpmWorkspaceYaml() },
    { path: 'tsconfig.json', content: generateRootTsConfig() },
    { path: '.gitignore', content: generateRootGitignore() },
    { path: 'README.md', content: generateRootReadme(config) },
    { path: 'CLAUDE.md', content: generateRootClaudeMd(config, isAuthTemplate) },
  ];
}
