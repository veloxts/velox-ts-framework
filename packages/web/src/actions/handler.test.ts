/**
 * Tests for Server Action Handler
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  createAction,
  createActionContext,
  createActionRegistry,
  createAuthenticatedContext,
  createFormAction,
  error,
  generateActionId,
  getActionRegistry,
  isAuthenticatedContext,
  isError,
  isSuccess,
  parseCookies,
  registerAction,
  resetActionRegistry,
  success,
} from './handler.js';
import type { ActionResult } from './types.js';

describe('success and error helpers', () => {
  describe('success()', () => {
    it('should create a success result with data', () => {
      const result = success({ id: '123', name: 'Test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '123', name: 'Test' });
    });

    it('should work with primitive values', () => {
      expect(success('hello').data).toBe('hello');
      expect(success(42).data).toBe(42);
      expect(success(true).data).toBe(true);
      expect(success(null).data).toBe(null);
    });

    it('should work with arrays', () => {
      const result = success([1, 2, 3]);
      expect(result.data).toEqual([1, 2, 3]);
    });
  });

  describe('error()', () => {
    it('should create an error result with code and message', () => {
      const result = error('VALIDATION_ERROR', 'Invalid input');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Invalid input');
    });

    it('should include details when provided', () => {
      const result = error('VALIDATION_ERROR', 'Invalid input', {
        field: 'email',
        reason: 'invalid format',
      });

      expect(result.error.details).toEqual({
        field: 'email',
        reason: 'invalid format',
      });
    });

    it('should work with all error codes', () => {
      const codes = [
        'VALIDATION_ERROR',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'CONFLICT',
        'INTERNAL_ERROR',
        'BAD_REQUEST',
        'RATE_LIMITED',
      ] as const;

      for (const code of codes) {
        const result = error(code, 'Test message');
        expect(result.error.code).toBe(code);
      }
    });
  });
});

describe('type guards', () => {
  describe('isSuccess()', () => {
    it('should return true for success results', () => {
      const result = success({ data: 'test' });
      expect(isSuccess(result)).toBe(true);
    });

    it('should return false for error results', () => {
      const result = error('INTERNAL_ERROR', 'Test error');
      expect(isSuccess(result)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const result: ActionResult<string> = success('test');

      if (isSuccess(result)) {
        // Type should be narrowed to ActionSuccess<string>
        expect(result.data).toBe('test');
      }
    });
  });

  describe('isError()', () => {
    it('should return true for error results', () => {
      const result = error('INTERNAL_ERROR', 'Test error');
      expect(isError(result)).toBe(true);
    });

    it('should return false for success results', () => {
      const result = success({ data: 'test' });
      expect(isError(result)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const result: ActionResult<string> = error('NOT_FOUND', 'Not found');

      if (isError(result)) {
        // Type should be narrowed to ActionError
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });
});

describe('parseCookies()', () => {
  it('should parse single cookie', () => {
    const request = new Request('http://localhost/', {
      headers: { cookie: 'session=abc123' },
    });

    const cookies = parseCookies(request);

    expect(cookies.get('session')).toBe('abc123');
  });

  it('should parse multiple cookies', () => {
    const request = new Request('http://localhost/', {
      headers: { cookie: 'session=abc123; theme=dark; lang=en' },
    });

    const cookies = parseCookies(request);

    expect(cookies.get('session')).toBe('abc123');
    expect(cookies.get('theme')).toBe('dark');
    expect(cookies.get('lang')).toBe('en');
  });

  it('should handle cookies with = in value', () => {
    const request = new Request('http://localhost/', {
      headers: { cookie: 'token=abc=123=def' },
    });

    const cookies = parseCookies(request);

    expect(cookies.get('token')).toBe('abc=123=def');
  });

  it('should handle URL-encoded values', () => {
    const request = new Request('http://localhost/', {
      headers: { cookie: 'name=John%20Doe' },
    });

    const cookies = parseCookies(request);

    expect(cookies.get('name')).toBe('John Doe');
  });

  it('should return empty map when no cookies', () => {
    const request = new Request('http://localhost/');
    const cookies = parseCookies(request);

    expect(cookies.size).toBe(0);
  });

  it('should handle whitespace around cookies', () => {
    const request = new Request('http://localhost/', {
      headers: { cookie: '  session=abc123  ;  theme=dark  ' },
    });

    const cookies = parseCookies(request);

    expect(cookies.get('session')).toBe('abc123');
    expect(cookies.get('theme')).toBe('dark');
  });
});

describe('createActionContext()', () => {
  it('should create context from request', () => {
    const request = new Request('http://localhost/api/test', {
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token123',
        cookie: 'session=abc',
      },
    });

    const ctx = createActionContext(request);

    expect(ctx.request).toBe(request);
    expect(ctx.headers.get('authorization')).toBe('Bearer token123');
    expect(ctx.cookies.get('session')).toBe('abc');
  });

  it('should handle request without cookies', () => {
    const request = new Request('http://localhost/');
    const ctx = createActionContext(request);

    expect(ctx.cookies.size).toBe(0);
  });
});

describe('isAuthenticatedContext()', () => {
  it('should return true when user is present', () => {
    const ctx = createAuthenticatedContext({ id: 'user123', name: 'Test' });
    expect(isAuthenticatedContext(ctx)).toBe(true);
  });

  it('should return false for basic context', () => {
    const request = new Request('http://localhost/');
    const ctx = createActionContext(request);
    expect(isAuthenticatedContext(ctx)).toBe(false);
  });
});

describe('createAuthenticatedContext()', () => {
  it('should create context with user', () => {
    const user = { id: 'user123', name: 'Test User', role: 'admin' };
    const ctx = createAuthenticatedContext(user);

    expect(ctx.user).toEqual(user);
    expect(isAuthenticatedContext(ctx)).toBe(true);
  });

  it('should merge with base context', () => {
    const headers = new Headers({ authorization: 'Bearer token' });
    const cookies = new Map([['session', 'abc']]);

    const ctx = createAuthenticatedContext({ id: 'user123' }, { headers, cookies });

    expect(ctx.headers.get('authorization')).toBe('Bearer token');
    expect(ctx.cookies.get('session')).toBe('abc');
    expect(ctx.user.id).toBe('user123');
  });
});

describe('createAction()', () => {
  describe('basic functionality', () => {
    it('should create a callable action', async () => {
      const action = createAction({}, async (input: { name: string }) => {
        return { greeting: `Hello, ${input.name}!` };
      });

      const result = await action({ name: 'World' });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.greeting).toBe('Hello, World!');
      }
    });

    it('should handle async handlers', async () => {
      const action = createAction({}, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { delayed: true };
      });

      const result = await action({});

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.delayed).toBe(true);
      }
    });

    it('should pass input to handler', async () => {
      const handler = vi.fn().mockResolvedValue({ received: true });
      const action = createAction({}, handler);

      await action({ test: 'data' });

      expect(handler).toHaveBeenCalledWith(
        { test: 'data' },
        expect.objectContaining({ request: expect.any(Request) })
      );
    });
  });

  describe('input validation', () => {
    it('should validate input with Zod schema', async () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      const action = createAction({ input: schema }, async (input) => ({ email: input.email }));

      const result = await action({ email: 'test@example.com', age: 25 });

      expect(isSuccess(result)).toBe(true);
    });

    it('should return validation error for invalid input', async () => {
      const schema = z.object({
        email: z.string().email(),
      });

      const action = createAction({ input: schema }, async (input) => input);

      const result = await action({ email: 'not-an-email' });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.details).toBeDefined();
      }
    });

    it('should not call handler when validation fails', async () => {
      const handler = vi.fn().mockResolvedValue({});
      const schema = z.object({ id: z.string().uuid() });

      const action = createAction({ input: schema }, handler);

      await action({ id: 'not-a-uuid' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('output validation', () => {
    it('should validate output with Zod schema', async () => {
      const outputSchema = z.object({
        id: z.string(),
        createdAt: z.string(),
      });

      const action = createAction({ output: outputSchema }, async () => ({
        id: '123',
        createdAt: '2024-01-01',
      }));

      const result = await action({});

      expect(isSuccess(result)).toBe(true);
    });

    it('should return internal error for invalid output', async () => {
      const outputSchema = z.object({
        id: z.string(),
        createdAt: z.string(),
      });

      const action = createAction(
        { output: outputSchema },
        async () => ({ id: 123 }) as unknown // Intentionally wrong type
      );

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });
  });

  describe('authentication', () => {
    it('should return unauthorized when requireAuth is true and no user', async () => {
      const action = createAction({ requireAuth: true }, async () => ({ secret: 'data' }));

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });
  });

  describe('error handling', () => {
    it('should catch and wrap handler errors', async () => {
      const action = createAction({}, async () => {
        throw new Error('Something went wrong');
      });

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
        expect(result.error.message).toBe('Something went wrong');
      }
    });

    it('should detect unauthorized errors from message', async () => {
      const action = createAction({}, async () => {
        throw new Error('unauthorized access');
      });

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should detect forbidden errors from message', async () => {
      const action = createAction({}, async () => {
        throw new Error('Forbidden resource');
      });

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('should detect not found errors from message', async () => {
      const action = createAction({}, async () => {
        throw new Error('User not found');
      });

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should use custom error handler when provided', async () => {
      const customHandler = vi.fn().mockReturnValue(error('CONFLICT', 'Custom error'));

      const action = createAction({ onError: customHandler }, async () => {
        throw new Error('Original error');
      });

      const result = await action({});

      expect(customHandler).toHaveBeenCalled();
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('CONFLICT');
        expect(result.error.message).toBe('Custom error');
      }
    });

    it('should handle non-Error throws', async () => {
      const action = createAction({}, async () => {
        throw 'string error';
      });

      const result = await action({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });
  });
});

describe('createFormAction()', () => {
  it('should create a callable form action', async () => {
    const action = createFormAction(async (formData) => {
      const name = formData.get('name') as string;
      return { greeting: `Hello, ${name}!` };
    });

    const formData = new FormData();
    formData.append('name', 'World');

    const result = await action(formData);

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data.greeting).toBe('Hello, World!');
    }
  });

  it('should pass formData to handler', async () => {
    const handler = vi.fn().mockResolvedValue({ received: true });
    const action = createFormAction(handler);

    const formData = new FormData();
    formData.append('field', 'value');

    await action(formData);

    expect(handler).toHaveBeenCalledWith(
      formData,
      expect.objectContaining({ request: expect.any(Request) })
    );
  });

  it('should validate output when schema provided', async () => {
    const outputSchema = z.object({
      success: z.boolean(),
      message: z.string(),
    });

    const action = createFormAction(async () => ({ success: true, message: 'Done' }), {
      output: outputSchema,
    });

    const result = await action(new FormData());

    expect(isSuccess(result)).toBe(true);
  });

  it('should require authentication when specified', async () => {
    const action = createFormAction(async () => ({ secret: 'data' }), { requireAuth: true });

    const result = await action(new FormData());

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('should handle errors', async () => {
    const action = createFormAction(async () => {
      throw new Error('Form processing failed');
    });

    const result = await action(new FormData());

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error.message).toBe('Form processing failed');
    }
  });
});

describe('generateActionId()', () => {
  beforeEach(() => {
    resetActionRegistry();
  });

  it('should generate unique IDs', () => {
    const id1 = generateActionId('test');
    const id2 = generateActionId('test');

    expect(id1).not.toBe(id2);
  });

  it('should include name in ID', () => {
    const id = generateActionId('myAction');
    expect(id).toContain('myAction');
  });

  it('should sanitize special characters', () => {
    const id = generateActionId('my-action.test');
    expect(id).not.toContain('-');
    expect(id).not.toContain('.');
  });

  it('should use default name when not provided', () => {
    const id = generateActionId();
    expect(id).toContain('action');
  });
});

describe('Action Registry', () => {
  describe('createActionRegistry()', () => {
    it('should create an empty registry', () => {
      const registry = createActionRegistry();

      expect(registry.keys()).toEqual([]);
      expect(registry.values()).toEqual([]);
    });

    it('should register actions', () => {
      const registry = createActionRegistry();
      const action = createAction({}, async () => ({}));

      registry.register('test', {
        metadata: { id: 'test', name: 'Test', requiresAuth: false },
        action,
        handler: async () => ({}),
      });

      expect(registry.has('test')).toBe(true);
    });

    it('should throw when registering duplicate ID', () => {
      const registry = createActionRegistry();
      const action = createAction({}, async () => ({}));

      registry.register('test', {
        metadata: { id: 'test', name: 'Test', requiresAuth: false },
        action,
        handler: async () => ({}),
      });

      expect(() =>
        registry.register('test', {
          metadata: { id: 'test', name: 'Test 2', requiresAuth: false },
          action,
          handler: async () => ({}),
        })
      ).toThrow('already registered');
    });

    it('should get registered action', () => {
      const registry = createActionRegistry();
      const action = createAction({}, async () => ({ result: 'test' }));

      registry.register('myAction', {
        metadata: { id: 'myAction', name: 'My Action', requiresAuth: false },
        action,
        handler: async () => ({ result: 'test' }),
      });

      const registered = registry.get('myAction');

      expect(registered).toBeDefined();
      expect(registered?.metadata.name).toBe('My Action');
    });

    it('should return undefined for unknown action', () => {
      const registry = createActionRegistry();
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('should list all keys', () => {
      const registry = createActionRegistry();
      const action = createAction({}, async () => ({}));

      registry.register('action1', {
        metadata: { id: 'action1', name: 'Action 1', requiresAuth: false },
        action,
        handler: async () => ({}),
      });
      registry.register('action2', {
        metadata: { id: 'action2', name: 'Action 2', requiresAuth: false },
        action,
        handler: async () => ({}),
      });

      expect(registry.keys()).toContain('action1');
      expect(registry.keys()).toContain('action2');
    });

    it('should list all values', () => {
      const registry = createActionRegistry();
      const action = createAction({}, async () => ({}));

      registry.register('action1', {
        metadata: { id: 'action1', name: 'Action 1', requiresAuth: false },
        action,
        handler: async () => ({}),
      });

      const values = registry.values();
      expect(values).toHaveLength(1);
      expect(values[0].metadata.name).toBe('Action 1');
    });
  });

  describe('registerAction()', () => {
    beforeEach(() => {
      resetActionRegistry();
    });

    it('should register and return action with metadata', () => {
      const registry = createActionRegistry();

      const registered = registerAction(
        registry,
        'updateUser',
        { requireAuth: true },
        async (input: { id: string }) => ({ id: input.id })
      );

      expect(registered.metadata.name).toBe('updateUser');
      expect(registered.metadata.requiresAuth).toBe(true);
      expect(typeof registered.action).toBe('function');
      expect(typeof registered.handler).toBe('function');
    });

    it('should include schemas in metadata', () => {
      const registry = createActionRegistry();
      const inputSchema = z.object({ id: z.string() });
      const outputSchema = z.object({ success: z.boolean() });

      const registered = registerAction(
        registry,
        'test',
        { input: inputSchema, output: outputSchema },
        async () => ({ success: true })
      );

      expect(registered.metadata.inputSchema).toBe(inputSchema);
      expect(registered.metadata.outputSchema).toBe(outputSchema);
    });
  });

  describe('global registry', () => {
    beforeEach(() => {
      resetActionRegistry();
    });

    it('should return the same registry instance', () => {
      const registry1 = getActionRegistry();
      const registry2 = getActionRegistry();

      expect(registry1).toBe(registry2);
    });

    it('should reset registry state', () => {
      const registry = getActionRegistry();
      registry.register('test', {
        metadata: { id: 'test', name: 'Test', requiresAuth: false },
        action: createAction({}, async () => ({})),
        handler: async () => ({}),
      });

      resetActionRegistry();

      const newRegistry = getActionRegistry();
      expect(newRegistry.has('test')).toBe(false);
    });
  });
});
