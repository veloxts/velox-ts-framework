/**
 * Tests for path-extractor module
 */

import { describe, expect, it } from 'vitest';

import {
  buildParameters,
  convertFromOpenAPIPath,
  convertToOpenAPIPath,
  extractPathParamNames,
  extractQueryParameters,
  extractResourceFromPath,
  hasPathParameters,
  joinPaths,
  normalizePath,
  parsePathParameters,
} from '../path-extractor.js';

describe('path-extractor', () => {
  describe('convertToOpenAPIPath', () => {
    it('converts single parameter', () => {
      expect(convertToOpenAPIPath('/users/:id')).toBe('/users/{id}');
    });

    it('converts multiple parameters', () => {
      expect(convertToOpenAPIPath('/posts/:postId/comments/:id')).toBe(
        '/posts/{postId}/comments/{id}'
      );
    });

    it('handles paths without parameters', () => {
      expect(convertToOpenAPIPath('/users')).toBe('/users');
    });

    it('handles underscore in parameter names', () => {
      expect(convertToOpenAPIPath('/users/:user_id')).toBe('/users/{user_id}');
    });
  });

  describe('convertFromOpenAPIPath', () => {
    it('converts single parameter', () => {
      expect(convertFromOpenAPIPath('/users/{id}')).toBe('/users/:id');
    });

    it('converts multiple parameters', () => {
      expect(convertFromOpenAPIPath('/posts/{postId}/comments/{id}')).toBe(
        '/posts/:postId/comments/:id'
      );
    });

    it('handles paths without parameters', () => {
      expect(convertFromOpenAPIPath('/users')).toBe('/users');
    });
  });

  describe('extractPathParamNames', () => {
    it('extracts single parameter', () => {
      expect(extractPathParamNames('/users/:id')).toEqual(['id']);
    });

    it('extracts multiple parameters', () => {
      expect(extractPathParamNames('/posts/:postId/comments/:id')).toEqual(['postId', 'id']);
    });

    it('returns empty array for paths without parameters', () => {
      expect(extractPathParamNames('/users')).toEqual([]);
    });
  });

  describe('parsePathParameters', () => {
    it('parses single parameter', () => {
      const params = parsePathParameters('/users/:id');
      expect(params).toHaveLength(1);
      expect(params[0]).toEqual({
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      });
    });

    it('parses multiple parameters', () => {
      const params = parsePathParameters('/posts/:postId/comments/:id');
      expect(params).toHaveLength(2);
      expect(params[0].name).toBe('postId');
      expect(params[1].name).toBe('id');
    });

    it('uses custom schemas when provided', () => {
      const params = parsePathParameters('/users/:id', {
        id: { type: 'string', format: 'uuid' },
      });
      expect(params[0].schema).toEqual({ type: 'string', format: 'uuid' });
    });
  });

  describe('hasPathParameters', () => {
    it('returns true for paths with parameters', () => {
      expect(hasPathParameters('/users/:id')).toBe(true);
    });

    it('returns false for paths without parameters', () => {
      expect(hasPathParameters('/users')).toBe(false);
    });
  });

  describe('extractQueryParameters', () => {
    it('extracts all properties as query params', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
        },
      };

      const params = extractQueryParameters(schema);
      expect(params).toHaveLength(2);
      expect(params[0].name).toBe('page');
      expect(params[0].in).toBe('query');
      expect(params[1].name).toBe('limit');
    });

    it('excludes specified properties', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          id: { type: 'string' },
          page: { type: 'integer' },
        },
      };

      const params = extractQueryParameters(schema, { exclude: ['id'] });
      expect(params).toHaveLength(1);
      expect(params[0].name).toBe('page');
    });

    it('marks required properties', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
        },
        required: ['page'],
      };

      const params = extractQueryParameters(schema);
      const pageParam = params.find((p) => p.name === 'page');
      const limitParam = params.find((p) => p.name === 'limit');
      expect(pageParam?.required).toBe(true);
      expect(limitParam?.required).toBe(false);
    });

    it('returns empty array for non-object schemas', () => {
      expect(extractQueryParameters({ type: 'string' })).toEqual([]);
      expect(extractQueryParameters(undefined)).toEqual([]);
    });
  });

  describe('buildParameters', () => {
    it('builds path and query parameters for GET', () => {
      const result = buildParameters({
        path: '/users/:id',
        method: 'GET',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            include: { type: 'string' },
          },
        },
      });

      expect(result.pathParams).toHaveLength(1);
      expect(result.pathParams[0].name).toBe('id');
      expect(result.queryParams).toHaveLength(1);
      expect(result.queryParams[0].name).toBe('include');
      expect(result.pathParamNames).toEqual(['id']);
    });

    it('does not extract query params for POST', () => {
      const result = buildParameters({
        path: '/users',
        method: 'POST',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
        },
      });

      expect(result.pathParams).toHaveLength(0);
      expect(result.queryParams).toHaveLength(0);
    });

    it('extracts query params for DELETE', () => {
      const result = buildParameters({
        path: '/users/:id',
        method: 'DELETE',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            force: { type: 'boolean' },
          },
        },
      });

      expect(result.queryParams).toHaveLength(1);
      expect(result.queryParams[0].name).toBe('force');
    });
  });

  describe('joinPaths', () => {
    it('joins path segments', () => {
      expect(joinPaths('/api', '/users')).toBe('/api/users');
    });

    it('handles trailing/leading slashes', () => {
      expect(joinPaths('/api/', '/users/')).toBe('/api/users');
    });

    it('handles empty segments', () => {
      expect(joinPaths('', '/users')).toBe('/users');
    });

    it('handles multiple segments', () => {
      expect(joinPaths('/api', '/v1', '/users')).toBe('/api/v1/users');
    });
  });

  describe('normalizePath', () => {
    it('removes duplicate slashes', () => {
      expect(normalizePath('/api//users')).toBe('/api/users');
    });

    it('ensures leading slash', () => {
      expect(normalizePath('api/users')).toBe('/api/users');
    });

    it('removes trailing slash', () => {
      expect(normalizePath('/api/users/')).toBe('/api/users');
    });

    it('preserves root path', () => {
      expect(normalizePath('/')).toBe('/');
    });
  });

  describe('extractResourceFromPath', () => {
    it('extracts resource from simple path', () => {
      expect(extractResourceFromPath('/api/users')).toBe('users');
    });

    it('extracts resource before parameter', () => {
      expect(extractResourceFromPath('/api/users/:id')).toBe('users');
    });

    it('extracts nested resource', () => {
      expect(extractResourceFromPath('/api/posts/:postId/comments/:id')).toBe('comments');
    });

    it('returns undefined for parameter-only paths', () => {
      expect(extractResourceFromPath('/:id')).toBeUndefined();
    });
  });
});
