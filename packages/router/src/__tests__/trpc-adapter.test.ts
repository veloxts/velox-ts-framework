/**
 * @veloxts/router - tRPC Adapter Tests
 * Tests tRPC router creation from procedures and context handling
 */

import { TRPCError } from '@trpc/server';
import type { BaseContext } from '@veloxts/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineProcedures, procedure } from '../procedure/builder.js';
import {
  appRouter,
  buildTRPCRouter,
  createTRPCContextFactory,
  trpc,
  veloxErrorToTRPCError,
} from '../trpc/adapter.js';

describe('trpc', () => {
  it('should create tRPC instance', () => {
    const t = trpc();

    expect(t).toBeDefined();
    expect(typeof t.router).toBe('function');
    expect(typeof t.procedure).toBe('object');
  });

  it('should create tRPC instance with custom context type', () => {
    interface CustomContext extends BaseContext {
      userId: string;
    }

    const t = trpc<CustomContext>();

    expect(t).toBeDefined();
  });
});

describe('buildTRPCRouter', () => {
  it('should build router from procedure collection', () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => ({ id: input.id, name: 'John' })),
      listUsers: procedure().query(async () => []),
    });

    const router = buildTRPCRouter(t, collection);

    expect(router).toBeDefined();
    expect(typeof router).toBe('object');
  });

  it('should build router with queries', () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => ({ id: input.id })),
    });

    const router = buildTRPCRouter(t, collection);

    expect(router).toBeDefined();
  });

  it('should build router with mutations', () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      createUser: procedure()
        .input(z.object({ name: z.string() }))
        .mutation(async ({ input }) => ({ id: 'new', name: input.name })),
    });

    const router = buildTRPCRouter(t, collection);

    expect(router).toBeDefined();
  });

  it('should build router with both queries and mutations', () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      getUser: procedure().query(async () => ({ id: '1' })),
      createUser: procedure().mutation(async () => ({ id: 'new' })),
    });

    const router = buildTRPCRouter(t, collection);

    expect(router).toBeDefined();
  });

  it('should handle procedures with input and output schemas', () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(z.object({ id: z.string() }))
        .output(z.object({ id: z.string(), name: z.string() }))
        .query(async ({ input }) => ({ id: input.id, name: 'John' })),
    });

    const router = buildTRPCRouter(t, collection);

    expect(router).toBeDefined();
  });

  it('should handle procedures with only input schema', () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => ({ id: input.id })),
    });

    const router = buildTRPCRouter(t, collection);

    expect(router).toBeDefined();
  });

  it('should handle procedures with only output schema', () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      getStats: procedure()
        .output(z.object({ count: z.number() }))
        .query(async () => ({ count: 42 })),
    });

    const router = buildTRPCRouter(t, collection);

    expect(router).toBeDefined();
  });

  it('should handle procedures without schemas', () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      ping: procedure().query(async () => 'pong'),
    });

    const router = buildTRPCRouter(t, collection);

    expect(router).toBeDefined();
  });

  it('should handle empty procedure collection', () => {
    const t = trpc();

    const collection = defineProcedures('empty', {});

    const router = buildTRPCRouter(t, collection);

    expect(router).toBeDefined();
  });
});

describe('appRouter', () => {
  it('should create namespaced app router', () => {
    const t = trpc();

    const users = defineProcedures('users', {
      getUser: procedure().query(async () => ({ id: '1' })),
    });

    const posts = defineProcedures('posts', {
      getPost: procedure().query(async () => ({ id: '1' })),
    });

    const router = appRouter(t, [users, posts]);

    expect(router).toBeDefined();
  });

  it('should handle single collection', () => {
    const t = trpc();

    const users = defineProcedures('users', {
      getUser: procedure().query(async () => ({ id: '1' })),
    });

    const router = appRouter(t, [users]);

    expect(router).toBeDefined();
  });

  it('should handle empty collections array', () => {
    const t = trpc();

    const router = appRouter(t, []);

    expect(router).toBeDefined();
  });

  it('should create router with multiple namespaces', () => {
    const t = trpc();

    const users = defineProcedures('users', {
      getUser: procedure().query(async () => ({ id: '1' })),
      createUser: procedure().mutation(async () => ({ id: 'new' })),
    });

    const posts = defineProcedures('posts', {
      getPost: procedure().query(async () => ({ id: '1' })),
      createPost: procedure().mutation(async () => ({ id: 'new' })),
    });

    const comments = defineProcedures('comments', {
      getComment: procedure().query(async () => ({ id: '1' })),
    });

    const router = appRouter(t, [users, posts, comments]);

    expect(router).toBeDefined();
  });
});

