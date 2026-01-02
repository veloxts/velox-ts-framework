/**
 * Tests for security-mapper module
 */

import { describe, expect, it } from 'vitest';

import type { GuardLike } from '../../types.js';
import {
  createSecurityRequirement,
  DEFAULT_GUARD_MAPPINGS,
  DEFAULT_SECURITY_SCHEMES,
  extractGuardScopes,
  extractUsedSecuritySchemes,
  filterUsedSecuritySchemes,
  guardsRequireAuth,
  guardsToSecurity,
  mapGuardToSecurity,
  mergeSecuritySchemes,
} from '../security-mapper.js';

// Helper to create mock guards
function createMockGuard(name: string): GuardLike<unknown> {
  return { name, check: () => true };
}

describe('security-mapper', () => {
  describe('DEFAULT_GUARD_MAPPINGS', () => {
    it('includes common auth guards', () => {
      expect(DEFAULT_GUARD_MAPPINGS.authenticated).toBe('bearerAuth');
      expect(DEFAULT_GUARD_MAPPINGS.hasRole).toBe('bearerAuth');
      expect(DEFAULT_GUARD_MAPPINGS.hasPermission).toBe('bearerAuth');
      expect(DEFAULT_GUARD_MAPPINGS.apiKey).toBe('apiKeyAuth');
    });
  });

  describe('DEFAULT_SECURITY_SCHEMES', () => {
    it('includes bearer auth scheme', () => {
      expect(DEFAULT_SECURITY_SCHEMES.bearerAuth).toEqual({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: expect.any(String),
      });
    });

    it('includes api key scheme', () => {
      expect(DEFAULT_SECURITY_SCHEMES.apiKeyAuth).toEqual({
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: expect.any(String),
      });
    });

    it('includes cookie auth scheme', () => {
      expect(DEFAULT_SECURITY_SCHEMES.cookieAuth).toEqual({
        type: 'apiKey',
        in: 'cookie',
        name: 'session',
        description: expect.any(String),
      });
    });
  });

  describe('mapGuardToSecurity', () => {
    it('maps authenticated guard to bearerAuth', () => {
      const result = mapGuardToSecurity(createMockGuard('authenticated'));
      expect(result).toEqual({ bearerAuth: [] });
    });

    it('maps apiKey guard to apiKeyAuth', () => {
      const result = mapGuardToSecurity(createMockGuard('apiKey'));
      expect(result).toEqual({ apiKeyAuth: [] });
    });

    it('extracts scopes from guard name', () => {
      const result = mapGuardToSecurity(createMockGuard('hasRole:admin'));
      expect(result).toEqual({ bearerAuth: ['admin'] });
    });

    it('extracts multiple scopes', () => {
      const result = mapGuardToSecurity(createMockGuard('hasRole:admin:moderator'));
      expect(result).toEqual({ bearerAuth: ['admin', 'moderator'] });
    });

    it('returns undefined for unmapped guards', () => {
      const result = mapGuardToSecurity(createMockGuard('customGuard'));
      expect(result).toBeUndefined();
    });

    it('uses custom mappings', () => {
      const result = mapGuardToSecurity(createMockGuard('customAuth'), {
        customMappings: { customAuth: 'oauth2' },
      });
      expect(result).toEqual({ oauth2: [] });
    });

    it('custom mappings take precedence', () => {
      const result = mapGuardToSecurity(createMockGuard('authenticated'), {
        customMappings: { authenticated: 'customScheme' },
      });
      expect(result).toEqual({ customScheme: [] });
    });

    it('can disable scope extraction', () => {
      const result = mapGuardToSecurity(createMockGuard('hasRole:admin'), {
        extractScopes: false,
      });
      expect(result).toEqual({ bearerAuth: [] });
    });
  });

  describe('guardsToSecurity', () => {
    it('maps multiple guards to security requirements', () => {
      const guards = [createMockGuard('authenticated'), createMockGuard('hasRole:admin')];

      const result = guardsToSecurity(guards);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ bearerAuth: [] });
      expect(result).toContainEqual({ bearerAuth: ['admin'] });
    });

    it('deduplicates identical requirements', () => {
      const guards = [createMockGuard('authenticated'), createMockGuard('requireAuth')];

      const result = guardsToSecurity(guards);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ bearerAuth: [] });
    });

    it('returns empty array for empty guards', () => {
      const result = guardsToSecurity([]);
      expect(result).toEqual([]);
    });

    it('filters out unmapped guards', () => {
      const guards = [createMockGuard('authenticated'), createMockGuard('customGuard')];

      const result = guardsToSecurity(guards);
      expect(result).toHaveLength(1);
    });
  });

  describe('mergeSecuritySchemes', () => {
    it('returns default schemes by default', () => {
      const result = mergeSecuritySchemes();
      expect(result).toEqual(DEFAULT_SECURITY_SCHEMES);
    });

    it('merges custom schemes with defaults', () => {
      const custom = {
        oauth2: { type: 'oauth2' as const },
      };

      const result = mergeSecuritySchemes(custom);
      expect(result.bearerAuth).toBeDefined();
      expect(result.oauth2).toEqual({ type: 'oauth2' });
    });

    it('custom schemes override defaults', () => {
      const custom = {
        bearerAuth: { type: 'http' as const, scheme: 'bearer', bearerFormat: 'custom' },
      };

      const result = mergeSecuritySchemes(custom);
      expect(result.bearerAuth.bearerFormat).toBe('custom');
    });

    it('can exclude defaults', () => {
      const custom = {
        oauth2: { type: 'oauth2' as const },
      };

      const result = mergeSecuritySchemes(custom, false);
      expect(result).toEqual(custom);
      expect(result.bearerAuth).toBeUndefined();
    });
  });

  describe('extractUsedSecuritySchemes', () => {
    it('extracts scheme names from guards', () => {
      const guards = [createMockGuard('authenticated'), createMockGuard('apiKey')];

      const result = extractUsedSecuritySchemes(guards);
      expect(result.has('bearerAuth')).toBe(true);
      expect(result.has('apiKeyAuth')).toBe(true);
    });

    it('returns empty set for unmapped guards', () => {
      const guards = [createMockGuard('customGuard')];

      const result = extractUsedSecuritySchemes(guards);
      expect(result.size).toBe(0);
    });
  });

  describe('filterUsedSecuritySchemes', () => {
    it('filters to only used schemes', () => {
      const allSchemes = {
        bearerAuth: { type: 'http' as const, scheme: 'bearer' },
        apiKeyAuth: { type: 'apiKey' as const, in: 'header' as const, name: 'X-API-Key' },
        oauth2: { type: 'oauth2' as const },
      };

      const usedNames = new Set(['bearerAuth']);
      const result = filterUsedSecuritySchemes(allSchemes, usedNames);

      expect(Object.keys(result)).toEqual(['bearerAuth']);
    });

    it('returns empty object when no schemes used', () => {
      const result = filterUsedSecuritySchemes(DEFAULT_SECURITY_SCHEMES, new Set());
      expect(result).toEqual({});
    });
  });

  describe('guardsRequireAuth', () => {
    it('returns true when guards map to security', () => {
      const guards = [createMockGuard('authenticated')];
      expect(guardsRequireAuth(guards)).toBe(true);
    });

    it('returns false for empty guards', () => {
      expect(guardsRequireAuth([])).toBe(false);
    });

    it('returns false when no guards map to security', () => {
      const guards = [createMockGuard('customGuard')];
      expect(guardsRequireAuth(guards)).toBe(false);
    });
  });

  describe('extractGuardScopes', () => {
    it('extracts scopes from guards', () => {
      const guards = [createMockGuard('hasRole:admin'), createMockGuard('hasRole:moderator')];

      const result = extractGuardScopes(guards);
      expect(result).toContain('admin');
      expect(result).toContain('moderator');
    });

    it('returns empty array for guards without scopes', () => {
      const guards = [createMockGuard('authenticated')];

      const result = extractGuardScopes(guards);
      expect(result).toEqual([]);
    });

    it('deduplicates scopes', () => {
      const guards = [createMockGuard('hasRole:admin'), createMockGuard('hasRole:admin')];

      const result = extractGuardScopes(guards);
      expect(result).toEqual(['admin']);
    });
  });

  describe('createSecurityRequirement', () => {
    it('creates requirement without scopes', () => {
      const result = createSecurityRequirement('bearerAuth');
      expect(result).toEqual({ bearerAuth: [] });
    });

    it('creates requirement with scopes', () => {
      const result = createSecurityRequirement('bearerAuth', ['read', 'write']);
      expect(result).toEqual({ bearerAuth: ['read', 'write'] });
    });
  });
});
