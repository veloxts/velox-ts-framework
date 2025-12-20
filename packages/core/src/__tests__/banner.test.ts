/**
 * @veloxts/core - Banner Unit Tests
 * Tests for startup banner functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { printBanner } from '../utils/banner.js';

describe('Banner', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('printBanner', () => {
    it('should print production banner as single line', () => {
      const mockServer = {
        // Minimal mock - no routes needed for production mode
      };

      printBanner(mockServer as never, {
        address: 'http://127.0.0.1:3030',
        env: 'production',
        startTime: performance.now() - 100,
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('VeloxTS');
      expect(output).toContain('production');
      expect(output).toContain('http://127.0.0.1:3030');
    });

    it('should print development banner with details', () => {
      const mockServer = {
        printRoutes: () => '',
      };

      printBanner(mockServer as never, {
        address: 'http://127.0.0.1:3030',
        env: 'development',
        startTime: performance.now() - 50,
      });

      // Development mode prints multiple lines
      expect(consoleSpy.mock.calls.length).toBeGreaterThan(1);

      // Check for key elements
      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('VeloxTS');
      expect(allOutput).toContain('development');
      expect(allOutput).toContain('Ready');
    });

    it('should print routes when available', () => {
      // Mock server with printRoutes returning route tree format
      // Format: "/path (METHOD1, METHOD2)"
      const mockServer = {
        printRoutes: () => `└── /users (GET, POST)
    └── /health (GET)
`,
      };

      printBanner(mockServer as never, {
        address: 'http://127.0.0.1:3030',
        env: 'development',
        startTime: performance.now() - 50,
      });

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Routes');
      expect(allOutput).toContain('registered');
    });

    it('should show "... and N more" when more than 10 routes', () => {
      // Create route tree output with 15 routes
      // Each line should have format: "/path (METHOD)"
      const routeLines = Array.from({ length: 15 }, (_, i) => `└── /route${i} (GET)`).join('\n');
      const mockServer = {
        printRoutes: () => routeLines,
      };

      printBanner(mockServer as never, {
        address: 'http://127.0.0.1:3030',
        env: 'development',
        startTime: performance.now() - 50,
      });

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('... and 5 more');
    });

    it('should sort routes with GET first for same path', () => {
      // Test route sorting - GET should come before POST for same path
      const mockServer = {
        printRoutes: () => `└── /users (POST)
└── /users (GET)
└── /users (DELETE)
`,
      };

      printBanner(mockServer as never, {
        address: 'http://127.0.0.1:3030',
        env: 'development',
        startTime: performance.now() - 50,
      });

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      // GET should appear before POST due to sorting
      const getIndex = allOutput.indexOf('GET');
      const postIndex = allOutput.indexOf('POST');
      expect(getIndex).toBeLessThan(postIndex);
    });

    it('should handle test environment like development', () => {
      const mockServer = {
        printRoutes: () => '',
      };

      printBanner(mockServer as never, {
        address: 'http://127.0.0.1:3030',
        env: 'test',
        startTime: performance.now() - 50,
      });

      // Test mode should not use production format
      expect(consoleSpy.mock.calls.length).toBeGreaterThan(1);
    });
  });
});
