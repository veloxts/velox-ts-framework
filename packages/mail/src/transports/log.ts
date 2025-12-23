/**
 * Log Transport Driver
 *
 * Development transport that logs emails to console instead of sending.
 */

import type { LogConfig, MailTransport, SendResult } from '../types.js';
import { formatAddress, generateMessageId } from '../utils.js';

/**
 * Default log transport configuration.
 */
const DEFAULT_CONFIG: Required<LogConfig> = {
  showHtml: false,
  logger: console.log,
};

/**
 * Create a log mail transport for development.
 *
 * @param config - Log configuration
 * @returns Mail transport implementation
 *
 * @example
 * ```typescript
 * const transport = createLogTransport({
 *   showHtml: true,  // Show full HTML in logs
 * });
 *
 * await transport.send({
 *   from: { email: 'from@example.com', name: 'App' },
 *   to: [{ email: 'user@example.com' }],
 *   subject: 'Hello',
 *   html: '<h1>Hello World</h1>',
 * });
 * // Logs email details to console
 * ```
 */
export function createLogTransport(config: LogConfig = {}): MailTransport {
  const options = { ...DEFAULT_CONFIG, ...config };
  const log = options.logger;

  const transport: MailTransport = {
    async send(sendOptions): Promise<SendResult> {
      const messageId = generateMessageId();

      const separator = '─'.repeat(60);

      log(`\n${separator}`);
      log('📧 EMAIL SENT (log transport)');
      log(separator);
      log(`Message ID: ${messageId}`);
      log(`From:       ${formatAddress(sendOptions.from)}`);
      log(`To:         ${sendOptions.to.map(formatAddress).join(', ')}`);

      if (sendOptions.cc?.length) {
        log(`CC:         ${sendOptions.cc.map(formatAddress).join(', ')}`);
      }

      if (sendOptions.bcc?.length) {
        log(`BCC:        ${sendOptions.bcc.map(formatAddress).join(', ')}`);
      }

      if (sendOptions.replyTo) {
        log(`Reply-To:   ${formatAddress(sendOptions.replyTo)}`);
      }

      log(`Subject:    ${sendOptions.subject}`);

      if (sendOptions.attachments?.length) {
        log(`Attachments: ${sendOptions.attachments.map((a) => a.filename).join(', ')}`);
      }

      if (sendOptions.tags?.length) {
        log(`Tags:       ${sendOptions.tags.join(', ')}`);
      }

      if (sendOptions.headers && Object.keys(sendOptions.headers).length > 0) {
        log('Headers:');
        for (const [key, value] of Object.entries(sendOptions.headers)) {
          log(`  ${key}: ${value}`);
        }
      }

      log(separator);

      if (sendOptions.text) {
        log('Plain Text:');
        log(sendOptions.text);
        log(separator);
      }

      if (options.showHtml) {
        log('HTML:');
        log(sendOptions.html);
        log(separator);
      } else {
        const htmlPreview = sendOptions.html.substring(0, 200);
        log(`HTML Preview: ${htmlPreview}${sendOptions.html.length > 200 ? '...' : ''}`);
        log(separator);
      }

      log('');

      return {
        success: true,
        messageId,
      };
    },

    async close(): Promise<void> {
      // Nothing to close
    },
  };

  return transport;
}

/**
 * Log transport driver name.
 */
export const DRIVER_NAME = 'log' as const;
