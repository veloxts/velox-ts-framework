/**
 * @veloxts/core - withRetry Unit Tests
 */

import { describe, expect, it, vi } from 'vitest';

import { withRetry } from '../utils/retry.js';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await withRetry(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');

    const result = await withRetry(fn, { delayMs: 1 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after exhausting all attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(withRetry(fn, { attempts: 3, delayMs: 1 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect retryIf predicate', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('non-retryable'));

    await expect(
      withRetry(fn, {
        attempts: 3,
        delayMs: 1,
        retryIf: () => false,
      })
    ).rejects.toThrow('non-retryable');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry before each retry', async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok');

    await withRetry(fn, { delayMs: 1, attempts: 3, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 2);
  });

  it('should use fixed delay when exponential is false', async () => {
    const start = Date.now();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    await withRetry(fn, { delayMs: 50, exponential: false, attempts: 3 });

    const elapsed = Date.now() - start;
    // Two retries at 50ms each = ~100ms total
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(300);
  });

  it('should use exponential backoff by default', async () => {
    const start = Date.now();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    await withRetry(fn, { delayMs: 50, attempts: 3 });

    const elapsed = Date.now() - start;
    // First retry: 50ms, second: 100ms = ~150ms total
    expect(elapsed).toBeGreaterThanOrEqual(140);
    expect(elapsed).toBeLessThan(400);
  });

  it('should default to 3 attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(withRetry(fn, { delayMs: 1 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not call onRetry on final failure', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(withRetry(fn, { attempts: 2, delayMs: 1, onRetry })).rejects.toThrow();

    // Only called once (before attempt 2), not after final failure
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });
});
