/**
 * @veloxts/router - Procedure Builder Tests
 * Tests procedure builder fluent API, type inference, and execution
 */

import type { BaseContext } from '@veloxts/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  defineProcedures,
  executeProcedure,
  isCompiledProcedure,
  isProcedureCollection,
  procedure,
} from '../procedure/builder.js';

describe('Procedure Builder', () => {
  describe('procedure()', () => {
    it('should create a new procedure builder', () => {
      const builder = procedure();

      expect(builder).toBeDefined();
      expect(typeof builder.input).toBe('function');
      expect(typeof builder.output).toBe('function');
      expect(typeof builder.use).toBe('function');
      expect(typeof builder.rest).toBe('function');
      expect(typeof builder.query).toBe('function');
      expect(typeof builder.mutation).toBe('function');
    });
  });

  describe('input()', () => {
    it('should set input schema', () => {
      const InputSchema = z.object({ id: z.string() });

      const proc = procedure()
        .input(InputSchema)
        .query(async ({ input }) => {
          return { received: input.id };
        });

      expect(proc.inputSchema).toBeDefined();
      expect(proc.inputSchema?.parse({ id: '123' })).toEqual({ id: '123' });
    });

    it('should preserve type information', async () => {
      const proc = procedure()
        .input(z.object({ name: z.string() }))
        .query(async ({ input }) => {
          // TypeScript should infer input as { name: string }
          expect(typeof input).toBe('object');
          return { greeting: `Hello, ${input.name}` };
        });

      const ctx: BaseContext = {} as BaseContext;
      const result = await executeProcedure(proc, { name: 'John' }, ctx);

      expect(result).toEqual({ greeting: 'Hello, John' });
    });
  });

  describe('output()', () => {
    it('should set output schema', () => {
      const OutputSchema = z.object({ result: z.string() });

      const proc = procedure()
        .output(OutputSchema)
        .query(async () => {
          return { result: 'success' };
        });

      expect(proc.outputSchema).toBeDefined();
      expect(proc.outputSchema?.parse({ result: 'success' })).toEqual({ result: 'success' });
    });

    it('should validate handler output', async () => {
      const proc = procedure()
        .output(z.object({ count: z.number() }))
        .query(async () => {
          return { count: 42 };
        });

      const ctx: BaseContext = {} as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      expect(result).toEqual({ count: 42 });
    });
  });

  describe('use()', () => {
    it('should add middleware to the chain', () => {
      const proc = procedure()
        .use(async ({ next }) => next())
        .query(async () => ({ success: true }));

      expect(proc.middlewares).toHaveLength(1);
    });

    it('should accumulate multiple middlewares', () => {
      const proc = procedure()
        .use(async ({ next }) => next())
        .use(async ({ next }) => next())
        .use(async ({ next }) => next())
        .query(async () => ({ success: true }));

      expect(proc.middlewares).toHaveLength(3);
    });

    it('should execute middleware in order', async () => {
      const executionOrder: string[] = [];

      const proc = procedure()
        .use(async ({ next }) => {
          executionOrder.push('middleware-1-before');
          const result = await next();
          executionOrder.push('middleware-1-after');
          return result;
        })
        .use(async ({ next }) => {
          executionOrder.push('middleware-2-before');
          const result = await next();
          executionOrder.push('middleware-2-after');
          return result;
        })
        .query(async () => {
          executionOrder.push('handler');
          return { success: true };
        });

      const ctx: BaseContext = {} as BaseContext;
      await executeProcedure(proc, undefined, ctx);

      expect(executionOrder).toEqual([
        'middleware-1-before',
        'middleware-2-before',
        'handler',
        'middleware-2-after',
        'middleware-1-after',
      ]);
    });

    it('should extend context through middleware', async () => {
      const proc = procedure()
        .use(async ({ next, ctx }) => {
          return next({ ctx: { ...ctx, userId: '123' } });
        })
        .query(async ({ ctx }) => {
          // Context should be extended with userId
          const extendedCtx = ctx as BaseContext & { userId: string };
          return { userId: extendedCtx.userId };
        });

      const ctx: BaseContext = {} as BaseContext;
      const result = await executeProcedure(proc, undefined, ctx);

      expect(result).toEqual({ userId: '123' });
    });
  });

  describe('rest()', () => {
    it('should set REST override', () => {
      const proc = procedure()
        .rest({ method: 'POST', path: '/custom/path' })
        .query(async () => ({ success: true }));

      expect(proc.restOverride).toEqual({
        method: 'POST',
        path: '/custom/path',
      });
    });

    it('should allow partial override', () => {
      const proc = procedure()
        .rest({ method: 'POST' })
        .query(async () => ({ success: true }));

      expect(proc.restOverride?.method).toBe('POST');
      expect(proc.restOverride?.path).toBeUndefined();
    });
  });

  describe('query()', () => {
    it('should create a query procedure', () => {
      const proc = procedure().query(async () => ({ data: 'test' }));

      expect(proc.type).toBe('query');
      expect(typeof proc.handler).toBe('function');
    });

    it('should execute the handler', async () => {
      const proc = procedure().query(async ({ input }) => {
        return { received: input };
      });

      const ctx: BaseContext = {} as BaseContext;
      const result = await executeProcedure(proc, 'test-input', ctx);

      expect(result).toEqual({ received: 'test-input' });
    });
  });

  describe('mutation()', () => {
    it('should create a mutation procedure', () => {
      const proc = procedure().mutation(async () => ({ success: true }));

      expect(proc.type).toBe('mutation');
      expect(typeof proc.handler).toBe('function');
    });

    it('should execute the handler', async () => {
      const proc = procedure()
        .input(z.object({ name: z.string() }))
        .mutation(async ({ input }) => {
          return { created: input.name };
        });

      const ctx: BaseContext = {} as BaseContext;
      const result = await executeProcedure(proc, { name: 'John' }, ctx);

      expect(result).toEqual({ created: 'John' });
    });
  });

  describe('Fluent chain combinations', () => {
    it('should chain input + output + query', () => {
      const proc = procedure()
        .input(z.object({ id: z.string() }))
        .output(z.object({ result: z.string() }))
        .query(async ({ input }) => {
          return { result: `processed-${input.id}` };
        });

      expect(proc.type).toBe('query');
      expect(proc.inputSchema).toBeDefined();
      expect(proc.outputSchema).toBeDefined();
    });

    it('should chain input + middleware + mutation', () => {
      const proc = procedure()
        .input(z.object({ data: z.string() }))
        .use(async ({ next }) => next())
        .mutation(async ({ input }) => {
          return { saved: input.data };
        });

      expect(proc.type).toBe('mutation');
      expect(proc.inputSchema).toBeDefined();
      expect(proc.middlewares).toHaveLength(1);
    });

    it('should chain all methods', () => {
      const proc = procedure()
        .input(z.object({ id: z.string() }))
        .output(z.object({ success: z.boolean() }))
        .use(async ({ next }) => next())
        .rest({ method: 'POST', path: '/custom' })
        .mutation(async () => ({ success: true }));

      expect(proc.type).toBe('mutation');
      expect(proc.inputSchema).toBeDefined();
      expect(proc.outputSchema).toBeDefined();
      expect(proc.middlewares).toHaveLength(1);
      expect(proc.restOverride).toBeDefined();
    });
  });
});

