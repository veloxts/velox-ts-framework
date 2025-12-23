/**
 * Mail Utils Tests
 */

import { describe, expect, it } from 'vitest';

import {
  escapeHtml,
  formatAddress,
  isValidEmail,
  normalizeRecipient,
  normalizeRecipients,
  sanitizeHeaderValue,
  stripHtml,
  validateRecipient,
  validateRecipients,
  validateTemplateName,
} from '../utils.js';

describe('normalizeRecipient', () => {
  it('should normalize a string email', () => {
    const result = normalizeRecipient('user@example.com');
    expect(result).toEqual({ email: 'user@example.com' });
  });

  it('should normalize "Name <email>" format', () => {
    const result = normalizeRecipient('John Doe <john@example.com>');
    expect(result).toEqual({ email: 'john@example.com', name: 'John Doe' });
  });

  it('should pass through EmailAddress object', () => {
    const input = { email: 'user@example.com', name: 'User' };
    const result = normalizeRecipient(input);
    expect(result).toEqual(input);
  });

  it('should handle name with special characters', () => {
    const result = normalizeRecipient('John "Johnny" Doe <john@example.com>');
    expect(result).toEqual({ email: 'john@example.com', name: 'John "Johnny" Doe' });
  });

  it('should handle email in angle brackets without name', () => {
    // Angle brackets without name are treated as plain email string
    const result = normalizeRecipient('<john@example.com>');
    expect(result).toEqual({ email: '<john@example.com>' });
  });
});

describe('normalizeRecipients', () => {
  it('should normalize a single recipient', () => {
    const result = normalizeRecipients('user@example.com');
    expect(result).toEqual([{ email: 'user@example.com' }]);
  });

  it('should normalize an array of recipients', () => {
    const result = normalizeRecipients([
      'a@example.com',
      { email: 'b@example.com', name: 'B' },
      'C User <c@example.com>',
    ]);
    expect(result).toEqual([
      { email: 'a@example.com' },
      { email: 'b@example.com', name: 'B' },
      { email: 'c@example.com', name: 'C User' },
    ]);
  });
});

describe('sanitizeHeaderValue', () => {
  it('should remove newlines', () => {
    expect(sanitizeHeaderValue('John\nDoe')).toBe('John Doe');
    expect(sanitizeHeaderValue('John\r\nDoe')).toBe('John  Doe');
  });

  it('should remove carriage returns', () => {
    expect(sanitizeHeaderValue('John\rDoe')).toBe('John Doe');
  });

  it('should remove tabs', () => {
    expect(sanitizeHeaderValue('John\tDoe')).toBe('John Doe');
  });

  it('should remove control characters', () => {
    expect(sanitizeHeaderValue('John\x00Doe')).toBe('John Doe');
    expect(sanitizeHeaderValue('John\x1fDoe')).toBe('John Doe');
    expect(sanitizeHeaderValue('John\x7fDoe')).toBe('John Doe');
  });

  it('should trim result', () => {
    expect(sanitizeHeaderValue('  John Doe  ')).toBe('John Doe');
  });

  it('should handle injection attempts', () => {
    // Attempt to inject BCC header
    const injection = 'John\nBcc: attacker@evil.com';
    expect(sanitizeHeaderValue(injection)).toBe('John Bcc: attacker@evil.com');

    // Attempt to inject with CRLF
    const crlfInjection = 'John\r\nBcc: attacker@evil.com';
    expect(sanitizeHeaderValue(crlfInjection)).toBe('John  Bcc: attacker@evil.com');
  });
});

describe('formatAddress', () => {
  it('should format email without name', () => {
    const result = formatAddress({ email: 'user@example.com' });
    expect(result).toBe('user@example.com');
  });

  it('should format email with name', () => {
    const result = formatAddress({ email: 'user@example.com', name: 'John Doe' });
    expect(result).toBe('John Doe <user@example.com>');
  });

  it('should sanitize name to prevent header injection', () => {
    // Attempt to inject additional headers via name field
    const result = formatAddress({
      email: 'john@example.com',
      name: 'John\nBcc: attacker@evil.com',
    });
    // Newline should be replaced with space, preventing injection
    expect(result).toBe('John Bcc: attacker@evil.com <john@example.com>');
    expect(result).not.toContain('\n');
  });

  it('should handle CRLF injection attempts', () => {
    const result = formatAddress({
      email: 'john@example.com',
      name: 'John\r\nSubject: Injected',
    });
    expect(result).not.toContain('\r');
    expect(result).not.toContain('\n');
  });
});

