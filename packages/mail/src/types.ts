/**
 * Mail Types
 *
 * Type definitions for VeloxTS mail system.
 */

import type { ReactElement } from 'react';
import type { z } from 'zod';

/**
 * Available mail transport drivers.
 */
export type MailDriver = 'smtp' | 'resend' | 'log';

/**
 * Email address with optional name.
 */
export interface EmailAddress {
  /**
   * Email address (e.g., 'user@example.com').
   */
  email: string;

  /**
   * Display name (e.g., 'John Doe').
   */
  name?: string;
}

/**
 * Email recipient - either string or EmailAddress object.
 */
export type Recipient = string | EmailAddress;

/**
 * Email attachment.
 */
export interface Attachment {
  /**
   * Filename to display.
   */
  filename: string;

  /**
   * File content as Buffer or string.
   */
  content: Buffer | string;

  /**
   * MIME type (e.g., 'application/pdf').
   */
  contentType?: string;

  /**
   * Content disposition (attachment or inline).
   * @default 'attachment'
   */
  disposition?: 'attachment' | 'inline';

  /**
   * Content ID for inline attachments.
   */
  cid?: string;
}

/**
 * Email envelope for sending.
 */
export interface MailEnvelope {
  /**
   * Recipient(s) - required.
   */
  to: Recipient | Recipient[];

  /**
   * Carbon copy recipient(s).
   */
  cc?: Recipient | Recipient[];

  /**
   * Blind carbon copy recipient(s).
   */
  bcc?: Recipient | Recipient[];

  /**
   * Reply-to address.
   */
  replyTo?: Recipient;

  /**
   * Email attachments.
   */
  attachments?: Attachment[];

  /**
   * Custom headers.
   */
  headers?: Record<string, string>;

  /**
   * Tags for categorization (supported by some providers).
   */
  tags?: string[];
}

/**
 * Mail definition configuration.
 */
export interface MailDefinitionConfig<TSchema extends z.ZodType> {
  /**
   * Unique mail template name (e.g., 'welcome', 'password-reset').
   */
  name: string;

  /**
   * Zod schema for template data validation.
   */
  schema: TSchema;

  /**
   * Email subject - can be static string or function of data.
   */
  subject: string | ((data: z.infer<TSchema>) => string);

  /**
   * React Email template component.
   */
  template: (props: z.infer<TSchema>) => ReactElement;

  /**
   * Optional plain text version generator.
   */
  text?: (data: z.infer<TSchema>) => string;

  /**
   * Default from address for this template.
   */
  from?: Recipient;
}

/**
 * Mail definition - type-safe email template.
 */
export interface MailDefinition<TSchema extends z.ZodType> {
  /**
   * Template name.
   */
  readonly name: string;

  /**
   * Zod schema for data validation.
   */
  readonly schema: TSchema;

  /**
   * Subject generator.
   */
  readonly subject: string | ((data: z.infer<TSchema>) => string);

  /**
   * React Email template.
   */
  readonly template: (props: z.infer<TSchema>) => ReactElement;

  /**
   * Plain text generator.
   */
  readonly text?: (data: z.infer<TSchema>) => string;

  /**
   * Default from address.
   */
  readonly from?: Recipient;
}

/**
 * Options for sending an email.
 */
export interface SendMailOptions<TSchema extends z.ZodType> extends MailEnvelope {
  /**
   * Template data.
   */
  data: z.infer<TSchema>;

  /**
   * Override from address.
   */
  from?: Recipient;
}

/**
 * Result of sending an email.
 */
export interface SendResult {
  /**
   * Whether the email was sent successfully.
   */
  success: boolean;

  /**
   * Message ID from the transport.
   */
  messageId?: string;

  /**
   * Error message if failed.
   */
  error?: string;
}

/**
 * SMTP transport configuration.
 */
export interface SmtpConfig {
  /**
   * SMTP host.
   */
  host: string;

  /**
   * SMTP port.
   * @default 587
   */
  port?: number;

  /**
   * Use implicit TLS/SSL (port 465).
   * Set to true for port 465, false for port 587 with STARTTLS.
   * @default false (uses STARTTLS on port 587)
   */
  secure?: boolean;

  /**
   * Require TLS connection. When true, the connection will fail if
   * STARTTLS upgrade is not possible. This prevents MITM downgrade attacks.
   * Recommended for production use with port 587.
   * @default true
   */
  requireTLS?: boolean;

  /**
   * Authentication credentials.
   */
  auth?: {
    user: string;
    pass: string;
  };

  /**
   * Connection timeout in milliseconds.
   * @default 5000
   */
  connectionTimeout?: number;

  /**
   * Socket timeout in milliseconds.
   * @default 5000
   */
  socketTimeout?: number;
}

/**
 * Resend transport configuration.
 */
export interface ResendConfig {
  /**
   * Resend API key.
   */
  apiKey: string;
}

/**
 * Log transport configuration (for development).
 */
export interface LogConfig {
  /**
   * Whether to output full HTML.
   * @default false
   */
  showHtml?: boolean;

  /**
   * Custom logger function.
   */
  logger?: (message: string) => void;
}

/**
 * Mail configuration by driver.
 */
export type MailConfig =
  | { driver: 'smtp'; config: SmtpConfig }
  | { driver: 'resend'; config: ResendConfig }
  | { driver: 'log'; config?: LogConfig };

/**
 * Mail plugin options.
 */
export interface MailPluginOptions {
  /**
   * Mail transport driver.
   * @default 'log'
   */
  driver?: MailDriver;

  /**
   * Driver-specific configuration.
   */
  config?: SmtpConfig | ResendConfig | LogConfig;

  /**
   * Default from address for all emails.
   */
  from?: Recipient;

  /**
   * Default reply-to address.
   */
  replyTo?: Recipient;
}

/**
 * Mail transport interface for driver implementations.
 */
export interface MailTransport {
  /**
   * Send an email.
   */
  send(options: {
    from: EmailAddress;
    to: EmailAddress[];
    cc?: EmailAddress[];
    bcc?: EmailAddress[];
    replyTo?: EmailAddress;
    subject: string;
    html: string;
    text?: string;
    attachments?: Attachment[];
    headers?: Record<string, string>;
    tags?: string[];
  }): Promise<SendResult>;

  /**
   * Close the transport connection.
   */
  close(): Promise<void>;
}

/**
 * Rendered email ready for sending.
 */
export interface RenderedMail {
  /**
   * From address.
   */
  from: EmailAddress;

  /**
   * To addresses.
   */
  to: EmailAddress[];

  /**
   * CC addresses.
   */
  cc?: EmailAddress[];

  /**
   * BCC addresses.
   */
  bcc?: EmailAddress[];

  /**
   * Reply-to address.
   */
  replyTo?: EmailAddress;

  /**
   * Email subject.
   */
  subject: string;

  /**
   * HTML body.
   */
  html: string;

  /**
   * Plain text body.
   */
  text?: string;

  /**
   * Attachments.
   */
  attachments?: Attachment[];

  /**
   * Custom headers.
   */
  headers?: Record<string, string>;

  /**
   * Tags.
   */
  tags?: string[];
}
