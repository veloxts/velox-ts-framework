import { describe, expect, it } from 'vitest';

import { mergeDeep } from '../merge.js';

describe('mergeDeep', () => {
  it('should return base if no overrides', () => {
    const base = { a: 1, b: 2 };
    expect(mergeDeep(base)).toEqual({ a: 1, b: 2 });
    expect(mergeDeep(base, undefined)).toEqual({ a: 1, b: 2 });
  });

  it('should merge flat objects', () => {
    const base = { a: 1, b: 2 };
    const overrides = { b: 3, c: 4 };
    expect(mergeDeep(base, overrides)).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('should merge nested objects', () => {
    const base = { a: { x: 1, y: 2 }, b: 3 };
    const overrides = { a: { y: 5 } };
    expect(mergeDeep(base, overrides)).toEqual({ a: { x: 1, y: 5 }, b: 3 });
  });

  it('should deeply merge nested objects', () => {
    const base = { a: { b: { c: 1, d: 2 } } };
    const overrides = { a: { b: { d: 3 } } };
    expect(mergeDeep(base, overrides)).toEqual({ a: { b: { c: 1, d: 3 } } });
  });

  it('should replace arrays (not concatenate)', () => {
    const base = { arr: [1, 2, 3] };
    const overrides = { arr: [4, 5] };
    expect(mergeDeep(base, overrides)).toEqual({ arr: [4, 5] });
  });

  it('should skip undefined values in overrides', () => {
    const base = { a: 1, b: 2 };
    const overrides = { a: undefined, b: 3 };
    expect(mergeDeep(base, overrides)).toEqual({ a: 1, b: 3 });
  });

  it('should replace values with null', () => {
    const base = { a: { x: 1 }, b: 2 };
    const overrides = { a: null };
    expect(mergeDeep(base, overrides)).toEqual({ a: null, b: 2 });
  });

  it('should not mutate base object', () => {
    const base = { a: { x: 1 } };
    const overrides = { a: { x: 2 } };
    mergeDeep(base, overrides);
    expect(base).toEqual({ a: { x: 1 } });
  });

  it('should handle prototype pollution attempts', () => {
    const base = { a: 1 };
    const overrides = { __proto__: { injected: true }, constructor: { bad: true } };
    const result = mergeDeep(base, overrides as Record<string, unknown>);
    expect(result).toEqual({ a: 1 });
    expect((result as Record<string, unknown>).injected).toBeUndefined();
  });
});
