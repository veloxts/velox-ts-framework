/**
 * Resend Transport Driver
 *
 * Email transport using Resend API.
 */

import type { EmailAddress, MailTransport, ResendConfig, SendResult } from '../types.js';
import { formatAddress } from '../utils.js';

/**
 * Create a Resend mail transport.
 *
 * @param config - Resend configuration
 * @returns Mail transport implementation
 *
 * @example
 * ```typescript
 * const transport = await createResendTransport({
 *   apiKey: process.env.RESEND_API_KEY!,
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
export async function createResendTransport(config: ResendConfig): Promise<MailTransport> {
  // Dynamic import of resend
  const { Resend } = await import('resend');

  const resend = new Resend(config.apiKey);

  /**
   * Format addresses for Resend API.
   */
  function formatAddresses(addresses: EmailAddress[]): string[] {
    return addresses.map(formatAddress);
  }

  /**
   * Convert attachment content to base64 for Resend API.
   * Buffer is converted directly, string content is assumed to be raw and encoded.
   */
  function encodeAttachmentContent(content: Buffer | string): string {
    if (Buffer.isBuffer(content)) {
      return content.toString('base64');
    }
    // String content is assumed to be raw - encode to base64
    return Buffer.from(content, 'utf-8').toString('base64');
  }

  const transport: MailTransport = {
    async send(sendOptions): Promise<SendResult> {
      try {
        const result = await resend.emails.send({
          from: formatAddress(sendOptions.from),
          to: formatAddresses(sendOptions.to),
          cc: sendOptions.cc ? formatAddresses(sendOptions.cc) : undefined,
          bcc: sendOptions.bcc ? formatAddresses(sendOptions.bcc) : undefined,
          replyTo: sendOptions.replyTo ? formatAddress(sendOptions.replyTo) : undefined,
          subject: sendOptions.subject,
          html: sendOptions.html,
          text: sendOptions.text,
          attachments: sendOptions.attachments?.map((att) => ({
            filename: att.filename,
            content: encodeAttachmentContent(att.content),
          })),
          headers: sendOptions.headers,
          tags: sendOptions.tags?.map((tag) => ({ name: tag, value: 'true' })),
        });

        if (result.error) {
          return {
            success: false,
            error: result.error.message,
          };
        }

        return {
          success: true,
          messageId: result.data?.id,
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
      // Resend client doesn't need explicit closing
    },
  };

  return transport;
}

/**
 * Resend transport driver name.
 */
export const DRIVER_NAME = 'resend' as const;
