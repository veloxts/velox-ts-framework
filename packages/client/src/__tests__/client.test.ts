/**
 * @veloxts/client - Client Implementation Tests
 */

import { describe, expect, it, vi } from 'vitest';

import { createClient } from '../client.js';
import {
  ClientNotFoundError,
  ClientValidationError,
  NetworkError,
  ServerError,
  VeloxClientError,
} from '../errors.js';

/**
 * Creates a mock fetch function that returns configured responses
 */
function createMockFetch(
  responses: Array<{
    status: number;
    body: unknown;
    headers?: Record<string, string>;
  }>
) {
  let callIndex = 0;

  return vi.fn().mockImplementation(async () => {
    const response = responses[callIndex] || responses[responses.length - 1];
    callIndex++;

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      headers: new Headers({
        'content-type': 'application/json',
        ...response.headers,
      }),
      json: async () => response.body,
      text: async () =>
        typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
    };
  });
}

describe('createClient', () => {
  describe('basic functionality', () => {
    it('should create a client with config', () => {
      const client = createClient<Record<string, unknown>>({
        baseUrl: 'https://api.example.com',
      });

      expect(client).toBeDefined();
    });

    it('should use provided fetch implementation', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { id: '123', name: 'Test' } }]);

      const client = createClient<{
        users: {
          procedures: {
            getUser: { inputSchema: { parse: (i: unknown) => { id: string } } };
          };
        };
      }>({
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
      });

      await client.users.getUser({ id: '123' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('HTTP method inference', () => {
    it('should use GET for getX procedures', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { id: '123' } }]);

      const client = createClient<{
        users: {
          procedures: {
            getUser: { inputSchema: { parse: (i: unknown) => { id: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.users.getUser({ id: '123' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should use GET for listX procedures', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: [] }]);

      const client = createClient<{
        users: {
          procedures: {
            listUsers: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.users.listUsers({});

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should use POST for createX procedures', async () => {
      const mockFetch = createMockFetch([{ status: 201, body: { id: '123', name: 'New User' } }]);

      const client = createClient<{
        users: {
          procedures: {
            createUser: { inputSchema: { parse: (i: unknown) => { name: string; email: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.users.createUser({ name: 'New User', email: 'test@example.com' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New User', email: 'test@example.com' }),
        })
      );
    });

    it('should use PUT for updateX procedures', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { id: '123', name: 'Updated' } }]);

      const client = createClient<{
        users: {
          procedures: {
            updateUser: { inputSchema: { parse: (i: unknown) => { id: string; name: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.users.updateUser({ id: '123', name: 'Updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should use DELETE for deleteX procedures', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { success: true } }]);

      const client = createClient<{
        users: {
          procedures: {
            deleteUser: { inputSchema: { parse: (i: unknown) => { id: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.users.deleteUser({ id: '123' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should use POST for unknown procedure names', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: {} }]);

      const client = createClient<{
        custom: {
          procedures: {
            doSomething: { inputSchema: { parse: (i: unknown) => Record<string, unknown> } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.custom.doSomething({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('URL building', () => {
    it('should build correct URL for list operations', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: [] }]);

      const client = createClient<{
        users: {
          procedures: {
            listUsers: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
      });

      await client.users.listUsers({});

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/users', expect.any(Object));
    });

    it('should include path parameters for get operations', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { id: '123' } }]);

      const client = createClient<{
        users: {
          procedures: {
            getUser: { inputSchema: { parse: (i: unknown) => { id: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.users.getUser({ id: '123' });

      expect(mockFetch).toHaveBeenCalledWith('/api/users/123', expect.any(Object));
    });

    it('should add query parameters for GET requests', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: [] }]);

      const client = createClient<{
        users: {
          procedures: {
            listUsers: {
              inputSchema: { parse: (i: unknown) => { page?: number; limit?: number } };
            };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.users.listUsers({ page: 2, limit: 10 });

      expect(mockFetch).toHaveBeenCalledWith('/api/users?page=2&limit=10', expect.any(Object));
    });

    it('should handle array query parameters', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: [] }]);

      const client = createClient<{
        items: {
          procedures: {
            findItems: { inputSchema: { parse: (i: unknown) => { tags: string[] } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.items.findItems({ tags: ['a', 'b', 'c'] });

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('tags=a'), expect.any(Object));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('tags=b'), expect.any(Object));
    });

    it('should skip undefined values in query params', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: [] }]);

      const client = createClient<{
        users: {
          procedures: {
            listUsers: {
              inputSchema: { parse: (i: unknown) => { page?: number; search?: string } };
            };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.users.listUsers({ page: 1, search: undefined });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).not.toContain('search');
    });
  });

  describe('request body', () => {
    it('should send JSON body for POST requests', async () => {
      const mockFetch = createMockFetch([{ status: 201, body: { id: '123' } }]);

      const client = createClient<{
        users: {
          procedures: {
            createUser: { inputSchema: { parse: (i: unknown) => { name: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.users.createUser({ name: 'Test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ name: 'Test' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should exclude path params from body for update operations', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { id: '123' } }]);

      const client = createClient<{
        users: {
          procedures: {
            updateUser: { inputSchema: { parse: (i: unknown) => { id: string; name: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.users.updateUser({ id: '123', name: 'Updated' });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);

      // id should be in URL, not in body
      expect(body).toEqual({ name: 'Updated' });
    });
  });

  describe('headers', () => {
    it('should include custom headers', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: [] }]);

      const client = createClient<{
        auth: {
          procedures: {
            listProfiles: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        headers: {
          Authorization: 'Bearer token123',
          'X-Custom-Header': 'custom-value',
        },
        fetch: mockFetch,
      });

      await client.auth.listProfiles({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
            'X-Custom-Header': 'custom-value',
          }),
        })
      );
    });

    it('should always include Content-Type header', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: [] }]);

      const client = createClient<{
        test: {
          procedures: {
            listData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.test.listData({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('interceptors', () => {
    it('should call onRequest before request', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: [] }]);
      const onRequest = vi.fn();

      const client = createClient<{
        test: {
          procedures: {
            listData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        onRequest,
        fetch: mockFetch,
      });

      await client.test.listData({});

      expect(onRequest).toHaveBeenCalledTimes(1);
      expect(onRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api'),
        expect.objectContaining({ method: expect.any(String) })
      );
      expect(onRequest.mock.invocationCallOrder[0]).toBeLessThan(
        mockFetch.mock.invocationCallOrder[0]
      );
    });

    it('should call onResponse after successful request', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: [] }]);
      const onResponse = vi.fn();

      const client = createClient<{
        test: {
          procedures: {
            listData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        onResponse,
        fetch: mockFetch,
      });

      await client.test.listData({});

      expect(onResponse).toHaveBeenCalledTimes(1);
      expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('should not call onResponse for error responses', async () => {
      const mockFetch = createMockFetch([
        { status: 400, body: { error: 'BadRequest', message: 'Invalid', statusCode: 400 } },
      ]);
      const onResponse = vi.fn();

      const client = createClient<{
        test: {
          procedures: {
            createData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        onResponse,
        fetch: mockFetch,
      });

      try {
        await client.test.createData({});
      } catch {
        // Expected
      }

      expect(onResponse).not.toHaveBeenCalled();
    });

    it('should call onError for error responses', async () => {
      const mockFetch = createMockFetch([
        { status: 400, body: { error: 'BadRequest', message: 'Invalid', statusCode: 400 } },
      ]);
      const onError = vi.fn();

      const client = createClient<{
        test: {
          procedures: {
            createData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        onError,
        fetch: mockFetch,
      });

      try {
        await client.test.createData({});
      } catch {
        // Expected
      }

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.any(VeloxClientError));
    });

    it('should call onError for network errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const onError = vi.fn();

      const client = createClient<{
        test: {
          procedures: {
            listData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        onError,
        fetch: mockFetch,
      });

      try {
        await client.test.listData({});
      } catch {
        // Expected
      }

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.any(NetworkError));
    });
  });

  describe('error handling', () => {
    it('should throw NetworkError on fetch failure', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const client = createClient<{
        test: {
          procedures: {
            listData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await expect(client.test.listData({})).rejects.toThrow(NetworkError);
    });

    it('should throw ClientValidationError for 400 validation errors', async () => {
      const mockFetch = createMockFetch([
        {
          status: 400,
          body: {
            error: 'ValidationError',
            message: 'Invalid input',
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            fields: { email: 'Invalid format' },
          },
        },
      ]);

      const client = createClient<{
        users: {
          procedures: {
            createUser: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await expect(client.users.createUser({})).rejects.toThrow(ClientValidationError);
    });

    it('should throw ClientNotFoundError for 404 errors', async () => {
      const mockFetch = createMockFetch([
        {
          status: 404,
          body: {
            error: 'NotFoundError',
            message: 'User not found',
            statusCode: 404,
            code: 'NOT_FOUND',
            resource: 'User',
          },
        },
      ]);

      const client = createClient<{
        users: {
          procedures: {
            getUser: { inputSchema: { parse: (i: unknown) => { id: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await expect(client.users.getUser({ id: 'nonexistent' })).rejects.toThrow(
        ClientNotFoundError
      );
    });

    it('should throw ServerError for 5xx errors', async () => {
      const mockFetch = createMockFetch([
        {
          status: 500,
          body: {
            error: 'InternalError',
            message: 'Internal server error',
            statusCode: 500,
          },
        },
      ]);

      const client = createClient<{
        test: {
          procedures: {
            listData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await expect(client.test.listData({})).rejects.toThrow(ServerError);
    });

    it('should handle non-JSON error responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'Internal Server Error',
      });

      const client = createClient<{
        test: {
          procedures: {
            listData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await expect(client.test.listData({})).rejects.toThrow(ServerError);
    });
  });

  describe('response parsing', () => {
    it('should parse JSON responses', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { id: '123', name: 'Test User' } }]);

      const client = createClient<{
        users: {
          procedures: {
            getUser: { inputSchema: { parse: (i: unknown) => { id: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      const result = await client.users.getUser({ id: '123' });

      expect(result).toEqual({ id: '123', name: 'Test User' });
    });

    it('should handle text responses for non-JSON content-type', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'Success',
      });

      const client = createClient<{
        test: {
          procedures: {
            listData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      const result = await client.test.listData({});

      expect(result).toBe('Success');
    });
  });

  describe('proxy behavior', () => {
    it('should support multiple namespaces', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: { id: '1' } },
        { status: 200, body: { id: '2' } },
      ]);

      const client = createClient<{
        users: {
          procedures: {
            getUser: { inputSchema: { parse: (i: unknown) => { id: string } } };
          };
        };
        posts: {
          procedures: {
            getPost: { inputSchema: { parse: (i: unknown) => { id: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.users.getUser({ id: '1' });
      await client.posts.getPost({ id: '2' });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/users/1', expect.any(Object));
      expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/posts/2', expect.any(Object));
    });

    it('should support multiple procedures in same namespace', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: [] },
        { status: 200, body: { id: '1' } },
        { status: 201, body: { id: '2' } },
      ]);

      const client = createClient<{
        users: {
          procedures: {
            listUsers: { inputSchema: { parse: (i: unknown) => void } };
            getUser: { inputSchema: { parse: (i: unknown) => { id: string } } };
            createUser: { inputSchema: { parse: (i: unknown) => { name: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.users.listUsers({});
      await client.users.getUser({ id: '1' });
      await client.users.createUser({ name: 'New' });

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('additional naming conventions', () => {
    it('should use POST for addX procedures', async () => {
      const mockFetch = createMockFetch([{ status: 201, body: { id: '123' } }]);

      const client = createClient<{
        items: {
          procedures: {
            addItem: { inputSchema: { parse: (i: unknown) => { name: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.items.addItem({ name: 'New Item' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/items',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should use PUT for editX procedures', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { id: '123' } }]);

      const client = createClient<{
        items: {
          procedures: {
            editItem: { inputSchema: { parse: (i: unknown) => { id: string; name: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.items.editItem({ id: '123', name: 'Edited' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/items'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should use PATCH for patchX procedures', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { id: '123' } }]);

      const client = createClient<{
        users: {
          procedures: {
            patchUser: { inputSchema: { parse: (i: unknown) => { id: string; email?: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.users.patchUser({ id: '123', email: 'new@example.com' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('should use DELETE for removeX procedures', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { success: true } }]);

      const client = createClient<{
        items: {
          procedures: {
            removeItem: { inputSchema: { parse: (i: unknown) => { id: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.items.removeItem({ id: '123' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/items'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should use GET for findX procedures', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: [] }]);

      const client = createClient<{
        items: {
          procedures: {
            findItems: { inputSchema: { parse: (i: unknown) => { query?: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.items.findItems({ query: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/items'),
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('edge cases', () => {
    it('should throw error for missing path parameter', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: {} }]);

      const client = createClient<{
        users: {
          procedures: {
            getUser: { inputSchema: { parse: (i: unknown) => { id?: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      // Missing required id parameter
      await expect(client.users.getUser({})).rejects.toThrow('Missing path parameter: id');
    });

    it('should throw error for null path parameter', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: {} }]);

      const client = createClient<{
        users: {
          procedures: {
            getUser: { inputSchema: { parse: (i: unknown) => Record<string, unknown> } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      // Explicitly null id parameter
      await expect(client.users.getUser({ id: null })).rejects.toThrow('Missing path parameter: id');
    });

    it('should handle malformed JSON response gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => {
          throw new Error('Invalid JSON');
        },
        text: async () => 'Fallback text response',
      });

      const client = createClient<{
        test: {
          procedures: {
            listData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      const result = await client.test.listData({});

      expect(result).toBe('Fallback text response');
    });

    it('should handle async interceptors', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { data: 'test' } }]);
      const onRequest = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      const onResponse = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const client = createClient<{
        test: {
          procedures: {
            listData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        onRequest,
        onResponse,
        fetch: mockFetch,
      });

      await client.test.listData({});

      expect(onRequest).toHaveBeenCalled();
      expect(onResponse).toHaveBeenCalled();
    });

    it('should handle async error interceptor', async () => {
      const mockFetch = createMockFetch([
        { status: 500, body: { error: 'ServerError', message: 'Error', statusCode: 500 } },
      ]);
      const onError = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const client = createClient<{
        test: {
          procedures: {
            listData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        onError,
        fetch: mockFetch,
      });

      await expect(client.test.listData({})).rejects.toThrow();

      expect(onError).toHaveBeenCalled();
    });

    it('should handle GET request with no input', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: [] }]);

      const client = createClient<{
        items: {
          procedures: {
            listItems: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      // Call with undefined/null input
      await client.items.listItems(undefined as unknown as void);

      expect(mockFetch).toHaveBeenCalledWith('/api/items', expect.any(Object));
    });

    it('should handle network error with non-Error object', async () => {
      // Mock fetch that throws a non-Error object (e.g., string, DOMException, etc.)
      const mockFetch = vi.fn().mockRejectedValue('Network failure');

      const client = createClient<{
        test: {
          procedures: {
            listData: { inputSchema: { parse: (i: unknown) => void } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await expect(client.test.listData({})).rejects.toThrow(NetworkError);
    });

    it('should handle DELETE request with path params and body', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { success: true } }]);

      const client = createClient<{
        posts: {
          procedures: {
            deletePost: {
              inputSchema: { parse: (i: unknown) => { id: string; reason?: string } };
            };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.posts.deletePost({ id: '123', reason: 'spam' });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);

      // id should be in URL, reason in body
      expect(body).toEqual({ reason: 'spam' });
    });

    it('should handle PATCH request without path params', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { updated: true } }]);

      const client = createClient<{
        settings: {
          procedures: {
            patchSettings: { inputSchema: { parse: (i: unknown) => { theme: string } } };
          };
        };
      }>({
        baseUrl: '/api',
        fetch: mockFetch,
      });

      await client.settings.patchSettings({ theme: 'dark' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/settings',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ theme: 'dark' }),
        })
      );
    });
  });
});