describe('Procedure execution through tRPC', () => {
  it('should execute query procedure', async () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => ({ id: input.id, name: 'John' })),
    });

    const router = buildTRPCRouter(t, collection);
    const caller = router.createCaller({} as BaseContext);

    const result = await caller.getUser({ id: '123' });

    expect(result).toEqual({ id: '123', name: 'John' });
  });

  it('should execute mutation procedure', async () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      createUser: procedure()
        .input(z.object({ name: z.string() }))
        .mutation(async ({ input }) => ({ id: 'new', name: input.name })),
    });

    const router = buildTRPCRouter(t, collection);
    const caller = router.createCaller({} as BaseContext);

    const result = await caller.createUser({ name: 'John' });

    expect(result).toEqual({ id: 'new', name: 'John' });
  });

  it('should validate input', async () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(z.object({ email: z.string().email() }))
        .query(async ({ input }) => ({ email: input.email })),
    });

    const router = buildTRPCRouter(t, collection);
    const caller = router.createCaller({} as BaseContext);

    await expect(caller.getUser({ email: 'invalid' })).rejects.toThrow();
  });

  it('should validate output', async () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      getUser: procedure()
        .output(z.object({ id: z.string() }))
        .query(async () => {
          // Return invalid output
          return { id: 123 } as unknown as { id: string };
        }),
    });

    const router = buildTRPCRouter(t, collection);
    const caller = router.createCaller({} as BaseContext);

    await expect(caller.getUser()).rejects.toThrow();
  });

  it('should execute middleware', async () => {
    const t = trpc();

    let middlewareExecuted = false;

    const collection = defineProcedures('users', {
      getUser: procedure()
        .use(async ({ next }) => {
          middlewareExecuted = true;
          return next();
        })
        .query(async () => ({ id: '1' })),
    });

    const router = buildTRPCRouter(t, collection);
    const caller = router.createCaller({} as BaseContext);

    await caller.getUser();

    expect(middlewareExecuted).toBe(true);
  });

  it('should extend context through middleware', async () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      getUser: procedure()
        .use(async ({ next, ctx }) => {
          return next({ ctx: { ...ctx, userId: '123' } });
        })
        .query(async ({ ctx }) => {
          const extendedCtx = ctx as BaseContext & { userId: string };
          return { userId: extendedCtx.userId };
        }),
    });

    const router = buildTRPCRouter(t, collection);
    const caller = router.createCaller({} as BaseContext);

    const result = await caller.getUser();

    expect(result).toEqual({ userId: '123' });
  });

  it('should handle async operations', async () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      getUser: procedure().query(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { id: '1', delayed: true };
      }),
    });

    const router = buildTRPCRouter(t, collection);
    const caller = router.createCaller({} as BaseContext);

    const result = await caller.getUser();

    expect(result).toEqual({ id: '1', delayed: true });
  });

  it('should propagate errors', async () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      getUser: procedure().query(async () => {
        throw new Error('User not found');
      }),
    });

    const router = buildTRPCRouter(t, collection);
    const caller = router.createCaller({} as BaseContext);

    await expect(caller.getUser()).rejects.toThrow('User not found');
  });
});

describe('Context handling', () => {
  it('should access context in handler', async () => {
    interface CustomContext extends BaseContext {
      userId: string;
    }

    const t = trpc<CustomContext>();

    const collection = defineProcedures('users', {
      getMe: procedure().query(async ({ ctx }) => {
        return { userId: ctx.userId };
      }),
    });

    const router = buildTRPCRouter(t, collection);
    const caller = router.createCaller({ userId: '123' } as CustomContext);

    const result = await caller.getMe();

    expect(result).toEqual({ userId: '123' });
  });

  it('should pass input and context to handler', async () => {
    interface CustomContext extends BaseContext {
      requestId: string;
    }

    const t = trpc<CustomContext>();

    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => ({
          userId: input.id,
          requestId: ctx.requestId,
        })),
    });

    const router = buildTRPCRouter(t, collection);
    const caller = router.createCaller({ requestId: 'req-123' } as CustomContext);

    const result = await caller.getUser({ id: 'user-456' });

    expect(result).toEqual({
      userId: 'user-456',
      requestId: 'req-123',
    });
  });
});

describe('createTRPCContextFactory', () => {
  it('should create context factory', () => {
    const factory = createTRPCContextFactory();

    expect(typeof factory).toBe('function');
  });

  it('should extract context from request', () => {
    const factory = createTRPCContextFactory<BaseContext>();

    const ctx = {} as BaseContext;
    const result = factory({ req: { context: ctx } });

    expect(result).toBe(ctx);
  });

  it('should throw if context is missing', () => {
    const factory = createTRPCContextFactory();

    expect(() => factory({ req: {} })).toThrow(TRPCError);
    expect(() => factory({ req: {} })).toThrow('Request context not found');
  });

  it('should preserve extended context', () => {
    interface CustomContext extends BaseContext {
      userId: string;
    }

    const factory = createTRPCContextFactory<CustomContext>();

    const ctx: CustomContext = { userId: '123' } as CustomContext;
    const result = factory({ req: { context: ctx } });

    expect(result.userId).toBe('123');
  });
});

