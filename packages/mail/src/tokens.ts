/**
 * DI Tokens for @veloxts/mail
 *
 * Symbol-based tokens for type-safe dependency injection.
 * These tokens allow mail services to be registered, resolved, and mocked via the DI container.
 *
 * @module mail/tokens
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { MAIL_MANAGER, registerMailProviders } from '@veloxts/mail';
 *
 * const container = new Container();
 * await registerMailProviders(container, { driver: 'log' });
 *
 * const mail = container.resolve(MAIL_MANAGER);
 * await mail.send(WelcomeEmail, { to: 'user@example.com', data: {...} });
 * ```
 */

import { token } from '@veloxts/core';

import type { MailManager } from './manager.js';
import type { MailPluginOptions, MailTransport } from './types.js';

// ============================================================================
// Core Mail Tokens
// ============================================================================

/**
 * Mail manager token
 *
 * The main mail manager instance for sending and rendering emails.
 *
 * @example
 * ```typescript
 * const mail = container.resolve(MAIL_MANAGER);
 * await mail.send(WelcomeEmail, { to: 'user@example.com', data: {...} });
 * const rendered = await mail.render(WelcomeEmail, { to: 'user@example.com', data: {...} });
 * ```
 */
export const MAIL_MANAGER = token.symbol<MailManager>('MAIL_MANAGER');

/**
 * Mail transport token
 *
 * The underlying mail transport driver (SMTP, Resend, or Log).
 * Use MAIL_MANAGER for high-level operations; use this for direct transport access.
 *
 * @example
 * ```typescript
 * const transport = container.resolve(MAIL_TRANSPORT);
 * await transport.send({ from: {...}, to: [...], subject: '...', html: '...' });
 * ```
 */
export const MAIL_TRANSPORT = token.symbol<MailTransport>('MAIL_TRANSPORT');

// ============================================================================
// Configuration Tokens
// ============================================================================

/**
 * Mail configuration token
 *
 * Contains mail plugin options including driver and driver-specific config.
 *
 * @example
 * ```typescript
 * const config = container.resolve(MAIL_CONFIG);
 * console.log(config.driver); // 'smtp', 'resend', or 'log'
 * ```
 */
export const MAIL_CONFIG = token.symbol<MailPluginOptions>('MAIL_CONFIG');