describe('defineProcedures', () => {
  it('should create a procedure collection', () => {
    const collection = defineProcedures('users', {
      getUser: procedure()
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => ({ id: input.id, name: 'John' })),
      createUser: procedure()
        .input(z.object({ name: z.string() }))
        .mutation(async ({ input }) => ({ id: 'new', name: input.name })),
    });

    expect(collection.namespace).toBe('users');
    expect(collection.procedures).toHaveProperty('getUser');
    expect(collection.procedures).toHaveProperty('createUser');
  });

  it('should preserve procedure types', () => {
    const collection = defineProcedures('posts', {
      listPosts: procedure().query(async () => []),
      createPost: procedure().mutation(async () => ({ id: 'new' })),
    });

    expect(collection.procedures.listPosts.type).toBe('query');
    expect(collection.procedures.createPost.type).toBe('mutation');
  });

  it('should handle empty procedure collection', () => {
    const collection = defineProcedures('empty', {});

    expect(collection.namespace).toBe('empty');
    expect(Object.keys(collection.procedures)).toHaveLength(0);
  });
});

describe('executeProcedure', () => {
  it('should execute procedure without schemas', async () => {
    const proc = procedure().query(async ({ input }) => {
      return { received: input };
    });

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, 'test', ctx);

    expect(result).toEqual({ received: 'test' });
  });

  it('should validate input before execution', async () => {
    const proc = procedure()
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => ({ email: input.email }));

    const ctx: BaseContext = {} as BaseContext;

    await expect(executeProcedure(proc, { email: 'invalid' }, ctx)).rejects.toThrow();
  });

  it('should validate output after execution', async () => {
    const proc = procedure()
      .output(z.object({ count: z.number() }))
      .query(async () => {
        // Return wrong type
        return { count: 'not-a-number' } as unknown as { count: number };
      });

    const ctx: BaseContext = {} as BaseContext;

    await expect(executeProcedure(proc, undefined, ctx)).rejects.toThrow();
  });

  it('should pass validated input to handler', async () => {
    const proc = procedure()
      .input(
        z.object({
          count: z.coerce.number(),
        })
      )
      .query(async ({ input }) => {
        expect(typeof input.count).toBe('number');
        return { result: input.count * 2 };
      });

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, { count: '21' }, ctx);

    expect(result).toEqual({ result: 42 });
  });

  it('should handle async handlers', async () => {
    const proc = procedure().query(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { delayed: true };
    });

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, undefined, ctx);

    expect(result).toEqual({ delayed: true });
  });

  it('should propagate handler errors', async () => {
    const proc = procedure().query(async () => {
      throw new Error('Handler error');
    });

    const ctx: BaseContext = {} as BaseContext;

    await expect(executeProcedure(proc, undefined, ctx)).rejects.toThrow('Handler error');
  });

  it('should execute without middleware when none defined', async () => {
    const proc = procedure().query(async () => ({ fast: true }));

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, undefined, ctx);

    expect(result).toEqual({ fast: true });
  });

  it('should allow middleware to modify output', async () => {
    const proc = procedure()
      .use(async ({ next }) => {
        const result = await next();
        return { output: { ...result.output, enhanced: true } };
      })
      .query(async () => ({ original: true }));

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, undefined, ctx);

    expect(result).toEqual({ original: true, enhanced: true });
  });
});

