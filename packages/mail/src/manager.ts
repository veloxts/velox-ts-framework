/**
 * Mail Manager
 *
 * High-level mail API for rendering and sending emails.
 */

import { render } from '@react-email/render';
import type { z } from 'zod';

import type { MailDefinition } from './mail.js';
import { createLogTransport } from './transports/log.js';
import { createResendTransport } from './transports/resend.js';
import { createSmtpTransport } from './transports/smtp.js';
import type {
  LogConfig,
  MailPluginOptions,
  MailTransport,
  RenderedMail,
  ResendConfig,
  SendMailOptions,
  SendResult,
  SmtpConfig,
} from './types.js';
import { normalizeRecipient, normalizeRecipients, stripHtml, validateRecipients } from './utils.js';

/**
 * Mail manager interface.
 */
/**
 * Options for bulk email sending.
 */
export interface SendBulkOptions {
  /**
   * Maximum number of concurrent email sends.
   * Higher values = faster but more memory/CPU.
   * @default 10
   */
  concurrency?: number;
}

export interface MailManager {
  /**
   * Send an email using a mail definition.
   */
  send<TSchema extends z.ZodType>(
    mail: MailDefinition<TSchema>,
    options: SendMailOptions<TSchema>
  ): Promise<SendResult>;

  /**
   * Send an email to multiple recipients with different data.
   * Uses parallel execution with configurable concurrency control.
   */
  sendBulk<TSchema extends z.ZodType>(
    mail: MailDefinition<TSchema>,
    messages: Array<SendMailOptions<TSchema>>,
    options?: SendBulkOptions
  ): Promise<SendResult[]>;

  /**
   * Render an email without sending (for preview/testing).
   */
  render<TSchema extends z.ZodType>(
    mail: MailDefinition<TSchema>,
    options: SendMailOptions<TSchema>
  ): Promise<RenderedMail>;

  /**
   * Close the transport connection.
   */
  close(): Promise<void>;
}

/**
 * Create a mail manager.
 *
 * @param options - Mail plugin options
 * @returns Mail manager instance
 *
 * @example
 * ```typescript
 * // Development (log to console)
 * const mail = await createMailManager({ driver: 'log' });
 *
 * // Production (SMTP)
 * const mail = await createMailManager({
 *   driver: 'smtp',
 *   config: {
 *     host: 'smtp.example.com',
 *     port: 587,
 *     auth: { user: '...', pass: '...' },
 *   },
 *   from: { email: 'hello@example.com', name: 'My App' },
 * });
 *
 * // Production (Resend)
 * const mail = await createMailManager({
 *   driver: 'resend',
 *   config: { apiKey: process.env.RESEND_API_KEY! },
 *   from: { email: 'hello@example.com', name: 'My App' },
 * });
 *
 * // Send email
 * await mail.send(WelcomeEmail, {
 *   to: 'user@example.com',
 *   data: { user: { name: 'John' }, activationUrl: 'https://...' },
 * });
 * ```
 */
export async function createMailManager(options: MailPluginOptions = {}): Promise<MailManager> {
  const driver = options.driver ?? 'log';
  const defaultFrom = options.from ? normalizeRecipient(options.from) : undefined;
  const defaultReplyTo = options.replyTo ? normalizeRecipient(options.replyTo) : undefined;

  let transport: MailTransport;

  // Create the appropriate transport
  switch (driver) {
    case 'smtp':
      transport = await createSmtpTransport(options.config as SmtpConfig);
      break;
    case 'resend':
      transport = await createResendTransport(options.config as ResendConfig);
      break;
    default:
      transport = createLogTransport(options.config as LogConfig);
      break;
  }

  /**
   * Render a mail template to HTML.
   */
  async function renderMail<TSchema extends z.ZodType>(
    mail: MailDefinition<TSchema>,
    sendOptions: SendMailOptions<TSchema>
  ): Promise<RenderedMail> {
    // Validate data against schema
    const validatedData = mail.schema.parse(sendOptions.data);

    // Validate recipients
    validateRecipients(sendOptions.to);

    // Determine from address
    const from = sendOptions.from
      ? normalizeRecipient(sendOptions.from)
      : mail.from
        ? normalizeRecipient(mail.from)
        : defaultFrom;

    if (!from) {
      throw new Error(
        'From address is required. Provide it in send options, mail definition, or plugin config.'
      );
    }

    // Normalize recipients
    const to = normalizeRecipients(sendOptions.to);
    const cc = sendOptions.cc ? normalizeRecipients(sendOptions.cc) : undefined;
    const bcc = sendOptions.bcc ? normalizeRecipients(sendOptions.bcc) : undefined;
    const replyTo = sendOptions.replyTo ? normalizeRecipient(sendOptions.replyTo) : defaultReplyTo;

    // Generate subject
    const subject = typeof mail.subject === 'function' ? mail.subject(validatedData) : mail.subject;

    // Render React Email template to HTML
    const html = await render(mail.template(validatedData));

    // Generate plain text (from custom function or by stripping HTML)
    const text = mail.text ? mail.text(validatedData) : stripHtml(html);

    return {
      from,
      to,
      cc,
      bcc,
      replyTo,
      subject,
      html,
      text,
      attachments: sendOptions.attachments,
      headers: sendOptions.headers,
      tags: sendOptions.tags,
    };
  }

  const manager: MailManager = {
    async send<TSchema extends z.ZodType>(
      mail: MailDefinition<TSchema>,
      sendOptions: SendMailOptions<TSchema>
    ): Promise<SendResult> {
      const rendered = await renderMail(mail, sendOptions);

      return transport.send({
        from: rendered.from,
        to: rendered.to,
        cc: rendered.cc,
        bcc: rendered.bcc,
        replyTo: rendered.replyTo,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        attachments: rendered.attachments,
        headers: rendered.headers,
        tags: rendered.tags,
      });
    },

    async sendBulk<TSchema extends z.ZodType>(
      mail: MailDefinition<TSchema>,
      messages: Array<SendMailOptions<TSchema>>,
      bulkOptions?: SendBulkOptions
    ): Promise<SendResult[]> {
      if (messages.length === 0) {
        return [];
      }

      // Use concurrency control to avoid overwhelming the transport
      const concurrency = bulkOptions?.concurrency ?? 10;

      // Process in batches for controlled parallelism
      const results: SendResult[] = new Array(messages.length);

      for (let i = 0; i < messages.length; i += concurrency) {
        const batch = messages.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map((message) => manager.send(mail, message)));

        // Place results at correct indices to maintain order
        for (let j = 0; j < batchResults.length; j++) {
          results[i + j] = batchResults[j];
        }
      }

      return results;
    },

    async render<TSchema extends z.ZodType>(
      mail: MailDefinition<TSchema>,
      sendOptions: SendMailOptions<TSchema>
    ): Promise<RenderedMail> {
      return renderMail(mail, sendOptions);
    },

    async close(): Promise<void> {
      await transport.close();
    },
  };

  return manager;
}

/**
 * Alias for createMailManager.
 */
export const mailer = createMailManager;
