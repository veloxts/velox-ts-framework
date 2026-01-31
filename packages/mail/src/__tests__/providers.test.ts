/**
 * Tests for Mail DI Providers
 *
 * Validates:
 * - registerMailProviders bulk registration works correctly
 * - Services can be mocked/overridden in tests
 * - Mail manager is properly initialized
 */

import { Container } from '@veloxts/core';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineMail } from '../mail.js';
import type { MailManager } from '../manager.js';
import { registerMailProviders } from '../providers.js';
import { MAIL_CONFIG, MAIL_MANAGER } from '../tokens.js';

// Test mail template for send tests
const TestEmail = defineMail({
  name: 'test-email',
  schema: z.object({ name: z.string() }),
  subject: ({ name }) => `Hello, ${name}!`,
  template: ({ name }) => React.createElement('div', null, `Hello ${name}`),
});

describe('Mail DI Providers', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  afterEach(async () => {
    // Clean up any mail managers created
    if (container.isRegistered(MAIL_MANAGER)) {
      const mail = container.resolve(MAIL_MANAGER);
      await mail.close();
    }
  });

  describe('registerMailProviders', () => {
    it('registers mail config and manager', async () => {
      await registerMailProviders(container, { driver: 'log' });

      expect(container.isRegistered(MAIL_CONFIG)).toBe(true);
      expect(container.isRegistered(MAIL_MANAGER)).toBe(true);
    });

    it('config values are accessible from container', async () => {
      await registerMailProviders(container, {
        driver: 'log',
        from: { email: 'test@example.com', name: 'Test App' },
      });

      const config = container.resolve(MAIL_CONFIG);

      expect(config.driver).toBe('log');
      expect(config.from).toEqual({ email: 'test@example.com', name: 'Test App' });
    });

    it('uses log driver by default', async () => {
      await registerMailProviders(container);

      const config = container.resolve(MAIL_CONFIG);

      expect(config.driver).toBeUndefined(); // defaults to log internally
    });

    it('mail manager is fully functional after registration', async () => {
      await registerMailProviders(container, {
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const mail = container.resolve(MAIL_MANAGER);

      // Send should work with log driver (doesn't actually send)
      const result = await mail.send(TestEmail, {
        to: 'user@example.com',
        data: { name: 'Test User' },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('mail manager supports render without sending', async () => {
      await registerMailProviders(container, {
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const mail = container.resolve(MAIL_MANAGER);

      const rendered = await mail.render(TestEmail, {
        to: 'user@example.com',
        data: { name: 'Preview User' },
      });

      expect(rendered.subject).toBe('Hello, Preview User!');
      expect(rendered.html).toBeDefined(); // Mock element renders to HTML but content may vary
      expect(rendered.from.email).toBe('test@example.com');
      expect(rendered.to).toHaveLength(1);
      expect(rendered.to[0].email).toBe('user@example.com');
    });

    it('mail manager supports bulk sending', async () => {
      await registerMailProviders(container, {
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const mail = container.resolve(MAIL_MANAGER);

      const results = await mail.sendBulk(TestEmail, [
        { to: 'user1@example.com', data: { name: 'User 1' } },
        { to: 'user2@example.com', data: { name: 'User 2' } },
        { to: 'user3@example.com', data: { name: 'User 3' } },
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('validates template data against schema', async () => {
      await registerMailProviders(container, {
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const mail = container.resolve(MAIL_MANAGER);

      // Valid data should work
      await expect(
        mail.send(TestEmail, { to: 'user@example.com', data: { name: 'Valid' } })
      ).resolves.toBeDefined();

      // Invalid data should throw
      await expect(
        mail.send(TestEmail, {
          to: 'user@example.com',
          data: { name: 123 } as unknown as { name: string },
        })
      ).rejects.toThrow();
    });
  });

  describe('Service Mocking', () => {
    it('allows mocking MAIL_MANAGER after registration', async () => {
      await registerMailProviders(container, { driver: 'log' });

      // Create a mock mail manager
      const mockMailManager: Partial<MailManager> = {
        send: vi.fn().mockResolvedValue({ success: true, messageId: 'mock-id' }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      container.register({ provide: MAIL_MANAGER, useValue: mockMailManager });

      const mail = container.resolve(MAIL_MANAGER);

      expect(mail).toBe(mockMailManager);

      const result = await mail.send(TestEmail, {
        to: 'user@example.com',
        data: { name: 'Test' },
      });
      expect(result.messageId).toBe('mock-id');
    });

    it('allows mocking MAIL_CONFIG after registration', async () => {
      await registerMailProviders(container, { driver: 'log' });

      const mockConfig = {
        driver: 'resend' as const,
        config: { apiKey: 'mock-key' },
        from: { email: 'mock@example.com' },
      };
      container.register({ provide: MAIL_CONFIG, useValue: mockConfig });

      const config = container.resolve(MAIL_CONFIG);

      expect(config).toBe(mockConfig);
      expect(config.driver).toBe('resend');
    });

    it('child container can override parent registrations', async () => {
      await registerMailProviders(container, { driver: 'log' });

      const childContainer = container.createChild();

      const mockMailManager: Partial<MailManager> = {
        send: vi.fn().mockResolvedValue({ success: true, messageId: 'child-id' }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      childContainer.register({ provide: MAIL_MANAGER, useValue: mockMailManager });

      const parentMail = container.resolve(MAIL_MANAGER);
      const childMail = childContainer.resolve(MAIL_MANAGER);

      expect(childMail).toBe(mockMailManager);
      expect(parentMail).not.toBe(mockMailManager);
    });

    it('child container inherits parent registrations', async () => {
      await registerMailProviders(container, { driver: 'log' });

      const childContainer = container.createChild();

      // Should resolve from parent
      const mail = childContainer.resolve(MAIL_MANAGER);
      const config = childContainer.resolve(MAIL_CONFIG);

      expect(mail).toBeDefined();
      expect(config).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('throws when resolving unregistered MAIL_MANAGER token', () => {
      expect(() => container.resolve(MAIL_MANAGER)).toThrow('No provider found for: MAIL_MANAGER');
    });

    it('throws when resolving MAIL_CONFIG without registration', () => {
      expect(() => container.resolve(MAIL_CONFIG)).toThrow('No provider found for: MAIL_CONFIG');
    });

    it('throws when sending without from address', async () => {
      await registerMailProviders(container, { driver: 'log' });

      const mail = container.resolve(MAIL_MANAGER);

      // Should throw because no from address configured
      await expect(
        mail.send(TestEmail, { to: 'user@example.com', data: { name: 'Test' } })
      ).rejects.toThrow('From address is required');
    });
  });

  describe('Integration with Real Services', () => {
    it('complete mail flow works with DI-provided services', async () => {
      await registerMailProviders(container, {
        driver: 'log',
        from: { email: 'integration@example.com', name: 'Integration Test' },
        replyTo: { email: 'reply@example.com' },
      });

      const mail = container.resolve(MAIL_MANAGER);
      const config = container.resolve(MAIL_CONFIG);

      // Config should be accessible
      expect(config.driver).toBe('log');
      expect(config.from).toEqual({ email: 'integration@example.com', name: 'Integration Test' });

      // Mail should be functional
      const result = await mail.send(TestEmail, {
        to: [{ email: 'user@example.com', name: 'Test User' }],
        data: { name: 'Integration' },
      });
      expect(result.success).toBe(true);
    });

    it('multiple containers can have independent mail instances', async () => {
      const container1 = new Container();
      const container2 = new Container();

      await registerMailProviders(container1, {
        driver: 'log',
        from: { email: 'app1@example.com' },
      });

      await registerMailProviders(container2, {
        driver: 'log',
        from: { email: 'app2@example.com' },
      });

      const mail1 = container1.resolve(MAIL_MANAGER);
      const mail2 = container2.resolve(MAIL_MANAGER);

      // Different instances
      expect(mail1).not.toBe(mail2);

      // Different configs
      const config1 = container1.resolve(MAIL_CONFIG);
      const config2 = container2.resolve(MAIL_CONFIG);
      expect(config1.from).toEqual({ email: 'app1@example.com' });
      expect(config2.from).toEqual({ email: 'app2@example.com' });

      // Cleanup
      await mail1.close();
      await mail2.close();
    });

    it('supports log driver config options', async () => {
      const customLogger = vi.fn();

      await registerMailProviders(container, {
        driver: 'log',
        config: { showHtml: true, logger: customLogger },
        from: { email: 'test@example.com' },
      });

      const mail = container.resolve(MAIL_MANAGER);

      await mail.send(TestEmail, {
        to: 'user@example.com',
        data: { name: 'Logger Test' },
      });

      // Custom logger should have been called
      expect(customLogger).toHaveBeenCalled();
    });
  });
});
