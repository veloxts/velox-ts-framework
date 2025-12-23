import { describe, expect, it } from 'vitest';

import {
  calculateExpiration,
  formatTtl,
  generateLockToken,
  isDurationString,
  isExpired,
  parseTtl,
  parseTtlMs,
  prefixKey,
  tagKey,
} from '../utils.js';

describe('parseTtl', () => {
  it('should parse seconds', () => {
    expect(parseTtl('30s')).toBe(30);
    expect(parseTtl('1s')).toBe(1);
    expect(parseTtl('120s')).toBe(120);
  });

  it('should parse minutes', () => {
    expect(parseTtl('1m')).toBe(60);
    expect(parseTtl('30m')).toBe(1800);
    expect(parseTtl('5m')).toBe(300);
  });

  it('should parse hours', () => {
    expect(parseTtl('1h')).toBe(3600);
    expect(parseTtl('24h')).toBe(86400);
    expect(parseTtl('2h')).toBe(7200);
  });

  it('should parse days', () => {
    expect(parseTtl('1d')).toBe(86400);
    expect(parseTtl('7d')).toBe(604800);
    expect(parseTtl('30d')).toBe(2592000);
  });

  it('should parse weeks', () => {
    expect(parseTtl('1w')).toBe(604800);
    expect(parseTtl('2w')).toBe(1209600);
  });

  it('should pass through numbers', () => {
    expect(parseTtl(3600)).toBe(3600);
    expect(parseTtl(60)).toBe(60);
    expect(parseTtl(1)).toBe(1);
  });

  it('should throw on invalid format', () => {
    expect(() => parseTtl('invalid' as '1s')).toThrow('Invalid TTL format');
    expect(() => parseTtl('1x' as '1s')).toThrow('Invalid TTL format');
    expect(() => parseTtl('abc' as '1s')).toThrow('Invalid TTL format');
  });
});

describe('parseTtlMs', () => {
  it('should return milliseconds', () => {
    expect(parseTtlMs('1s')).toBe(1000);
    expect(parseTtlMs('1m')).toBe(60000);
    expect(parseTtlMs('1h')).toBe(3600000);
  });
});

describe('formatTtl', () => {
  it('should format weeks', () => {
    expect(formatTtl(604800)).toBe('1w');
    expect(formatTtl(1209600)).toBe('2w');
  });

  it('should format days', () => {
    expect(formatTtl(86400)).toBe('1d');
    expect(formatTtl(172800)).toBe('2d');
  });

  it('should format hours', () => {
    expect(formatTtl(3600)).toBe('1h');
    expect(formatTtl(7200)).toBe('2h');
  });

  it('should format minutes', () => {
    expect(formatTtl(60)).toBe('1m');
    expect(formatTtl(300)).toBe('5m');
  });

  it('should format seconds', () => {
    expect(formatTtl(30)).toBe('30s');
    expect(formatTtl(1)).toBe('1s');
  });
});

describe('isDurationString', () => {
  it('should return true for valid duration strings', () => {
    expect(isDurationString('1s')).toBe(true);
    expect(isDurationString('30m')).toBe(true);
    expect(isDurationString('24h')).toBe(true);
    expect(isDurationString('7d')).toBe(true);
    expect(isDurationString('2w')).toBe(true);
  });

  it('should return false for invalid values', () => {
    expect(isDurationString('invalid')).toBe(false);
    expect(isDurationString('1x')).toBe(false);
    expect(isDurationString(123)).toBe(false);
    expect(isDurationString(null)).toBe(false);
    expect(isDurationString(undefined)).toBe(false);
    expect(isDurationString('')).toBe(false);
  });
});

describe('calculateExpiration', () => {
  it('should calculate expiration timestamp', () => {
    const now = Date.now();
    const expiration = calculateExpiration('1h');

    // Should be approximately 1 hour in the future (allow 100ms variance)
    expect(expiration).toBeGreaterThanOrEqual(now + 3600000 - 100);
    expect(expiration).toBeLessThanOrEqual(now + 3600000 + 100);
  });
});

describe('isExpired', () => {
  it('should return false for null expiration', () => {
    expect(isExpired(null)).toBe(false);
  });

  it('should return true for past timestamp', () => {
    expect(isExpired(Date.now() - 1000)).toBe(true);
  });

  it('should return false for future timestamp', () => {
    expect(isExpired(Date.now() + 1000000)).toBe(false);
  });
});

describe('prefixKey', () => {
  it('should prefix keys', () => {
    expect(prefixKey('user:123', 'velox:')).toBe('velox:user:123');
    expect(prefixKey('key', 'app:')).toBe('app:key');
  });
});

describe('tagKey', () => {
  it('should generate tag keys', () => {
    expect(tagKey('users', 'velox:')).toBe('velox:tag:users');
    expect(tagKey('posts', 'app:')).toBe('app:tag:posts');
  });
});

describe('generateLockToken', () => {
  it('should generate unique tokens', () => {
    const token1 = generateLockToken();
    const token2 = generateLockToken();

    expect(token1).not.toBe(token2);
    expect(typeof token1).toBe('string');
    expect(token1.length).toBeGreaterThan(10);
  });
});
