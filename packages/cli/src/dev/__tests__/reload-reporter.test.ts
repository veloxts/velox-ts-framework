/**
 * Reload Reporter - Unit Tests
 *
 * Tests for reload event feedback and formatting functionality.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createReloadReporter,
  ReloadReporter,
  type HMRBoundary,
  type ReloadEvent,
  type ReloadReporterOptions,
} from '../reload-reporter.js';

describe('ReloadReporter', () => {
  let reporter: ReloadReporter;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let clearSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    clearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {});
    reporter = createReloadReporter({ verbose: false, clearOnRestart: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createReloadReporter', () => {
    it('should create a ReloadReporter instance', () => {
      const instance = createReloadReporter({ verbose: false, clearOnRestart: false });
      expect(instance).toBeInstanceOf(ReloadReporter);
    });

    it('should accept verbose option', () => {
      const instance = createReloadReporter({ verbose: true, clearOnRestart: false });
      expect(instance).toBeInstanceOf(ReloadReporter);
    });

    it('should accept clearOnRestart option', () => {
      const instance = createReloadReporter({ verbose: false, clearOnRestart: true });
      expect(instance).toBeInstanceOf(ReloadReporter);
    });
  });

  describe('reportHotUpdate', () => {
    it('should log hot update message', () => {
      reporter.reportHotUpdate('src/procedures/users.ts', 23);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Hot updated');
      expect(output).toContain('users.ts');
    });

    it('should increment hot update count', () => {
      expect(reporter.getHotUpdateCount()).toBe(0);

      reporter.reportHotUpdate('src/test.ts', 10);
      expect(reporter.getHotUpdateCount()).toBe(1);

      reporter.reportHotUpdate('src/test2.ts', 15);
      expect(reporter.getHotUpdateCount()).toBe(2);
    });

    it('should record event in history', () => {
      reporter.reportHotUpdate('src/test.ts', 10);

      const history = reporter.getReloadHistory();
      expect(history.length).toBe(1);
      expect(history[0].type).toBe('hot-update');
      expect(history[0].filePath).toBe('src/test.ts');
      expect(history[0].duration).toBe(10);
    });

    it('should show verbose output when enabled', () => {
      const verboseReporter = createReloadReporter({ verbose: true, clearOnRestart: false });
      verboseReporter.reportHotUpdate('src/test.ts', 10);

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Module swap');
    });

    it('should truncate long file paths', () => {
      const longPath = 'src/very/deeply/nested/folder/structure/that/is/way/too/long/to/display/properly.ts';
      reporter.reportHotUpdate(longPath, 10);

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('...');
    });
  });

  describe('reportFullRestart', () => {
    it('should log restart message', () => {
      reporter.reportFullRestart('Config file changed');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Restarting');
      expect(output).toContain('Config file changed');
    });

    it('should increment full restart count', () => {
      expect(reporter.getFullRestartCount()).toBe(0);

      reporter.reportFullRestart('test');
      expect(reporter.getFullRestartCount()).toBe(1);
    });

    it('should reset hot update count on restart', () => {
      reporter.reportHotUpdate('src/test.ts', 10);
      reporter.reportHotUpdate('src/test2.ts', 15);
      expect(reporter.getHotUpdateCount()).toBe(2);

      reporter.reportFullRestart('test');
      expect(reporter.getHotUpdateCount()).toBe(0);
    });

    it('should clear console when clearOnRestart is true', () => {
      const clearReporter = createReloadReporter({ verbose: false, clearOnRestart: true });
      clearReporter.reportFullRestart('test');

      expect(clearSpy).toHaveBeenCalled();
    });

    it('should not clear console when clearOnRestart is false', () => {
      reporter.reportFullRestart('test');
      expect(clearSpy).not.toHaveBeenCalled();
    });

    it('should show verbose output with file path when enabled', () => {
      const verboseReporter = createReloadReporter({ verbose: true, clearOnRestart: false });
      verboseReporter.reportFullRestart('Config changed', 'config/app.ts');

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Triggered by');
      expect(output).toContain('config/app.ts');
    });
  });

  describe('reportStartupComplete', () => {
    it('should log startup message with URL', () => {
      reporter.reportStartupComplete('http://localhost:3210', 847);

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Server ready');
      expect(output).toContain('http://localhost:3210');
    });

    it('should record startup event', () => {
      reporter.reportStartupComplete('http://localhost:3210', 847);

      const history = reporter.getReloadHistory();
      expect(history.some((e) => e.type === 'startup')).toBe(true);
    });

    it('should show verbose output when enabled', () => {
      const verboseReporter = createReloadReporter({ verbose: true, clearOnRestart: false });
      verboseReporter.reportStartupComplete('http://localhost:3210', 847);

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Startup');
    });
  });

  describe('reportCompilationError', () => {
    it('should log compilation error', () => {
      const error = new Error('Unexpected token');
      reporter.reportCompilationError(error, 'src/test.ts');

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Compilation failed');
      expect(output).toContain('Unexpected token');
    });

    it('should show file path', () => {
      const error = new Error('Error');
      reporter.reportCompilationError(error, 'src/procedures/users.ts');

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('users.ts');
    });

    it('should show suggestion when provided', () => {
      const error = new Error('Error');
      reporter.reportCompilationError(error, 'src/test.ts', 'Check for missing semicolon');

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Suggestion');
      expect(output).toContain('missing semicolon');
    });

    it('should record error event', () => {
      const error = new Error('Test error');
      reporter.reportCompilationError(error, 'src/test.ts');

      const history = reporter.getReloadHistory();
      expect(history.some((e) => e.type === 'error')).toBe(true);
    });

    it('should show stack trace in verbose mode', () => {
      const verboseReporter = createReloadReporter({ verbose: true, clearOnRestart: false });
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.ts:10:5\n    at main.ts:20:3';
      verboseReporter.reportCompilationError(error, 'src/test.ts');

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('test.ts');
    });
  });

  describe('reportRuntimeError', () => {
    it('should log runtime error warning', () => {
      reporter.reportRuntimeError();

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Runtime error');
      expect(output).toContain('HMR continues watching');
    });

    it('should show error message in verbose mode', () => {
      const verboseReporter = createReloadReporter({ verbose: true, clearOnRestart: false });
      const error = new Error('Undefined is not a function');
      verboseReporter.reportRuntimeError(error);

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Undefined is not a function');
    });

    it('should record error event', () => {
      reporter.reportRuntimeError();

      const history = reporter.getReloadHistory();
      expect(history.some((e) => e.type === 'error')).toBe(true);
    });
  });

  describe('reportHMRFallback', () => {
    it('should log HMR fallback message', () => {
      reporter.reportHMRFallback('Module outside boundaries');

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('HMR failed');
      expect(output).toContain('Module outside boundaries');
      expect(output).toContain('full restart');
    });
  });

  describe('printHMRStatus', () => {
    it('should print HMR enabled banner', () => {
      reporter.printHMRStatus();

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('HMR enabled');
      expect(output).toContain('Hot module replacement');
    });

    it('should show default boundaries', () => {
      reporter.printHMRStatus();

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Procedures');
      expect(output).toContain('Schemas');
      expect(output).toContain('Handlers');
    });

    it('should show custom boundaries when provided', () => {
      const customBoundaries: HMRBoundary[] = [
        { label: 'Services', pattern: 'src/services/**/*.ts' },
        { label: 'Controllers', pattern: 'src/controllers/**/*.ts' },
      ];

      reporter.printHMRStatus(customBoundaries);

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Services');
      expect(output).toContain('Controllers');
      expect(output).not.toContain('Procedures'); // Default should not appear
    });
  });

  describe('printLegacyModeWarning', () => {
    it('should print legacy mode warning', () => {
      reporter.printLegacyModeWarning();

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Legacy watch mode');
      expect(output).toContain('HMR disabled');
      expect(output).toContain('--no-hmr');
    });
  });

  describe('printStatistics', () => {
    it('should not print in non-verbose mode', () => {
      reporter.reportHotUpdate('src/test.ts', 10);
      consoleSpy.mockClear();

      reporter.printStatistics();

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should print statistics in verbose mode', () => {
      const verboseReporter = createReloadReporter({ verbose: true, clearOnRestart: false });
      verboseReporter.reportHotUpdate('src/test.ts', 10);
      consoleSpy.mockClear();

      verboseReporter.printStatistics();

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Session Statistics');
      expect(output).toContain('Hot updates');
      expect(output).toContain('Full restarts');
    });
  });

  describe('getReloadHistory', () => {
    it('should return empty array initially', () => {
      expect(reporter.getReloadHistory()).toEqual([]);
    });

    it('should return readonly array', () => {
      reporter.reportHotUpdate('src/test.ts', 10);
      const history = reporter.getReloadHistory();

      expect(Array.isArray(history)).toBe(true);
    });

    it('should limit history to 100 events', () => {
      // Add more than 100 events
      for (let i = 0; i < 110; i++) {
        reporter.reportHotUpdate(`src/test${i}.ts`, 10);
      }

      const history = reporter.getReloadHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('clearHistory', () => {
    it('should clear reload history', () => {
      reporter.reportHotUpdate('src/test.ts', 10);
      reporter.reportFullRestart('test');
      expect(reporter.getReloadHistory().length).toBeGreaterThan(0);

      reporter.clearHistory();
      expect(reporter.getReloadHistory().length).toBe(0);
    });

    it('should not reset counters', () => {
      reporter.reportHotUpdate('src/test.ts', 10);
      reporter.reportFullRestart('test');

      reporter.clearHistory();

      // Counters should remain
      expect(reporter.getFullRestartCount()).toBe(1);
    });
  });

  describe('file path formatting', () => {
    it('should remove leading ./ from paths', () => {
      reporter.reportHotUpdate('./src/test.ts', 10);

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).not.toContain('./src');
      expect(output).toContain('src/test.ts');
    });

    it('should handle paths without extension', () => {
      reporter.reportHotUpdate('src/test', 10);

      const output = consoleSpy.mock.calls.flat().join(' ');
      expect(output).toContain('src/test');
    });
  });
});
