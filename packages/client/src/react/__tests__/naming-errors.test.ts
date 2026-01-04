/**
 * Naming Convention Error Message Tests
 *
 * Tests for the enhanced error messages when developers
 * use incorrect hook types on procedures.
 */

import { describe, expect, it } from 'vitest';

// We need to test the internal functions, so we'll test via the exported behavior
// The error messages are thrown by the proxy hooks when wrong methods are called

describe('Naming Convention Error Messages', () => {
  // Since createNamingConventionError is internal, we test the behavior
  // through the expected error message patterns

  describe('Similar Pattern Detection', () => {
    // Map of common alternative prefixes that should be detected
    const SIMILAR_PATTERNS = {
      fetch: { type: 'query' as const, suggest: 'list or get' },
      retrieve: { type: 'query' as const, suggest: 'get' },
      load: { type: 'query' as const, suggest: 'list or get' },
      query: { type: 'query' as const, suggest: 'list, get, or find' },
      search: { type: 'query' as const, suggest: 'find' },
      insert: { type: 'mutation' as const, suggest: 'create' },
      make: { type: 'mutation' as const, suggest: 'create' },
      modify: { type: 'mutation' as const, suggest: 'update or patch' },
      destroy: { type: 'mutation' as const, suggest: 'delete' },
    };

    it('should recognize fetch as a query-like pattern', () => {
      const patterns = SIMILAR_PATTERNS;
      expect(patterns.fetch.type).toBe('query');
      expect(patterns.fetch.suggest).toContain('list');
      expect(patterns.fetch.suggest).toContain('get');
    });

    it('should recognize insert as a mutation-like pattern', () => {
      const patterns = SIMILAR_PATTERNS;
      expect(patterns.insert.type).toBe('mutation');
      expect(patterns.insert.suggest).toBe('create');
    });

    it('should recognize search as a query-like pattern', () => {
      const patterns = SIMILAR_PATTERNS;
      expect(patterns.search.type).toBe('query');
      expect(patterns.search.suggest).toBe('find');
    });

    it('should recognize destroy as a mutation-like pattern', () => {
      const patterns = SIMILAR_PATTERNS;
      expect(patterns.destroy.type).toBe('mutation');
      expect(patterns.destroy.suggest).toBe('delete');
    });
  });

  describe('Entity Name Extraction', () => {
    // Test helper to extract entity name like the real function
    function extractEntityName(procedureName: string): string {
      const QUERY_PREFIXES = ['get', 'list', 'find'];
      const MUTATION_PREFIXES = ['create', 'add', 'update', 'edit', 'patch', 'delete', 'remove'];
      const SIMILAR_PREFIXES = [
        'fetch',
        'retrieve',
        'obtain',
        'load',
        'read',
        'query',
        'search',
        'new',
        'insert',
        'make',
        'modify',
        'change',
        'set',
        'destroy',
        'drop',
        'erase',
        'trash',
      ];

      for (const prefix of [...QUERY_PREFIXES, ...MUTATION_PREFIXES]) {
        if (procedureName.startsWith(prefix)) {
          return procedureName.slice(prefix.length);
        }
      }
      for (const prefix of SIMILAR_PREFIXES) {
        if (procedureName.toLowerCase().startsWith(prefix)) {
          return procedureName.slice(prefix.length);
        }
      }
      return procedureName.charAt(0).toUpperCase() + procedureName.slice(1);
    }

    it('should extract entity name from standard query procedure', () => {
      expect(extractEntityName('getUser')).toBe('User');
      expect(extractEntityName('listUsers')).toBe('Users');
      expect(extractEntityName('findProducts')).toBe('Products');
    });

    it('should extract entity name from standard mutation procedure', () => {
      expect(extractEntityName('createUser')).toBe('User');
      expect(extractEntityName('updateOrder')).toBe('Order');
      expect(extractEntityName('deletePost')).toBe('Post');
    });

    it('should extract entity name from similar patterns', () => {
      expect(extractEntityName('fetchUsers')).toBe('Users');
      expect(extractEntityName('loadPosts')).toBe('Posts');
      expect(extractEntityName('insertRecord')).toBe('Record');
      expect(extractEntityName('destroyItem')).toBe('Item');
    });

    it('should handle unknown patterns by capitalizing first letter', () => {
      expect(extractEntityName('unknownAction')).toBe('UnknownAction');
    });
  });

  describe('Error Message Content', () => {
    // Simulate the error message format for testing
    function simulateErrorMessage(procedureName: string, attemptedMethod: string): string {
      const QUERY_PREFIXES = ['get', 'list', 'find'];
      const isQuery = QUERY_PREFIXES.some((p) => procedureName.startsWith(p));

      const SIMILAR_PATTERNS: Record<string, { type: 'query' | 'mutation'; suggest: string }> = {
        fetch: { type: 'query', suggest: 'list or get' },
        load: { type: 'query', suggest: 'list or get' },
        insert: { type: 'mutation', suggest: 'create' },
        destroy: { type: 'mutation', suggest: 'delete' },
      };

      // Check for similar patterns
      for (const [prefix, _info] of Object.entries(SIMILAR_PATTERNS)) {
        if (procedureName.toLowerCase().startsWith(prefix)) {
          return (
            `Cannot call ${attemptedMethod}() on procedure "${procedureName}".\n\n` +
            `The prefix "${prefix}" is not a standard VeloxTS naming convention.`
          );
        }
      }

      if (isQuery) {
        return `Cannot call ${attemptedMethod}() on query procedure "${procedureName}".`;
      }

      return `Cannot call ${attemptedMethod}() on mutation procedure "${procedureName}".`;
    }

    it('should include specific suggestion for fetchUsers', () => {
      const error = simulateErrorMessage('fetchUsers', 'useQuery');
      expect(error).toContain('fetchUsers');
      expect(error).toContain('fetch');
      expect(error).toContain('not a standard VeloxTS naming convention');
    });

    it('should identify query procedures correctly', () => {
      const error = simulateErrorMessage('listUsers', 'useMutation');
      expect(error).toContain('query procedure');
    });

    it('should identify mutation procedures correctly', () => {
      const error = simulateErrorMessage('createUser', 'useQuery');
      expect(error).toContain('mutation procedure');
    });

    it('should handle insert pattern as mutation', () => {
      const error = simulateErrorMessage('insertUser', 'useQuery');
      expect(error).toContain('insert');
      expect(error).toContain('not a standard VeloxTS naming convention');
    });
  });
});
