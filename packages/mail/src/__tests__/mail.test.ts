/**
 * Mail Definition Tests
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineMail, mail } from '../mail.js';

// Helper to create React elements for tests
const div = (props: { children?: React.ReactNode } = {}) => React.createElement('div', props);

describe('defineMail', () => {
  it('should create a mail definition with required fields', () => {
    const testMail = defineMail({
      name: 'test',
      schema: z.object({ name: z.string() }),
      subject: 'Test Subject',
      template: ({ name }) => div({ children: `Hello ${name}` }),
    });

    expect(testMail.name).toBe('test');
    expect(testMail.schema).toBeDefined();
    expect(testMail.subject).toBe('Test Subject');
    expect(testMail.template).toBeDefined();
    expect(testMail.from).toBeUndefined();
    expect(testMail.text).toBeUndefined();
  });

  it('should support dynamic subject function', () => {
    const testMail = defineMail({
      name: 'welcome',
      schema: z.object({ userName: z.string() }),
      subject: ({ userName }) => `Welcome, ${userName}!`,
      template: () => div(),
    });

    expect(typeof testMail.subject).toBe('function');
    if (typeof testMail.subject === 'function') {
      expect(testMail.subject({ userName: 'John' })).toBe('Welcome, John!');
    }
  });

  it('should include optional from address', () => {
    const testMail = defineMail({
      name: 'test',
      schema: z.object({}),
      subject: 'Test',
      template: () => div(),
      from: { email: 'noreply@example.com', name: 'My App' },
    });

    expect(testMail.from).toEqual({ email: 'noreply@example.com', name: 'My App' });
  });

  it('should include optional text generator', () => {
    const textGenerator = () => 'Plain text version';
    const testMail = defineMail({
      name: 'test',
      schema: z.object({}),
      subject: 'Test',
      template: () => div(),
      text: textGenerator,
    });

    expect(testMail.text).toBe(textGenerator);
  });

  it('should throw for invalid template name', () => {
    expect(() =>
      defineMail({
        name: 'Invalid Name',
        schema: z.object({}),
        subject: 'Test',
        template: () => div(),
      })
    ).toThrow(/Invalid template name/);
  });

  it('should throw for empty template name', () => {
    expect(() =>
      defineMail({
        name: '',
        schema: z.object({}),
        subject: 'Test',
        template: () => div(),
      })
    ).toThrow(/must be a non-empty string/);
  });

  it('should accept kebab-case names', () => {
    const testMail = defineMail({
      name: 'password-reset',
      schema: z.object({}),
      subject: 'Reset Password',
      template: () => div(),
    });

    expect(testMail.name).toBe('password-reset');
  });

  it('should preserve schema reference', () => {
    const schema = z.object({
      email: z.string().email(),
      code: z.string().length(6),
    });

    const testMail = defineMail({
      name: 'verification',
      schema,
      subject: 'Verify Email',
      template: () => div(),
    });

    expect(testMail.schema).toBe(schema);
  });
});

describe('mail alias', () => {
  it('should be an alias for defineMail', () => {
    expect(mail).toBe(defineMail);
  });
});
