/**
 * SMTP Transport Driver
 *
 * Email transport using Nodemailer for SMTP servers.
 */

import type { Transporter } from 'nodemailer';

import type { Attachment, EmailAddress, MailTransport, SendResult, SmtpConfig } from '../types.js';
import { formatAddress, generateMessageId } from '../utils.js';

/**
 * Default SMTP configuration.
 */
const DEFAULT_CONFIG: Required<Omit<SmtpConfig, 'host' | 'auth'>> = {
  port: 587,
  secure: false,
  requireTLS: true, // Require TLS by default to prevent MITM downgrade attacks
  connectionTimeout: 5000,
  socketTimeout: 5000,
};

/**
 * Create an SMTP mail transport.
 *
 * @param config - SMTP configuration
 * @returns Mail transport implementation
 *
 * @example
 * ```typescript
 * const transport = await createSmtpTransport({
 *   host: 'smtp.gmail.com',
 *   port: 587,
 *   auth: {
 *     user: 'user@gmail.com',
 *     pass: 'app-password',
 *   },
 * });
 *
 * await transport.send({
 *   from: { email: 'from@example.com', name: 'App' },
 *   to: [{ email: 'user@example.com' }],
 *   subject: 'Hello',
 *   html: '<h1>Hello World</h1>',
 * });
 * ```
 */
export async function createSmtpTransport(config: SmtpConfig): Promise<MailTransport> {
  const options = { ...DEFAULT_CONFIG, ...config };

  // Dynamic import of nodemailer
  const nodemailer = await import('nodemailer');

  // Create transporter
  const transporter: Transporter = nodemailer.createTransport({
    host: config.host,
    port: options.port,
    secure: options.secure,
    requireTLS: options.requireTLS, // Fail if TLS upgrade not possible
    auth: config.auth,
    connectionTimeout: options.connectionTimeout,
    socketTimeout: options.socketTimeout,
  });

  /**
   * Convert EmailAddress array to nodemailer format.
   */
  function formatAddresses(addresses: EmailAddress[]): string {
    return addresses.map(formatAddress).join(', ');
  }

  /**
   * Convert attachments to nodemailer format.
   */
  function formatAttachments(attachments?: Attachment[]): Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
    contentDisposition?: 'attachment' | 'inline';
    cid?: string;
  }> {
    if (!attachments) return [];

    return attachments.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
      contentDisposition: att.disposition,
      cid: att.cid,
    }));
  }

  const transport: MailTransport = {
    async send(sendOptions): Promise<SendResult> {
      try {
        const messageId = generateMessageId();

        const mailOptions = {
          messageId,
          from: formatAddress(sendOptions.from),
          to: formatAddresses(sendOptions.to),
          cc: sendOptions.cc ? formatAddresses(sendOptions.cc) : undefined,
          bcc: sendOptions.bcc ? formatAddresses(sendOptions.bcc) : undefined,
          replyTo: sendOptions.replyTo ? formatAddress(sendOptions.replyTo) : undefined,
          subject: sendOptions.subject,
          html: sendOptions.html,
          text: sendOptions.text,
          attachments: formatAttachments(sendOptions.attachments),
          headers: sendOptions.headers,
        };

        const result = await transporter.sendMail(mailOptions);

        return {
          success: true,
          messageId: result.messageId,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },

    async close(): Promise<void> {
      transporter.close();
    },
  };

  return transport;
}

/**
 * SMTP transport driver name.
 */
export const DRIVER_NAME = 'smtp' as const;
