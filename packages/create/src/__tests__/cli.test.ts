/**
 * CLI Argument Parsing Unit Tests
 *
 * Tests for the create-velox-app CLI argument parser.
 * Covers all flag formats, validation, and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseArgs, type ParsedArgs } from '../cli.js';

// ============================================================================
// Test Utilities
// ============================================================================

/** Mock console.error and console.warn to capture output */
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
let processExitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`);
  });
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  processExitSpy.mockRestore();
});

// ============================================================================
// Basic Argument Parsing
// ============================================================================

describe('CLI Argument Parsing', () => {
  describe('basic parsing', () => {
    it('should return empty result for no arguments', () => {
      const result = parseArgs([]);
      expect(result).toEqual({
        help: false,
        version: false,
      });
    });

    it('should parse project name as first positional argument', () => {
      const result = parseArgs(['my-app']);
      expect(result.projectName).toBe('my-app');
      expect(result.help).toBe(false);
      expect(result.version).toBe(false);
    });

    it('should parse project name with path', () => {
      const result = parseArgs(['./projects/my-app']);
      expect(result.projectName).toBe('./projects/my-app');
    });

    it('should parse project name at start before flags', () => {
      const result = parseArgs(['my-app', '--template=auth']);
      expect(result.projectName).toBe('my-app');
      expect(result.template).toBe('auth');
    });

    it('should parse project name at end after flags', () => {
      const result = parseArgs(['--template=auth', 'my-app']);
      expect(result.projectName).toBe('my-app');
      expect(result.template).toBe('auth');
    });
  });

  // ============================================================================
  // Help Flag
  // ============================================================================

  describe('help flag', () => {
    it('should parse --help flag', () => {
      const result = parseArgs(['--help']);
      expect(result.help).toBe(true);
    });

    it('should parse -h flag', () => {
      const result = parseArgs(['-h']);
      expect(result.help).toBe(true);
    });

    it('should parse help flag with other arguments', () => {
      const result = parseArgs(['my-app', '--help', '--template=auth']);
      expect(result.help).toBe(true);
      expect(result.projectName).toBe('my-app');
      expect(result.template).toBe('auth');
    });
  });

  // ============================================================================
  // Version Flag
  // ============================================================================

  describe('version flag', () => {
    it('should parse --version flag', () => {
      const result = parseArgs(['--version']);
      expect(result.version).toBe(true);
    });

    it('should parse -v flag', () => {
      const result = parseArgs(['-v']);
      expect(result.version).toBe(true);
    });

    it('should parse version flag with other arguments', () => {
      const result = parseArgs(['--version', 'my-app']);
      expect(result.version).toBe(true);
      expect(result.projectName).toBe('my-app');
    });
  });

  // ============================================================================
  // Template Flag
  // ============================================================================

  describe('template flag', () => {
    describe('equals format (--template=value)', () => {
      it('should parse --template=spa', () => {
        const result = parseArgs(['--template=spa']);
        expect(result.template).toBe('spa');
      });

      it('should parse --template=auth', () => {
        const result = parseArgs(['--template=auth']);
        expect(result.template).toBe('auth');
      });

      it('should parse --template=trpc', () => {
        const result = parseArgs(['--template=trpc']);
        expect(result.template).toBe('trpc');
      });

      it('should parse --template=rsc', () => {
        const result = parseArgs(['--template=rsc']);
        expect(result.template).toBe('rsc');
      });

      it('should parse --template=rsc-auth', () => {
        const result = parseArgs(['--template=rsc-auth']);
        expect(result.template).toBe('rsc-auth');
      });

      it('should parse -t=spa shorthand', () => {
        const result = parseArgs(['-t=spa']);
        expect(result.template).toBe('spa');
      });
    });

    describe('space format (--template value)', () => {
      it('should parse --template spa', () => {
        const result = parseArgs(['--template', 'spa']);
        expect(result.template).toBe('spa');
      });

      it('should parse -t auth shorthand', () => {
        const result = parseArgs(['-t', 'auth']);
        expect(result.template).toBe('auth');
      });

      it('should parse template with project name', () => {
        const result = parseArgs(['my-app', '-t', 'rsc']);
        expect(result.projectName).toBe('my-app');
        expect(result.template).toBe('rsc');
      });
    });

    describe('template aliases', () => {
      it('should resolve default alias to spa', () => {
        const result = parseArgs(['--template=default']);
        expect(result.template).toBe('spa');
      });

      it('should resolve fullstack alias to rsc', () => {
        const result = parseArgs(['--template=fullstack']);
        expect(result.template).toBe('rsc');
      });
    });

    describe('template validation errors', () => {
      it('should exit for invalid template', () => {
        expect(() => parseArgs(['--template=invalid'])).toThrow('process.exit(1)');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Invalid template: invalid')
        );
      });

      it('should exit for empty template value in equals format', () => {
        expect(() => parseArgs(['--template='])).toThrow('process.exit(1)');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('--template requires a value')
        );
      });

      it('should exit when template value is missing', () => {
        expect(() => parseArgs(['--template'])).toThrow('process.exit(1)');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('--template requires a value')
        );
      });

      it('should exit when template value looks like a flag', () => {
        expect(() => parseArgs(['--template', '-d=sqlite'])).toThrow('process.exit(1)');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('--template requires a value')
        );
      });

      it('should exit for duplicate template flags', () => {
        expect(() => parseArgs(['--template=spa', '--template=auth'])).toThrow(
          'process.exit(1)'
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('--template flag specified multiple times')
        );
      });

      it('should exit for duplicate template flags (mixed formats)', () => {
        expect(() => parseArgs(['-t=spa', '--template', 'auth'])).toThrow('process.exit(1)');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('--template flag specified multiple times')
        );
      });
    });
  });

  // ============================================================================
  // Database Flag
  // ============================================================================

  describe('database flag', () => {
    describe('equals format (--database=value)', () => {
      it('should parse --database=sqlite', () => {
        const result = parseArgs(['--database=sqlite']);
        expect(result.database).toBe('sqlite');
      });

      it('should parse --database=postgresql', () => {
        const result = parseArgs(['--database=postgresql']);
        expect(result.database).toBe('postgresql');
      });

      it('should parse -d=sqlite shorthand', () => {
        const result = parseArgs(['-d=sqlite']);
        expect(result.database).toBe('sqlite');
      });
    });

    describe('space format (--database value)', () => {
      it('should parse --database sqlite', () => {
        const result = parseArgs(['--database', 'sqlite']);
        expect(result.database).toBe('sqlite');
      });

      it('should parse -d postgresql shorthand', () => {
        const result = parseArgs(['-d', 'postgresql']);
        expect(result.database).toBe('postgresql');
      });
    });

    describe('database validation errors', () => {
      it('should exit for invalid database', () => {
        expect(() => parseArgs(['--database=mongodb'])).toThrow('process.exit(1)');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Invalid database: mongodb')
        );
      });

      it('should exit for empty database value in equals format', () => {
        expect(() => parseArgs(['--database='])).toThrow('process.exit(1)');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('--database requires a value')
        );
      });

      it('should exit when database value is missing', () => {
        expect(() => parseArgs(['--database'])).toThrow('process.exit(1)');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('--database requires a value')
        );
      });

      it('should exit when database value looks like a flag', () => {
        expect(() => parseArgs(['--database', '--template=spa'])).toThrow('process.exit(1)');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('--database requires a value')
        );
      });

      it('should exit for unavailable database (mysql)', () => {
        expect(() => parseArgs(['--database=mysql'])).toThrow('process.exit(1)');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('not yet available')
        );
      });

      it('should exit for duplicate database flags', () => {
        expect(() => parseArgs(['--database=sqlite', '--database=postgresql'])).toThrow(
          'process.exit(1)'
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('--database flag specified multiple times')
        );
      });

      it('should exit for duplicate database flags (mixed formats)', () => {
        expect(() => parseArgs(['-d', 'sqlite', '-d=postgresql'])).toThrow('process.exit(1)');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('--database flag specified multiple times')
        );
      });
    });
  });

  // ============================================================================
  // Combined Arguments
  // ============================================================================

  describe('combined arguments', () => {
    it('should parse all arguments together', () => {
      const result = parseArgs([
        'my-app',
        '--template=auth',
        '--database=postgresql',
      ]);
      expect(result.projectName).toBe('my-app');
      expect(result.template).toBe('auth');
      expect(result.database).toBe('postgresql');
      expect(result.help).toBe(false);
      expect(result.version).toBe(false);
    });

    it('should parse all shorthand flags', () => {
      const result = parseArgs(['my-app', '-t', 'rsc-auth', '-d', 'sqlite']);
      expect(result.projectName).toBe('my-app');
      expect(result.template).toBe('rsc-auth');
      expect(result.database).toBe('sqlite');
    });

    it('should parse flags in any order', () => {
      const result = parseArgs(['-d=postgresql', 'my-app', '-t=spa']);
      expect(result.projectName).toBe('my-app');
      expect(result.template).toBe('spa');
      expect(result.database).toBe('postgresql');
    });

    it('should parse help with all other flags', () => {
      const result = parseArgs([
        '--help',
        'my-app',
        '--template=auth',
        '--database=sqlite',
      ]);
      expect(result.help).toBe(true);
      expect(result.projectName).toBe('my-app');
      expect(result.template).toBe('auth');
      expect(result.database).toBe('sqlite');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should warn about multiple project names', () => {
      const result = parseArgs(['my-app', 'another-app', 'third-app']);
      expect(result.projectName).toBe('my-app');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected arguments ignored: another-app, third-app')
      );
    });

    it('should handle project name with dashes', () => {
      const result = parseArgs(['my-cool-app']);
      expect(result.projectName).toBe('my-cool-app');
    });

    it('should handle project name with underscores', () => {
      const result = parseArgs(['my_app']);
      expect(result.projectName).toBe('my_app');
    });

    it('should handle project name with numbers', () => {
      const result = parseArgs(['app123']);
      expect(result.projectName).toBe('app123');
    });

    it('should handle project name starting with dot', () => {
      const result = parseArgs(['.hidden-app']);
      expect(result.projectName).toBe('.hidden-app');
    });

    it('should handle project name with @ prefix (scoped)', () => {
      const result = parseArgs(['@org/my-app']);
      expect(result.projectName).toBe('@org/my-app');
    });
  });
});

// ============================================================================
// ParsedArgs Interface Tests
// ============================================================================

describe('ParsedArgs interface', () => {
  it('should have correct shape for minimal result', () => {
    const result = parseArgs([]);
    const expected: ParsedArgs = {
      help: false,
      version: false,
    };
    expect(result).toEqual(expected);
  });

  it('should have correct shape for full result', () => {
    const result = parseArgs(['my-app', '-t=auth', '-d=postgresql']);
    const expected: ParsedArgs = {
      projectName: 'my-app',
      template: 'auth',
      database: 'postgresql',
      help: false,
      version: false,
    };
    expect(result).toEqual(expected);
  });

  it('should have undefined for optional fields when not provided', () => {
    const result = parseArgs(['my-app']);
    expect(result.template).toBeUndefined();
    expect(result.database).toBeUndefined();
  });
});