describe('Type Guards', () => {
  describe('isCompiledProcedure', () => {
    it('should return true for compiled procedures', () => {
      const proc = procedure().query(async () => ({}));

      expect(isCompiledProcedure(proc)).toBe(true);
    });

    it('should return false for non-procedures', () => {
      expect(isCompiledProcedure({})).toBe(false);
      expect(isCompiledProcedure(null)).toBe(false);
      expect(isCompiledProcedure(undefined)).toBe(false);
      expect(isCompiledProcedure('string')).toBe(false);
      expect(isCompiledProcedure({ type: 'query' })).toBe(false);
    });
  });

  describe('isProcedureCollection', () => {
    it('should return true for procedure collections', () => {
      const collection = defineProcedures('test', {
        proc: procedure().query(async () => ({})),
      });

      expect(isProcedureCollection(collection)).toBe(true);
    });

    it('should return false for non-collections', () => {
      expect(isProcedureCollection({})).toBe(false);
      expect(isProcedureCollection(null)).toBe(false);
      expect(isProcedureCollection({ namespace: 'test' })).toBe(false);
      expect(isProcedureCollection({ procedures: {} })).toBe(false);
    });
  });
});

describe('Edge Cases and Complex Scenarios', () => {
  it('should handle nested object input', async () => {
    const proc = procedure()
      .input(
        z.object({
          user: z.object({
            name: z.string(),
            profile: z.object({
              age: z.number(),
            }),
          }),
        })
      )
      .query(async ({ input }) => {
        return {
          greeting: `Hello, ${input.user.name}, age ${input.user.profile.age}`,
        };
      });

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(
      proc,
      {
        user: {
          name: 'John',
          profile: { age: 30 },
        },
      },
      ctx
    );

    expect(result.greeting).toBe('Hello, John, age 30');
  });

  it('should handle array input', async () => {
    const proc = procedure()
      .input(z.object({ ids: z.array(z.string()) }))
      .query(async ({ input }) => {
        return { count: input.ids.length };
      });

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, { ids: ['1', '2', '3'] }, ctx);

    expect(result).toEqual({ count: 3 });
  });

  it('should handle transformation in input schema', async () => {
    const proc = procedure()
      .input(
        z.object({
          text: z.string().transform((s) => s.toUpperCase()),
        })
      )
      .query(async ({ input }) => {
        return { transformed: input.text };
      });

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, { text: 'hello' }, ctx);

    expect(result).toEqual({ transformed: 'HELLO' });
  });

  it('should handle optional input fields', async () => {
    const proc = procedure()
      .input(
        z.object({
          required: z.string(),
          optional: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return { received: input };
      });

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, { required: 'value' }, ctx);

    expect(result.received).toEqual({ required: 'value' });
  });

  it('should handle multiple middleware modifying context', async () => {
    const proc = procedure()
      .use(async ({ next, ctx }) => {
        return next({ ctx: { ...ctx, step1: true } });
      })
      .use(async ({ next, ctx }) => {
        const extendedCtx = ctx as BaseContext & { step1: boolean };
        expect(extendedCtx.step1).toBe(true);
        return next({ ctx: { ...ctx, step2: true } });
      })
      .query(async ({ ctx }) => {
        const extendedCtx = ctx as BaseContext & { step1: boolean; step2: boolean };
        return {
          step1: extendedCtx.step1,
          step2: extendedCtx.step2,
        };
      });

    const ctx: BaseContext = {} as BaseContext;
    const result = await executeProcedure(proc, undefined, ctx);

    expect(result).toEqual({ step1: true, step2: true });
  });
});
