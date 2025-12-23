/**
 * Queue Utils Tests
 */

import { describe, expect, it } from 'vitest';

import {
  formatDuration,
  generateJobId,
  isDurationString,
  parseDelay,
  validateJobName,
} from '../utils.js';

describe('isDurationString', () => {
  it('should return true for valid duration strings', () => {
    expect(isDurationString('1s')).toBe(true);
    expect(isDurationString('30m')).toBe(true);
    expect(isDurationString('24h')).toBe(true);
    expect(isDurationString('7d')).toBe(true);
    expect(isDurationString('2w')).toBe(true);
    expect(isDurationString('100s')).toBe(true);
  });

  it('should return false for invalid duration strings', () => {
    expect(isDurationString('')).toBe(false);
    expect(isDurationString('abc')).toBe(false);
    expect(isDurationString('10')).toBe(false);
    expect(isDurationString('s10')).toBe(false);
    expect(isDurationString('10x')).toBe(false);
    expect(isDurationString(123)).toBe(false);
    expect(isDurationString(null)).toBe(false);
    expect(isDurationString(undefined)).toBe(false);
  });
});

describe('parseDelay', () => {
  it('should parse seconds duration string to milliseconds', () => {
    expect(parseDelay('1s')).toBe(1000);
    expect(parseDelay('30s')).toBe(30000);
  });

  it('should parse minutes duration string to milliseconds', () => {
    expect(parseDelay('1m')).toBe(60000);
    expect(parseDelay('5m')).toBe(300000);
  });

  it('should parse hours duration string to milliseconds', () => {
    expect(parseDelay('1h')).toBe(3600000);
    expect(parseDelay('2h')).toBe(7200000);
  });

  it('should parse days duration string to milliseconds', () => {
    expect(parseDelay('1d')).toBe(86400000);
    expect(parseDelay('7d')).toBe(604800000);
  });

  it('should parse weeks duration string to milliseconds', () => {
    expect(parseDelay('1w')).toBe(604800000);
    expect(parseDelay('2w')).toBe(1209600000);
  });

  it('should convert number (seconds) to milliseconds', () => {
    expect(parseDelay(10)).toBe(10000);
    expect(parseDelay(60)).toBe(60000);
    expect(parseDelay(3600)).toBe(3600000);
  });

  it('should throw error for invalid duration format', () => {
    expect(() => parseDelay('invalid' as '1s')).toThrow(/Invalid delay format/);
    expect(() => parseDelay('10x' as '1s')).toThrow(/Invalid delay format/);
  });
});

describe('formatDuration', () => {
  it('should format milliseconds to weeks', () => {
    expect(formatDuration(604800000)).toBe('1w');
    expect(formatDuration(1209600000)).toBe('2w');
  });

  it('should format milliseconds to days', () => {
    expect(formatDuration(86400000)).toBe('1d');
    expect(formatDuration(172800000)).toBe('2d');
  });

  it('should format milliseconds to hours', () => {
    expect(formatDuration(3600000)).toBe('1h');
    expect(formatDuration(7200000)).toBe('2h');
  });

  it('should format milliseconds to minutes', () => {
    expect(formatDuration(60000)).toBe('1m');
    expect(formatDuration(300000)).toBe('5m');
  });

  it('should format milliseconds to seconds', () => {
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(30000)).toBe('30s');
    expect(formatDuration(45000)).toBe('45s');
  });
});

describe('generateJobId', () => {
  it('should generate unique job IDs', () => {
    const id1 = generateJobId();
    const id2 = generateJobId();
    const id3 = generateJobId();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  it('should generate string IDs', () => {
    const id = generateJobId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should contain a hyphen separator', () => {
    const id = generateJobId();
    expect(id).toContain('-');
  });
});

describe('validateJobName', () => {
  it('should accept valid job names', () => {
    expect(() => validateJobName('email')).not.toThrow();
    expect(() => validateJobName('email.welcome')).not.toThrow();
    expect(() => validateJobName('email.user.welcome')).not.toThrow();
    expect(() => validateJobName('Email')).not.toThrow();
    expect(() => validateJobName('sendEmail123')).not.toThrow();
    expect(() => validateJobName('a1.b2.c3')).not.toThrow();
  });

  it('should reject empty job names', () => {
    expect(() => validateJobName('')).toThrow(/must be a non-empty string/);
  });

  it('should reject job names starting with numbers', () => {
    expect(() => validateJobName('123email')).toThrow(/Invalid job name/);
    expect(() => validateJobName('1.email')).toThrow(/Invalid job name/);
  });

  it('should reject job names with invalid characters', () => {
    expect(() => validateJobName('email-welcome')).toThrow(/Invalid job name/);
    expect(() => validateJobName('email_welcome')).toThrow(/Invalid job name/);
    expect(() => validateJobName('email welcome')).toThrow(/Invalid job name/);
    expect(() => validateJobName('email@welcome')).toThrow(/Invalid job name/);
  });

  it('should reject job names ending with dots', () => {
    expect(() => validateJobName('email.')).toThrow(/Invalid job name/);
    expect(() => validateJobName('.email')).toThrow(/Invalid job name/);
    expect(() => validateJobName('email..welcome')).toThrow(/Invalid job name/);
  });
});
