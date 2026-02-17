/**
 * @veloxts/core - fireAndForget Unit Tests
 */

import { describe, expect, it, vi } from 'vitest';

import { fireAndForget } from '../utils/fire-and-forget.js';

describe('fireAndForget', () => {
  it('should not throw when promise resolves', () => {
    expect(() => {
      fireAndForget(Promise.resolve('ok'));
    }).not.toThrow();
  });

  it('should catch errors and call onError', async () => {
    const onError = vi.fn();
    const error = new Error('background failure');

    fireAndForget(Promise.reject(error), { onError });

    // Wait for microtask to flush
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should log errors when no onError provided', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    fireAndForget(Promise.reject(new Error('unhandled')));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should include label in log output', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    fireAndForget(Promise.reject(new Error('fail')), { label: 'analytics' });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const callArgs = consoleSpy.mock.calls[0];
    expect(callArgs.some((arg) => typeof arg === 'string' && arg.includes('analytics'))).toBe(true);
    consoleSpy.mockRestore();
  });

  it('should not propagate errors to the caller', async () => {
    const onError = vi.fn();

    // This should not cause an unhandled rejection
    fireAndForget(Promise.reject(new Error('swallowed')), { onError });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('should handle successful promises silently', async () => {
    const onError = vi.fn();

    fireAndForget(Promise.resolve('done'), { onError });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onError).not.toHaveBeenCalled();
  });
});
