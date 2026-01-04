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
  const content = compileTemplate('root/package.json', config);

  // npm requires concurrently for parallel workspace execution
  if (config.packageManager === 'npm') {
    const pkg = JSON.parse(content) as {
      devDependencies?: Record<string, string>;
    };
    pkg.devDependencies = pkg.devDependencies ?? {};
    pkg.devDependencies.concurrently = '9.2.1';

    // Sort devDependencies alphabetically
    pkg.devDependencies = Object.fromEntries(
      Object.entries(pkg.devDependencies).sort(([a], [b]) => a.localeCompare(b))
    );

    return JSON.stringify(pkg, null, 2);
  }

  return content;
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

export type TemplateVariant = 'default' | 'auth' | 'trpc';

export function generateRootClaudeMd(
  config: TemplateConfig,
  variant: TemplateVariant | boolean
): string {
  // Support legacy boolean parameter for backwards compatibility
  let sourceFile: string;
  if (typeof variant === 'boolean') {
    sourceFile = variant ? 'root/CLAUDE.auth.md' : 'root/CLAUDE.default.md';
  } else {
    switch (variant) {
      case 'auth':
        sourceFile = 'root/CLAUDE.auth.md';
        break;
      case 'trpc':
        sourceFile = 'root/CLAUDE.trpc.md';
        break;
      default:
        sourceFile = 'root/CLAUDE.default.md';
    }
  }
  return compileTemplate(sourceFile, config);
}

export function generateRootCursorrules(config: TemplateConfig): string {
  return compileTemplate('root/.cursorrules', config);
}

// ============================================================================
// Claude Code Skills
// ============================================================================

/**
 * Generate VeloxTS skill files for Claude Code
 *
 * These skills provide project-aware guidance to Claude when working on
 * VeloxTS projects. Skills are Markdown files with YAML frontmatter.
 */
export function generateClaudeSkillFiles(config: TemplateConfig): TemplateFile[] {
  const skillPath = '.claude/skills/veloxts';

  return [
    {
      path: `${skillPath}/SKILL.md`,
      content: compileTemplate('root/.claude/skills/veloxts/SKILL.md', config),
    },
    {
      path: `${skillPath}/GENERATORS.md`,
      content: compileTemplate('root/.claude/skills/veloxts/GENERATORS.md', config),
    },
    {
      path: `${skillPath}/PROCEDURES.md`,
      content: compileTemplate('root/.claude/skills/veloxts/PROCEDURES.md', config),
    },
    {
      path: `${skillPath}/TROUBLESHOOTING.md`,
      content: compileTemplate('root/.claude/skills/veloxts/TROUBLESHOOTING.md', config),
    },
  ];
}

// ============================================================================
// Generate All Root Files
// ============================================================================

export function generateRootFiles(
  config: TemplateConfig,
  variant: TemplateVariant | boolean = 'default'
): TemplateFile[] {
  return [
    { path: 'package.json', content: generateRootPackageJson(config) },
    { path: 'pnpm-workspace.yaml', content: generatePnpmWorkspaceYaml() },
    { path: 'tsconfig.json', content: generateRootTsConfig() },
    { path: '.gitignore', content: generateRootGitignore() },
    { path: 'README.md', content: generateRootReadme(config) },
    { path: 'CLAUDE.md', content: generateRootClaudeMd(config, variant) },
    { path: '.cursorrules', content: generateRootCursorrules(config) },
    // Claude Code skills for project-specific guidance
    ...generateClaudeSkillFiles(config),
  ];
}
