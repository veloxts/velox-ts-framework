/**
 * @veloxts/mail
 *
 * Email templating and sending for VeloxTS framework.
 *
 * Features:
 * - React Email integration for type-safe templates
 * - Multiple transport drivers: SMTP, Resend, Log (development)
 * - Type-safe template props with Zod schemas
 * - Automatic plain text generation from HTML
 * - Fastify plugin for request context integration
 * - Bulk email sending
 * - Email preview/rendering without sending
 *
 * @example
 * ```typescript
 * import { mailPlugin, defineMail } from '@veloxts/mail';
 * import { Html, Head, Body, Container, Heading, Text, Button } from '@react-email/components';
 * import { z } from 'zod';
 *
 * // Define a mail template
 * export const WelcomeEmail = defineMail({
 *   name: 'welcome',
 *   schema: z.object({
 *     user: z.object({ name: z.string() }),
 *     activationUrl: z.string().url(),
 *   }),
 *   subject: ({ user }) => `Welcome, ${user.name}!`,
 *   template: ({ user, activationUrl }) => (
 *     <Html>
 *       <Head />
 *       <Body>
 *         <Container>
 *           <Heading>Welcome, {user.name}!</Heading>
 *           <Text>Click below to activate your account:</Text>
 *           <Button href={activationUrl}>Activate</Button>
 *         </Container>
 *       </Body>
 *     </Html>
 *   ),
 * });
 *
 * // Register plugin
 * app.use(mailPlugin({
 *   driver: 'resend',
 *   config: { apiKey: process.env.RESEND_API_KEY },
 *   from: { email: 'hello@myapp.com', name: 'My App' },
 * }));
 *
 * // Send email in procedures
 * await ctx.mail.send(WelcomeEmail, {
 *   to: 'user@example.com',
 *   data: { user: { name: 'John' }, activationUrl: 'https://...' },
 * });
 * ```
 *
 * @packageDocumentation
 */

// Mail definition
export { defineMail, type MailDefinition, mail } from './mail.js';
// Manager
export { createMailManager, type MailManager, mailer, type SendBulkOptions } from './manager.js';
// Plugin
export {
  closeMail,
  getMail,
  getMailFromInstance,
  initMail,
  mailPlugin,
} from './plugin.js';
// Transports
export { createLogTransport, DRIVER_NAME as LOG_DRIVER } from './transports/log.js';
export { createResendTransport, DRIVER_NAME as RESEND_DRIVER } from './transports/resend.js';
export { createSmtpTransport, DRIVER_NAME as SMTP_DRIVER } from './transports/smtp.js';
// Types
export type {
  Attachment,
  EmailAddress,
  LogConfig,
  MailConfig,
  MailDefinitionConfig,
  MailDriver,
  MailEnvelope,
  MailPluginOptions,
  MailTransport,
  Recipient,
  RenderedMail,
  ResendConfig,
  SendMailOptions,
  SendResult,
  SmtpConfig,
} from './types.js';
/**
 * Utility functions for email processing.
 *
 * @deprecated Import from '@veloxts/mail/utils' instead. Will be removed in v2.0.
 *
 * @example
 * ```typescript
 * // Old (deprecated):
 * import { formatAddress, isValidEmail } from '@veloxts/mail';
 *
 * // New:
 * import { formatAddress, isValidEmail } from '@veloxts/mail/utils';
 * ```
 */
export {
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
} from './utils.js';
