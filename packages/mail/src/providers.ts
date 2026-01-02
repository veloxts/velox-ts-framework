/**
 * DI Providers for @veloxts/mail
 *
 * Factory provider functions for registering mail services with the DI container.
 * These providers allow services to be managed by the container for testability and flexibility.
 *
 * @module mail/providers
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerMailProviders, MAIL_MANAGER } from '@veloxts/mail';
 *
 * const container = new Container();
 * await registerMailProviders(container, { driver: 'log' });
 *
 * const mail = container.resolve(MAIL_MANAGER);
 * await mail.send(WelcomeEmail, { to: 'user@example.com', data: {...} });
 * ```
 */

import type { Container } from '@veloxts/core';

import { createMailManager } from './manager.js';
import { MAIL_CONFIG, MAIL_MANAGER } from './tokens.js';
import type { MailPluginOptions } from './types.js';

// ============================================================================
// Bulk Registration Helpers
// ============================================================================

/**
 * Registers mail providers with a container
 *
 * This handles async initialization of the mail manager and registers
 * the resolved instance directly for synchronous resolution.
 *
 * @param container - The DI container to register providers with
 * @param config - Mail plugin options (driver, from, etc.)
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerMailProviders, MAIL_MANAGER } from '@veloxts/mail';
 *
 * const container = new Container();
 *
 * // Log driver (development)
 * await registerMailProviders(container, { driver: 'log' });
 *
 * // SMTP driver (production)
 * await registerMailProviders(container, {
 *   driver: 'smtp',
 *   config: {
 *     host: 'smtp.example.com',
 *     port: 587,
 *     auth: { user: '...', pass: '...' },
 *   },
 *   from: { email: 'hello@example.com', name: 'My App' },
 * });
 *
 * // Resend driver (production)
 * await registerMailProviders(container, {
 *   driver: 'resend',
 *   config: { apiKey: process.env.RESEND_API_KEY! },
 *   from: { email: 'hello@example.com', name: 'My App' },
 * });
 *
 * const mail = container.resolve(MAIL_MANAGER);
 * await mail.send(WelcomeEmail, { to: 'user@example.com', data: {...} });
 * ```
 */
export async function registerMailProviders(
  container: Container,
  config: MailPluginOptions = {}
): Promise<void> {
  // Register config
  container.register({
    provide: MAIL_CONFIG,
    useValue: config,
  });

  // Create mail manager (async operation)
  const mailManager = await createMailManager(config);

  // Register the resolved mail manager instance directly
  // This allows synchronous resolution from the container
  container.register({
    provide: MAIL_MANAGER,
    useValue: mailManager,
  });
}
