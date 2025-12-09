/**
 * Watch Configuration for Development Server
 *
 * Defines file patterns to ignore during development to prevent
 * unnecessary restarts and improve developer experience.
 */

/**
 * Default patterns to ignore when watching for file changes.
 * These patterns match files that should not trigger a restart.
 */
export const DEFAULT_WATCH_IGNORE: readonly string[] = [
  // Dependencies
  '**/node_modules/**',

  // Test files
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/__tests__/**',
  '**/__mocks__/**',

  // Type declarations (don't affect runtime)
  '**/*.d.ts',

  // Build artifacts
  '**/dist/**',
  '**/build/**',
  '**/*.tsbuildinfo',

  // Coverage and reports
  '**/coverage/**',

  // Version control
  '**/.git/**',

  // Generated files (e.g., Prisma client)
  '**/generated/**',

  // Documentation
  '**/*.md',
  '**/docs/**',

  // Config files that don't affect runtime
  '**/tsconfig*.json',
  '**/biome.json',
  '**/.eslintrc*',
  '**/.prettierrc*',
];

/**
 * Options for building watch arguments
 */
export interface WatchOptions {
  /** Entry point file */
  readonly entry: string;
  /** Whether to clear screen on restart */
  readonly clearScreen: boolean;
  /** Patterns to ignore (defaults to DEFAULT_WATCH_IGNORE) */
  readonly ignore?: readonly string[];
}

/**
 * Build command line arguments for tsx watch
 */
export function buildWatchArgs(options: WatchOptions): string[] {
  const args = ['tsx', 'watch'];

  // Add clear screen option
  if (options.clearScreen) {
    args.push('--clear-screen=true');
  }

  // Add ignore patterns
  const ignorePatterns = options.ignore ?? DEFAULT_WATCH_IGNORE;
  for (const pattern of ignorePatterns) {
    args.push('--ignore', pattern);
  }

  // Add entry point
  args.push(options.entry);

  return args;
}

/**
 * Get the essential ignore patterns (minimal set for fastest filtering)
 * Used when full ignore list causes performance issues
 */
export function getEssentialIgnorePatterns(): readonly string[] {
  return [
    '**/node_modules/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/*.d.ts',
    '**/dist/**',
    '**/__tests__/**',
  ];
}