describe('veloxErrorToTRPCError', () => {
  it('should convert error with status code', () => {
    const error = new Error('Not found');
    (error as Error & { statusCode: number }).statusCode = 404;

    const trpcError = veloxErrorToTRPCError(error as Error & { statusCode: number });

    expect(trpcError).toBeInstanceOf(TRPCError);
    expect(trpcError.code).toBe('NOT_FOUND');
    expect(trpcError.message).toBe('Not found');
  });

  it('should map common HTTP status codes', () => {
    const testCases = [
      { status: 400, expected: 'BAD_REQUEST' },
      { status: 401, expected: 'UNAUTHORIZED' },
      { status: 403, expected: 'FORBIDDEN' },
      { status: 404, expected: 'NOT_FOUND' },
      { status: 408, expected: 'TIMEOUT' },
      { status: 409, expected: 'CONFLICT' },
      { status: 422, expected: 'UNPROCESSABLE_CONTENT' },
      { status: 429, expected: 'TOO_MANY_REQUESTS' },
      { status: 500, expected: 'INTERNAL_SERVER_ERROR' },
    ];

    for (const { status, expected } of testCases) {
      const error = new Error('Test error');
      (error as Error & { statusCode: number }).statusCode = status;

      const trpcError = veloxErrorToTRPCError(error as Error & { statusCode: number });

      expect(trpcError.code).toBe(expected);
    }
  });

  it('should use default code for unknown status', () => {
    const error = new Error('Unknown error');
    (error as Error & { statusCode: number }).statusCode = 418; // I'm a teapot

    const trpcError = veloxErrorToTRPCError(error as Error & { statusCode: number });

    expect(trpcError.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should use custom default code', () => {
    const error = new Error('Test error');

    const trpcError = veloxErrorToTRPCError(
      error as Error & { statusCode?: number },
      'BAD_REQUEST'
    );

    expect(trpcError.code).toBe('BAD_REQUEST');
  });

  it('should include error code in cause', () => {
    const error = new Error('Validation failed');
    (error as Error & { statusCode: number; code: string }).statusCode = 400;
    (error as Error & { statusCode: number; code: string }).code = 'VALIDATION_ERROR';

    const trpcError = veloxErrorToTRPCError(error as Error & { statusCode: number; code: string });

    // TRPCError wraps the cause - the code becomes the Error message
    expect((trpcError.cause as Error).message).toBe('VALIDATION_ERROR');
  });
});

describe('Complex scenarios', () => {
  it('should handle nested routers', async () => {
    const t = trpc();

    const users = defineProcedures('users', {
      getUser: procedure().query(async () => ({ id: '1' })),
    });

    const posts = defineProcedures('posts', {
      getPost: procedure().query(async () => ({ id: '1' })),
    });

    const router = appRouter(t, [users, posts]);
    const caller = router.createCaller({} as BaseContext);

    const userResult = await caller.users.getUser();
    const postResult = await caller.posts.getPost();

    expect(userResult).toEqual({ id: '1' });
    expect(postResult).toEqual({ id: '1' });
  });

  it('should handle complex input schemas', async () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      createUser: procedure()
        .input(
          z.object({
            user: z.object({
              name: z.string(),
              email: z.string().email(),
              profile: z.object({
                age: z.number(),
                bio: z.string().optional(),
              }),
            }),
          })
        )
        .mutation(async ({ input }) => ({
          id: 'new',
          name: input.user.name,
          email: input.user.email,
        })),
    });

    const router = buildTRPCRouter(t, collection);
    const caller = router.createCaller({} as BaseContext);

    const result = await caller.createUser({
      user: {
        name: 'John',
        email: 'john@example.com',
        profile: {
          age: 30,
        },
      },
    });

    expect(result).toEqual({
      id: 'new',
      name: 'John',
      email: 'john@example.com',
    });
  });

  it('should handle transformation in schemas', async () => {
    const t = trpc();

    const collection = defineProcedures('users', {
      searchUsers: procedure()
        .input(
          z.object({
            query: z.string().transform((s) => s.toLowerCase()),
          })
        )
        .query(async ({ input }) => ({
          query: input.query,
          results: [],
        })),
    });

    const router = buildTRPCRouter(t, collection);
    const caller = router.createCaller({} as BaseContext);

    const result = await caller.searchUsers({ query: 'HELLO' });

    expect(result.query).toBe('hello');
  });

  it('should handle multiple middlewares', async () => {
    const t = trpc();

    const executionOrder: string[] = [];

    const collection = defineProcedures('users', {
      getUser: procedure()
        .use(async ({ next }) => {
          executionOrder.push('middleware-1');
          return next();
        })
        .use(async ({ next }) => {
          executionOrder.push('middleware-2');
          return next();
        })
        .query(async () => {
          executionOrder.push('handler');
          return { id: '1' };
        }),
    });

    const router = buildTRPCRouter(t, collection);
    const caller = router.createCaller({} as BaseContext);

    await caller.getUser();

    expect(executionOrder).toEqual(['middleware-1', 'middleware-2', 'handler']);
  });
});
