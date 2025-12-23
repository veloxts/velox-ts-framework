/**
 * Job Definition Tests
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineJob, job } from '../job.js';

describe('defineJob', () => {
  it('should create a job definition with required fields', () => {
    const testJob = defineJob({
      name: 'test.job',
      schema: z.object({ userId: z.string() }),
      handler: async () => {},
    });

    expect(testJob.name).toBe('test.job');
    expect(testJob.schema).toBeDefined();
    expect(testJob.handler).toBeDefined();
    expect(testJob.queue).toBe('default');
  });

  it('should use default job options when not provided', () => {
    const testJob = defineJob({
      name: 'test.defaults',
      schema: z.object({}),
      handler: async () => {},
    });

    expect(testJob.options.attempts).toBe(3);
    expect(testJob.options.backoff).toEqual({
      type: 'exponential',
      delay: 1000,
    });
    expect(testJob.options.priority).toBe(0);
    expect(testJob.options.removeOnComplete).toBe(true);
    expect(testJob.options.removeOnFail).toBe(false);
  });

  it('should merge custom job options with defaults', () => {
    const testJob = defineJob({
      name: 'test.custom',
      schema: z.object({}),
      handler: async () => {},
      options: {
        attempts: 5,
        backoff: { type: 'fixed', delay: 2000 },
      },
    });

    expect(testJob.options.attempts).toBe(5);
    expect(testJob.options.backoff).toEqual({
      type: 'fixed',
      delay: 2000,
    });
    // Defaults should still be applied
    expect(testJob.options.priority).toBe(0);
    expect(testJob.options.removeOnComplete).toBe(true);
  });

  it('should use custom queue name when provided', () => {
    const testJob = defineJob({
      name: 'test.queue',
      schema: z.object({}),
      handler: async () => {},
      queue: 'high',
    });

    expect(testJob.queue).toBe('high');
  });

  it('should throw error for invalid job name', () => {
    expect(() =>
      defineJob({
        name: '123invalid',
        schema: z.object({}),
        handler: async () => {},
      })
    ).toThrow(/Invalid job name/);
  });

  it('should throw error for empty job name', () => {
    expect(() =>
      defineJob({
        name: '',
        schema: z.object({}),
        handler: async () => {},
      })
    ).toThrow(/must be a non-empty string/);
  });

  it('should accept dot-separated job names', () => {
    const testJob = defineJob({
      name: 'email.user.welcome',
      schema: z.object({}),
      handler: async () => {},
    });

    expect(testJob.name).toBe('email.user.welcome');
  });

  it('should preserve handler function reference', () => {
    const handler = vi.fn();
    const testJob = defineJob({
      name: 'test.handler',
      schema: z.object({}),
      handler,
    });

    expect(testJob.handler).toBe(handler);
  });

  it('should preserve schema reference', () => {
    const schema = z.object({
      userId: z.string().uuid(),
      email: z.string().email(),
    });

    const testJob = defineJob({
      name: 'test.schema',
      schema,
      handler: async () => {},
    });

    expect(testJob.schema).toBe(schema);
  });
});

describe('job alias', () => {
  it('should be an alias for defineJob', () => {
    expect(job).toBe(defineJob);
  });
});

describe('job type inference', () => {
  it('should infer payload type from schema', async () => {
    const sendEmail = defineJob({
      name: 'email.send',
      schema: z.object({
        to: z.string().email(),
        subject: z.string(),
        body: z.string(),
      }),
      handler: async ({ data }) => {
        // TypeScript should infer these types
        const _to: string = data.to;
        const _subject: string = data.subject;
        const _body: string = data.body;
        expect(_to).toBeDefined();
        expect(_subject).toBeDefined();
        expect(_body).toBeDefined();
      },
    });

    expect(sendEmail.name).toBe('email.send');
  });

  it('should provide job context properties', async () => {
    const trackProgress = defineJob({
      name: 'task.track',
      schema: z.object({ taskId: z.string() }),
      handler: async ({ data, jobId, queueName, attemptNumber, progress, log }) => {
        expect(typeof data.taskId).toBe('string');
        expect(typeof jobId).toBe('string');
        expect(typeof queueName).toBe('string');
        expect(typeof attemptNumber).toBe('number');
        expect(typeof progress).toBe('function');
        expect(typeof log).toBe('function');
      },
    });

    expect(trackProgress.name).toBe('task.track');
  });
});
