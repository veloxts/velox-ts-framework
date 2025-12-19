/**
 * Tests for tRPC Bridge
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createActions, createTrpcBridge, TrpcBridgeError, wrapProcedure } from './bridge.js';
import { isError, isSuccess } from './handler.js';

// Mock fetch for testing
const mockFetch = vi.fn();

describe('createTrpcBridge()', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('initialization', () => {
    it('should create a bridge with default options', () => {
      const bridge = createTrpcBridge();

      expect(bridge).toBeDefined();
      expect(typeof bridge.createAction).toBe('function');
      expect(typeof bridge.createProtectedAction).toBe('function');
      expect(typeof bridge.call).toBe('function');
      expect(typeof bridge.handler).toBe('function');
    });

    it('should accept custom options', () => {
      const bridge = createTrpcBridge({
        trpcBase: '/api/trpc',
        forwardHeaders: ['x-custom-header'],
        fetch: mockFetch,
      });

      expect(bridge).toBeDefined();
    });
  });

  describe('createAction()', () => {
    it('should create a callable action', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { data: { json: { id: '123' } } } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const bridge = createTrpcBridge({ fetch: mockFetch });
      const action = bridge.createAction('users.getUser');

      const result = await action({ id: '123' });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toEqual({ id: '123' });
      }
    });

    it('should validate input when schema provided', async () => {
      const bridge = createTrpcBridge({ fetch: mockFetch });
      const action = bridge.createAction('users.getUser', {
        input: z.object({ id: z.string().uuid() }),
      });

      const result = await action({ id: 'not-a-uuid' });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }

      // Fetch should not have been called
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should transform input when transformer provided', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { data: { json: { success: true } } } }), {
          status: 200,
        })
      );

      const bridge = createTrpcBridge({ fetch: mockFetch });
      const action = bridge.createAction('users.update', {
        transformInput: (input: { userId: string }) => ({ id: input.userId }),
      });

      await action({ userId: '123' });

      // Check that the transformed input was sent
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.json).toEqual({ id: '123' });
    });

    it('should transform output when transformer provided', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { data: { json: { user_id: '123' } } } }), {
          status: 200,
        })
      );

      const bridge = createTrpcBridge({ fetch: mockFetch });
      const action = bridge.createAction<{ id: string }, { id: string }>('users.get', {
        transformOutput: (output: unknown) => {
          const data = output as { user_id: string };
          return { id: data.user_id };
        },
      });

      const result = await action({ id: '123' });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toEqual({ id: '123' });
      }
    });

    it('should require authentication when specified', async () => {
      const bridge = createTrpcBridge({ fetch: mockFetch });
      const action = bridge.createAction('users.getProfile', {
        requireAuth: true,
      });

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });
  });

  describe('createProtectedAction()', () => {
    it('should always require authentication', async () => {
      const bridge = createTrpcBridge({ fetch: mockFetch });
      const action = bridge.createProtectedAction('users.getProfile');

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });
  });

  describe('call()', () => {
    it('should make GET request for query procedures', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { data: { json: { id: '123' } } } }), {
          status: 200,
        })
      );

      const bridge = createTrpcBridge({ fetch: mockFetch });
      const ctx = {
        request: new Request('http://localhost/'),
        headers: new Headers(),
        cookies: new Map(),
      };

      await bridge.call('users.getUser', { id: '123' }, ctx);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/trpc/users.getUser'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should make POST request for mutation procedures', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { data: { json: { success: true } } } }), {
          status: 200,
        })
      );

      const bridge = createTrpcBridge({ fetch: mockFetch });
      const ctx = {
        request: new Request('http://localhost/'),
        headers: new Headers(),
        cookies: new Map(),
      };

      await bridge.call('users.createUser', { name: 'Test' }, ctx);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/trpc/users.createUser'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should recognize mutation prefixes', async () => {
      const bridge = createTrpcBridge({ fetch: mockFetch });
      const ctx = {
        request: new Request('http://localhost/'),
        headers: new Headers(),
        cookies: new Map(),
      };

      // Reset mock response for each call
      const setupMock = () => {
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ result: { data: { json: {} } } }), { status: 200 })
        );
      };

      const mutationPrefixes = ['create', 'update', 'delete', 'add', 'remove', 'set', 'toggle'];

      for (const prefix of mutationPrefixes) {
        setupMock();
        await bridge.call(`entity.${prefix}Item`, {}, ctx);
      }

      // All calls should have been POST
      for (const call of mockFetch.mock.calls) {
        expect(call[1].method).toBe('POST');
      }
    });

    it('should forward specified headers', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { data: { json: {} } } }), { status: 200 })
      );

      const bridge = createTrpcBridge({
        fetch: mockFetch,
        forwardHeaders: ['authorization', 'x-request-id'],
      });

      const ctx = {
        request: new Request('http://localhost/'),
        headers: new Headers({
          authorization: 'Bearer token123',
          'x-request-id': 'req-456',
          'x-other-header': 'ignored',
        }),
        cookies: new Map(),
      };

      await bridge.call('users.get', {}, ctx);

      const callHeaders = mockFetch.mock.calls[0][1].headers as Headers;
      expect(callHeaders.get('authorization')).toBe('Bearer token123');
      expect(callHeaders.get('x-request-id')).toBe('req-456');
    });

    it('should handle HTTP 401 error', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

      const bridge = createTrpcBridge({ fetch: mockFetch });
      const ctx = {
        request: new Request('http://localhost/'),
        headers: new Headers(),
        cookies: new Map(),
      };

      const result = await bridge.call('users.get', {}, ctx);

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should handle HTTP 403 error', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));

      const bridge = createTrpcBridge({ fetch: mockFetch });
      const ctx = {
        request: new Request('http://localhost/'),
        headers: new Headers(),
        cookies: new Map(),
      };

      const result = await bridge.call('users.get', {}, ctx);

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('should handle HTTP 404 error', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

      const bridge = createTrpcBridge({ fetch: mockFetch });
      const ctx = {
        request: new Request('http://localhost/'),
        headers: new Headers(),
        cookies: new Map(),
      };

      const result = await bridge.call('users.get', {}, ctx);

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should handle HTTP 429 error', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }));

      const bridge = createTrpcBridge({ fetch: mockFetch });
      const ctx = {
        request: new Request('http://localhost/'),
        headers: new Headers(),
        cookies: new Map(),
      };

      const result = await bridge.call('users.get', {}, ctx);

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('RATE_LIMITED');
      }
    });

    it('should handle tRPC error response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Procedure failed' } }), { status: 200 })
      );

      const bridge = createTrpcBridge({ fetch: mockFetch });
      const ctx = {
        request: new Request('http://localhost/'),
        headers: new Headers(),
        cookies: new Map(),
      };

      const result = await bridge.call('users.get', {}, ctx);

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('BAD_REQUEST');
        expect(result.error.message).toBe('Procedure failed');
      }
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const bridge = createTrpcBridge({ fetch: mockFetch });
      const ctx = {
        request: new Request('http://localhost/'),
        headers: new Headers(),
        cookies: new Map(),
      };

      const result = await bridge.call('users.get', {}, ctx);

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
        expect(result.error.message).toBe('Network error');
      }
    });
  });

  describe('handler()', () => {
    it('should provide call function to handler', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { data: { json: { name: 'User' } } } }), {
          status: 200,
        })
      );

      const bridge = createTrpcBridge({ fetch: mockFetch });
      const action = bridge.handler(async (input: { id: string }, _ctx, call) => {
        const userResult = await call<{ name: string }>('users.get', { id: input.id });
        if (isSuccess(userResult)) {
          return { greeting: `Hello, ${userResult.data.name}!` };
        }
        throw new Error('Failed to get user');
      });

      const result = await action({ id: '123' });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.greeting).toBe('Hello, User!');
      }
    });

    it('should support input validation', async () => {
      const bridge = createTrpcBridge({ fetch: mockFetch });
      const action = bridge.handler(async () => ({ success: true }), {
        input: z.object({ id: z.string().uuid() }),
      });

      const result = await action({ id: 'not-uuid' });

      expect(isError(result)).toBe(true);
    });
  });
});

describe('TrpcBridgeError', () => {
  it('should create error with code and message', () => {
    const err = new TrpcBridgeError('NOT_FOUND', 'User not found');

    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('User not found');
    expect(err.name).toBe('TrpcBridgeError');
  });

  it('should be instance of Error', () => {
    const err = new TrpcBridgeError('INTERNAL_ERROR', 'Test');

    expect(err instanceof Error).toBe(true);
    expect(err instanceof TrpcBridgeError).toBe(true);
  });
});

describe('wrapProcedure()', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should wrap a procedure as a server action', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { data: { json: { id: '123', name: 'Test' } } } }), {
        status: 200,
      })
    );

    const action = wrapProcedure('users.get', { fetch: mockFetch });
    const result = await action({ id: '123' });

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data).toEqual({ id: '123', name: 'Test' });
    }
  });

  it('should support input validation', async () => {
    const action = wrapProcedure('users.get', {
      input: z.object({ id: z.string().uuid() }),
      fetch: mockFetch,
    });

    const result = await action({ id: 'invalid' });

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('createActions()', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should create multiple actions from procedure map', () => {
    const actions = createActions(
      {
        getUser: 'users.get',
        updateUser: 'users.update',
        deleteUser: 'users.delete',
      },
      { fetch: mockFetch }
    );

    expect(typeof actions.getUser).toBe('function');
    expect(typeof actions.updateUser).toBe('function');
    expect(typeof actions.deleteUser).toBe('function');
  });

  it('should call correct procedures', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ result: { data: { json: {} } } }), { status: 200 })
    );

    const actions = createActions(
      {
        getUser: 'users.get',
        listUsers: 'users.list',
      },
      { fetch: mockFetch }
    );

    await actions.getUser({ id: '123' });

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('users.get'), expect.anything());
  });
});
