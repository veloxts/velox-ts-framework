/**
 * Structured Logger
 *
 * Minimal logging utility that respects VELOX_LOG_LEVEL environment variable.
 * Replaces raw console.* calls in library code with namespaced, level-aware logging.
 */

/** Supported log levels, ordered by verbosity. */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

/** Logger instance returned by createLogger. */
export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function getLogLevel(): LogLevel {
  const env = (process.env.VELOX_LOG_LEVEL ?? 'warn').toLowerCase();
  if (env in LEVEL_PRIORITY) return env as LogLevel;
  return 'warn';
}

/**
 * Create a namespaced logger that respects VELOX_LOG_LEVEL.
 *
 * @param namespace - Logger namespace (e.g. 'router', 'auth')
 * @returns Logger with debug/info/warn/error methods
 *
 * @example
 * ```typescript
 * import { createLogger } from '@veloxts/core';
 *
 * const log = createLogger('router');
 * log.info('Route registered:', method, path);
 * log.warn('Deprecated route pattern detected');
 * log.error('Failed to register route:', error);
 * ```
 */
export function createLogger(namespace: string): Logger {
  const prefix = `[@veloxts/${namespace}]`;

  function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[getLogLevel()];
  }

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog('debug')) console.debug(prefix, ...args);
    },
    info: (...args: unknown[]) => {
      if (shouldLog('info')) console.info(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      if (shouldLog('warn')) console.warn(prefix, ...args);
    },
    error: (...args: unknown[]) => {
      if (shouldLog('error')) console.error(prefix, ...args);
    },
  };
}
