/**
 * Mail Plugin
 *
 * VeloxTS plugin for integrating email functionality into the framework.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

// Side-effect import to enable module augmentation (TypeScript requires module reference)
import '@veloxts/core';

import { createMailManager, type MailManager } from './manager.js';
import type { MailPluginOptions } from './types.js';

/**
 * Symbol for storing mail manager on Fastify instance.
 * Using a symbol prevents naming conflicts with other plugins.
 */
const MAIL_MANAGER_KEY = Symbol.for('@veloxts/mail:manager');

/**
 * Extend Fastify types with mail manager.
 */
declare module 'fastify' {
  interface FastifyInstance {
    [MAIL_MANAGER_KEY]?: MailManager;
  }

  interface FastifyRequest {
    mail?: MailManager;
  }
}

// ============================================================================
// Context Declaration Merging
// ============================================================================

/**
 * Extend VeloxTS BaseContext with mail manager.
 *
 * This enables `ctx.mail` in procedure handlers with full type safety
 * and autocomplete when the mail plugin is registered.
 *
 * The property is NON-optional since the plugin guarantees it exists
 * after registration.
 */
declare module '@veloxts/core' {
  interface BaseContext {
    /** Mail manager for sending emails via templates */
    mail: MailManager;
  }
}

/**
 * Standalone mail instance for CLI commands and background jobs.
 * This is separate from the plugin to avoid test isolation issues.
 */
let standaloneMailInstance: MailManager | null = null;

/**
 * Create the mail plugin for VeloxTS.
 *
 * Each Fastify instance gets its own mail manager, ensuring proper test isolation
 * and supporting multiple Fastify instances in the same process.
 *
 * @param options - Mail plugin options
 * @returns Fastify plugin
 *
 * @example
 * ```typescript
 * import { createApp } from '@veloxts/core';
 * import { mailPlugin } from '@veloxts/mail';
 *
 * const app = createApp();
 *
 * app.use(mailPlugin({
 *   driver: 'resend',
 *   config: { apiKey: process.env.RESEND_API_KEY! },
 *   from: { email: 'hello@myapp.com', name: 'My App' },
 * }));
 *
 * // In procedures:
 * await ctx.mail.send(WelcomeEmail, {
 *   to: 'user@example.com',
 *   data: { user, activationUrl },
 * });
 * ```
 */
export function mailPlugin(options: MailPluginOptions = {}) {
  return fp(
    async (fastify: FastifyInstance) => {
      // Create a new mail manager for this Fastify instance
      const mailManager = await createMailManager(options);

      // Store on Fastify instance using symbol key (type-safe via Object.defineProperty)
      Object.defineProperty(fastify, MAIL_MANAGER_KEY, {
        value: mailManager,
        writable: false,
        enumerable: false,
        configurable: false,
      });

      // Decorate the request with mail manager
      fastify.decorateRequest('mail', undefined);

      // Add mail to request context
      fastify.addHook('onRequest', async (request: FastifyRequest) => {
        request.mail = mailManager;
      });

      // Close mail on server shutdown
      fastify.addHook('onClose', async () => {
        await mailManager.close();
      });
    },
    {
      name: '@veloxts/mail',
      fastify: '5.x',
    }
  );
}

/**
 * Get the mail manager from a Fastify instance.
 *
 * @param fastify - Fastify instance with mail plugin registered
 * @throws Error if mail plugin is not registered
 */
export function getMailFromInstance(fastify: FastifyInstance): MailManager {
  // Type-safe property access using Object.getOwnPropertyDescriptor
  const descriptor = Object.getOwnPropertyDescriptor(fastify, MAIL_MANAGER_KEY);
  const mail = descriptor?.value as MailManager | undefined;
  if (!mail) {
    throw new Error(
      'Mail not initialized on this Fastify instance. Make sure to register mailPlugin first.'
    );
  }
  return mail;
}

/**
 * Initialize mail manager standalone (without Fastify).
 *
 * Useful for CLI commands or background jobs. This creates a separate
 * mail instance that is independent from any Fastify instances.
 *
 * @example
 * ```typescript
 * import { initMail, closeMail } from '@veloxts/mail';
 *
 * const mail = await initMail({
 *   driver: 'resend',
 *   config: { apiKey: process.env.RESEND_API_KEY! },
 *   from: { email: 'hello@myapp.com', name: 'My App' },
 * });
 *
 * // Use mail directly
 * await mail.send(WelcomeEmail, { to: 'user@example.com', data: { ... } });
 *
 * // Clean up when done
 * await closeMail();
 * ```
 */
export async function initMail(options: MailPluginOptions = {}): Promise<MailManager> {
  if (!standaloneMailInstance) {
    standaloneMailInstance = await createMailManager(options);
  }
  return standaloneMailInstance;
}

/**
 * Get the standalone mail manager.
 *
 * @throws Error if mail is not initialized via initMail()
 */
export function getMail(): MailManager {
  if (!standaloneMailInstance) {
    throw new Error(
      'Standalone mail not initialized. Call initMail() first, or use getMailFromInstance() for Fastify-based usage.'
    );
  }
  return standaloneMailInstance;
}

/**
 * Close the standalone mail connection.
 */
export async function closeMail(): Promise<void> {
  if (standaloneMailInstance) {
    await standaloneMailInstance.close();
    standaloneMailInstance = null;
  }
}

/**
 * Reset standalone mail instance (for testing purposes).
 * @internal
 */
export function _resetStandaloneMail(): void {
  standaloneMailInstance = null;
}
