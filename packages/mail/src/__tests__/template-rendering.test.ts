/**
 * Template Rendering Tests
 *
 * Tests for email template rendering, subject generation,
 * and content edge cases.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineMail } from '../mail.js';
import { createMailManager } from '../manager.js';

// Helper to create React elements for tests
const div = (props: { children?: React.ReactNode } = {}) => React.createElement('div', props);

describe('Template Rendering', () => {
  describe('subject generation', () => {
    it('should support static string subjects', async () => {
      const StaticSubjectEmail = defineMail({
        name: 'static-subject',
        schema: z.object({ name: z.string() }),
        subject: 'Static Subject Line',
        template: ({ name }) => div({ children: name }),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(StaticSubjectEmail, {
        to: 'user@example.com',
        data: { name: 'John' },
      });

      expect(rendered.subject).toBe('Static Subject Line');
      await manager.close();
    });

    it('should support dynamic subject functions', async () => {
      const DynamicSubjectEmail = defineMail({
        name: 'dynamic-subject',
        schema: z.object({ userName: z.string(), orderCount: z.number() }),
        subject: ({ userName, orderCount }) => `${userName}, you have ${orderCount} new orders!`,
        template: () => div(),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(DynamicSubjectEmail, {
        to: 'user@example.com',
        data: { userName: 'Alice', orderCount: 5 },
      });

      expect(rendered.subject).toBe('Alice, you have 5 new orders!');
      await manager.close();
    });

    it('should handle special characters in subject', async () => {
      const SpecialCharsEmail = defineMail({
        name: 'special-chars',
        schema: z.object({ product: z.string() }),
        subject: ({ product }) => `🎉 Special offer: ${product} < 50% off! >`,
        template: () => div(),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(SpecialCharsEmail, {
        to: 'user@example.com',
        data: { product: 'Widget & Gadget' },
      });

      expect(rendered.subject).toBe('🎉 Special offer: Widget & Gadget < 50% off! >');
      await manager.close();
    });

    it('should handle empty subject', async () => {
      const EmptySubjectEmail = defineMail({
        name: 'empty-subject',
        schema: z.object({}),
        subject: '',
        template: () => div(),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(EmptySubjectEmail, {
        to: 'user@example.com',
        data: {},
      });

      expect(rendered.subject).toBe('');
      await manager.close();
    });

    it('should handle very long subjects', async () => {
      const LongSubjectEmail = defineMail({
        name: 'long-subject',
        schema: z.object({ description: z.string() }),
        subject: ({ description }) => description,
        template: () => div(),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const longDescription = 'A'.repeat(500);
      const rendered = await manager.render(LongSubjectEmail, {
        to: 'user@example.com',
        data: { description: longDescription },
      });

      expect(rendered.subject).toBe(longDescription);
      expect(rendered.subject.length).toBe(500);
      await manager.close();
    });
  });

  describe('recipient handling', () => {
    it('should handle single recipient as string', async () => {
      const SimpleEmail = defineMail({
        name: 'simple',
        schema: z.object({}),
        subject: 'Test',
        template: () => div(),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(SimpleEmail, {
        to: 'single@example.com',
        data: {},
      });

      expect(rendered.to).toHaveLength(1);
      expect(rendered.to[0].email).toBe('single@example.com');
      await manager.close();
    });

    it('should handle multiple recipients as array', async () => {
      const SimpleEmail = defineMail({
        name: 'simple',
        schema: z.object({}),
        subject: 'Test',
        template: () => div(),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(SimpleEmail, {
        to: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
        data: {},
      });

      expect(rendered.to).toHaveLength(3);
      expect(rendered.to.map((r) => r.email)).toContain('user1@example.com');
      expect(rendered.to.map((r) => r.email)).toContain('user2@example.com');
      expect(rendered.to.map((r) => r.email)).toContain('user3@example.com');
      await manager.close();
    });

    it('should handle recipient objects with name and email', async () => {
      const SimpleEmail = defineMail({
        name: 'simple',
        schema: z.object({}),
        subject: 'Test',
        template: () => div(),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(SimpleEmail, {
        to: [{ email: 'john@example.com', name: 'John Doe' }],
        data: {},
      });

      expect(rendered.to).toHaveLength(1);
      expect(rendered.to[0].email).toBe('john@example.com');
      expect(rendered.to[0].name).toBe('John Doe');
      await manager.close();
    });
  });

  describe('from address handling', () => {
    it('should use mail-specific from address', async () => {
      const CustomFromEmail = defineMail({
        name: 'custom-from',
        schema: z.object({}),
        subject: 'Test',
        template: () => div(),
        from: { email: 'special@example.com', name: 'Special Sender' },
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'default@example.com', name: 'Default' },
      });

      const rendered = await manager.render(CustomFromEmail, {
        to: 'user@example.com',
        data: {},
      });

      expect(rendered.from?.email).toBe('special@example.com');
      expect(rendered.from?.name).toBe('Special Sender');
      await manager.close();
    });

    it('should fall back to manager default from address', async () => {
      const NoFromEmail = defineMail({
        name: 'no-from',
        schema: z.object({}),
        subject: 'Test',
        template: () => div(),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'default@example.com', name: 'Default Sender' },
      });

      const rendered = await manager.render(NoFromEmail, {
        to: 'user@example.com',
        data: {},
      });

      expect(rendered.from?.email).toBe('default@example.com');
      await manager.close();
    });
  });

  describe('template data handling', () => {
    it('should pass complex nested data to template', async () => {
      const ComplexDataEmail = defineMail({
        name: 'complex-data',
        schema: z.object({
          user: z.object({
            name: z.string(),
            preferences: z.object({
              theme: z.string(),
              notifications: z.boolean(),
            }),
          }),
          items: z.array(
            z.object({
              name: z.string(),
              price: z.number(),
            })
          ),
        }),
        subject: ({ user }) => `Order for ${user.name}`,
        template: ({ user, items }) =>
          React.createElement('div', null, [
            React.createElement('h1', { key: '1' }, `Hello ${user.name}`),
            React.createElement('p', { key: '2' }, `Items: ${items.length}`),
          ]),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(ComplexDataEmail, {
        to: 'user@example.com',
        data: {
          user: {
            name: 'Alice',
            preferences: { theme: 'dark', notifications: true },
          },
          items: [
            { name: 'Widget', price: 9.99 },
            { name: 'Gadget', price: 19.99 },
          ],
        },
      });

      expect(rendered.subject).toBe('Order for Alice');
      await manager.close();
    });

    it('should handle empty arrays in data', async () => {
      const EmptyArrayEmail = defineMail({
        name: 'empty-array',
        schema: z.object({
          items: z.array(z.string()),
        }),
        subject: ({ items }) => `${items.length} items`,
        template: () => div(),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(EmptyArrayEmail, {
        to: 'user@example.com',
        data: { items: [] },
      });

      expect(rendered.subject).toBe('0 items');
      await manager.close();
    });

    it('should handle null and undefined values in data', async () => {
      const NullableDataEmail = defineMail({
        name: 'nullable-data',
        schema: z.object({
          name: z.string(),
          nickname: z.string().nullable(),
          title: z.string().optional(),
        }),
        subject: ({ name, nickname }) => `${nickname ?? name}`,
        template: () => div(),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(NullableDataEmail, {
        to: 'user@example.com',
        data: { name: 'John', nickname: null },
      });

      expect(rendered.subject).toBe('John');
      await manager.close();
    });
  });

  describe('plain text generation', () => {
    it('should use custom text generator when provided', async () => {
      const TextEmail = defineMail({
        name: 'text-email',
        schema: z.object({ message: z.string() }),
        subject: 'Test',
        template: () => div(),
        text: ({ message }) => `Plain text: ${message}`,
      });

      expect(TextEmail.text).toBeDefined();
      expect(typeof TextEmail.text).toBe('function');
      if (TextEmail.text) {
        expect(TextEmail.text({ message: 'Hello' })).toBe('Plain text: Hello');
      }
    });

    it('should handle text generator with complex data', async () => {
      const ComplexTextEmail = defineMail({
        name: 'complex-text',
        schema: z.object({
          items: z.array(z.object({ name: z.string(), qty: z.number() })),
        }),
        subject: 'Your Order',
        template: () => div(),
        text: ({ items }) => items.map((item) => `- ${item.name} x${item.qty}`).join('\n'),
      });

      if (ComplexTextEmail.text) {
        const plainText = ComplexTextEmail.text({
          items: [
            { name: 'Widget', qty: 2 },
            { name: 'Gadget', qty: 1 },
          ],
        });
        expect(plainText).toBe('- Widget x2\n- Gadget x1');
      }
    });
  });

  describe('template name validation', () => {
    it('should accept valid kebab-case names', () => {
      const templates = [
        'welcome',
        'password-reset',
        'order-confirmation',
        'account-verification-email',
      ];

      for (const name of templates) {
        const mail = defineMail({
          name,
          schema: z.object({}),
          subject: 'Test',
          template: () => div(),
        });
        expect(mail.name).toBe(name);
      }
    });

    it('should reject dot-separated names (not kebab-case)', () => {
      const invalidNames = ['user.welcome', 'order.shipped', 'auth.password.reset'];

      for (const name of invalidNames) {
        expect(() =>
          defineMail({
            name,
            schema: z.object({}),
            subject: 'Test',
            template: () => div(),
          })
        ).toThrow();
      }
    });

    it('should reject names with spaces', () => {
      expect(() =>
        defineMail({
          name: 'invalid name',
          schema: z.object({}),
          subject: 'Test',
          template: () => div(),
        })
      ).toThrow();
    });

    it('should reject names with special characters', () => {
      const invalidNames = ['email@template', 'email!important', 'email#tag'];

      for (const name of invalidNames) {
        expect(() =>
          defineMail({
            name,
            schema: z.object({}),
            subject: 'Test',
            template: () => div(),
          })
        ).toThrow();
      }
    });
  });

  describe('schema validation', () => {
    it('should validate data against schema during send', async () => {
      const StrictEmail = defineMail({
        name: 'strict',
        schema: z.object({
          email: z.string().email(),
          age: z.number().min(0).max(150),
        }),
        subject: 'Test',
        template: () => div(),
      });

      const manager = await createMailManager({
        driver: 'log',
        config: { logger: () => {} },
        from: { email: 'test@example.com' },
      });

      // Valid data should work
      const result = await manager.send(StrictEmail, {
        to: 'user@example.com',
        data: { email: 'valid@example.com', age: 25 },
      });
      expect(result.success).toBe(true);

      await manager.close();
    });

    it('should fail validation for invalid data', async () => {
      const StrictEmail = defineMail({
        name: 'strict',
        schema: z.object({
          email: z.string().email(),
        }),
        subject: 'Test',
        template: () => div(),
      });

      const manager = await createMailManager({
        driver: 'log',
        config: { logger: () => {} },
        from: { email: 'test@example.com' },
      });

      // Invalid data should fail
      await expect(
        manager.send(StrictEmail, {
          to: 'user@example.com',
          data: { email: 'not-an-email' },
        })
      ).rejects.toThrow();

      await manager.close();
    });
  });

  describe('concurrent template rendering', () => {
    it('should handle parallel rendering of same template', async () => {
      const SharedTemplate = defineMail({
        name: 'shared',
        schema: z.object({ id: z.number() }),
        subject: ({ id }) => `Message #${id}`,
        template: ({ id }) => div({ children: `ID: ${id}` }),
      });

      const manager = await createMailManager({
        driver: 'log',
        config: { logger: () => {} },
        from: { email: 'test@example.com' },
      });

      const promises = Array.from({ length: 20 }, (_, i) =>
        manager.render(SharedTemplate, {
          to: `user${i}@example.com`,
          data: { id: i },
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(20);
      results.forEach((rendered, i) => {
        expect(rendered.subject).toBe(`Message #${i}`);
        expect(rendered.to[0].email).toBe(`user${i}@example.com`);
      });

      await manager.close();
    });

    it('should handle parallel rendering of different templates', async () => {
      const WelcomeEmail = defineMail({
        name: 'welcome',
        schema: z.object({ name: z.string() }),
        subject: ({ name }) => `Welcome ${name}`,
        template: () => div(),
      });

      const GoodbyeEmail = defineMail({
        name: 'goodbye',
        schema: z.object({ name: z.string() }),
        subject: ({ name }) => `Goodbye ${name}`,
        template: () => div(),
      });

      const manager = await createMailManager({
        driver: 'log',
        config: { logger: () => {} },
        from: { email: 'test@example.com' },
      });

      const promises = [
        manager.render(WelcomeEmail, { to: 'a@example.com', data: { name: 'Alice' } }),
        manager.render(GoodbyeEmail, { to: 'b@example.com', data: { name: 'Bob' } }),
        manager.render(WelcomeEmail, { to: 'c@example.com', data: { name: 'Charlie' } }),
        manager.render(GoodbyeEmail, { to: 'd@example.com', data: { name: 'Diana' } }),
      ];

      const results = await Promise.all(promises);

      expect(results[0].subject).toBe('Welcome Alice');
      expect(results[1].subject).toBe('Goodbye Bob');
      expect(results[2].subject).toBe('Welcome Charlie');
      expect(results[3].subject).toBe('Goodbye Diana');

      await manager.close();
    });
  });
});