describe('isValidEmail', () => {
  it('should return true for valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user.name@example.com')).toBe(true);
    expect(isValidEmail('user+tag@example.com')).toBe(true);
    expect(isValidEmail('user@subdomain.example.com')).toBe(true);
    expect(isValidEmail('a@example.co')).toBe(true); // Single char local, 2 char TLD
    expect(isValidEmail('user123@test-domain.org')).toBe(true);
    expect(isValidEmail('user_name@example.com')).toBe(true);
    expect(isValidEmail('user-name@example.com')).toBe(true);
  });

  it('should return false for invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('user')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@example')).toBe(false);
    expect(isValidEmail('user example@test.com')).toBe(false);
  });

  it('should reject emails with short TLDs', () => {
    expect(isValidEmail('user@example.c')).toBe(false); // TLD too short
  });

  it('should reject emails with consecutive dots', () => {
    expect(isValidEmail('user..name@example.com')).toBe(false);
    expect(isValidEmail('user@example..com')).toBe(false);
  });

  it('should reject emails starting or ending with special chars', () => {
    expect(isValidEmail('.user@example.com')).toBe(false);
    expect(isValidEmail('user.@example.com')).toBe(false);
    expect(isValidEmail('user@.example.com')).toBe(false);
  });

  it('should handle edge cases', () => {
    // @ts-expect-error Testing invalid input
    expect(isValidEmail(null)).toBe(false);
    // @ts-expect-error Testing invalid input
    expect(isValidEmail(undefined)).toBe(false);
    // @ts-expect-error Testing invalid input
    expect(isValidEmail(123)).toBe(false);
  });
});

describe('validateRecipient', () => {
  it('should not throw for valid recipient', () => {
    expect(() => validateRecipient('user@example.com')).not.toThrow();
    expect(() => validateRecipient({ email: 'user@example.com' })).not.toThrow();
    expect(() => validateRecipient('John <user@example.com>')).not.toThrow();
  });

  it('should throw for invalid email', () => {
    expect(() => validateRecipient('invalid')).toThrow(/Invalid email address/);
    expect(() => validateRecipient({ email: 'invalid' })).toThrow(/Invalid email address/);
  });
});

describe('validateRecipients', () => {
  it('should not throw for valid recipients', () => {
    expect(() => validateRecipients('user@example.com')).not.toThrow();
    expect(() => validateRecipients(['a@example.com', 'b@example.com'])).not.toThrow();
  });

  it('should throw for empty array', () => {
    expect(() => validateRecipients([])).toThrow(/At least one recipient is required/);
  });

  it('should throw if any recipient is invalid', () => {
    expect(() => validateRecipients(['valid@example.com', 'invalid'])).toThrow(
      /Invalid email address/
    );
  });
});

describe('escapeHtml', () => {
  it('should escape HTML entities', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('should escape ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should escape quotes', () => {
    expect(escapeHtml('It\'s a "test"')).toBe('It&#39;s a &quot;test&quot;');
  });

  it('should not modify plain text', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('stripHtml', () => {
  it('should remove HTML tags', () => {
    expect(stripHtml('<h1>Hello</h1>')).toBe('Hello');
    expect(stripHtml('<p>Hello <strong>World</strong></p>')).toBe('Hello World');
  });

  it('should decode HTML entities', () => {
    expect(stripHtml('Hello&nbsp;World')).toBe('Hello World');
    expect(stripHtml('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(stripHtml('&lt;test&gt;')).toBe('<test>');
  });

  it('should collapse whitespace', () => {
    expect(stripHtml('Hello    World')).toBe('Hello World');
    expect(stripHtml('Hello\n\nWorld')).toBe('Hello World');
  });

  it('should trim result', () => {
    expect(stripHtml('  <p>Hello</p>  ')).toBe('Hello');
  });
});

describe('validateTemplateName', () => {
  it('should accept valid template names', () => {
    expect(() => validateTemplateName('welcome')).not.toThrow();
    expect(() => validateTemplateName('password-reset')).not.toThrow();
    expect(() => validateTemplateName('order-confirmation-v2')).not.toThrow();
    expect(() => validateTemplateName('a1-b2-c3')).not.toThrow();
  });

  it('should reject empty names', () => {
    expect(() => validateTemplateName('')).toThrow(/must be a non-empty string/);
  });

  it('should reject names starting with numbers', () => {
    expect(() => validateTemplateName('123-template')).toThrow(/Invalid template name/);
  });

  it('should reject names starting with hyphens', () => {
    expect(() => validateTemplateName('-template')).toThrow(/Invalid template name/);
  });

  it('should reject names with uppercase', () => {
    expect(() => validateTemplateName('Welcome')).toThrow(/Invalid template name/);
    expect(() => validateTemplateName('welcomeEmail')).toThrow(/Invalid template name/);
  });

  it('should reject names with underscores', () => {
    expect(() => validateTemplateName('welcome_email')).toThrow(/Invalid template name/);
  });

  it('should reject names with spaces', () => {
    expect(() => validateTemplateName('welcome email')).toThrow(/Invalid template name/);
  });
});
