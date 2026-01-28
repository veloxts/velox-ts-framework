/**
 * SMTP Transport Integration Tests
 *
 * Tests the SMTP transport against a real MailHog instance
 * using testcontainers. MailHog captures all emails for inspection.
 */

import {
  isDockerAvailable,
  type MailhogContainerResult,
  startMailhogContainer,
} from '@veloxts/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createSmtpTransport } from '../transports/smtp.js';
import type { MailTransport } from '../types.js';

// MailHog API response types
interface MailhogMessage {
  ID: string;
  From: { Mailbox: string; Domain: string };
  To: Array<{ Mailbox: string; Domain: string }>;
  Content: {
    Headers: {
      Subject: string[];
      From: string[];
      To: string[];
      'Content-Type': string[];
      [key: string]: string[];
    };
    Body: string;
  };
  MIME: {
    Parts?: Array<{
      Headers: { [key: string]: string[] };
      Body: string;
    }>;
  };
  Created: string;
}

interface MailhogResponse {
  total: number;
  count: number;
  start: number;
  items: MailhogMessage[];
}

// Check Docker availability at module load time
const dockerAvailable = await isDockerAvailable();

// Skip in CI environments (image pulls are slow) or if Docker is not available
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const describeIntegration = dockerAvailable && !isCI ? describe : describe.skip;

describeIntegration('SMTP transport (integration)', () => {
  let mailhog: MailhogContainerResult;
  let transport: MailTransport;

  beforeAll(async () => {
    // Start MailHog container
    mailhog = await startMailhogContainer();
  }, 60000); // 60s timeout for container startup

  afterAll(async () => {
    // Clean up with try/catch to prevent test hangs on cleanup failures
    try {
      if (transport) await transport.close();
    } catch {
      /* ignore cleanup errors */
    }
    try {
      if (mailhog) await mailhog.stop();
    } catch {
      /* ignore cleanup errors */
    }
  });

  beforeEach(async () => {
    // Create fresh transport for each test
    if (transport) {
      await transport.close();
    }

    // MailHog doesn't require auth and TLS
    transport = await createSmtpTransport({
      host: mailhog.smtpHost,
      port: mailhog.smtpPort,
      secure: false,
      requireTLS: false, // MailHog doesn't support TLS
    });

    // Clear all messages from MailHog
    await fetch(`${mailhog.apiUrl}/api/v1/messages`, { method: 'DELETE' });
  });

  /**
   * Helper to get messages from MailHog
   */
  async function getMessages(): Promise<MailhogMessage[]> {
    const response = await fetch(`${mailhog.apiUrl}/api/v2/messages`);
    const data = (await response.json()) as MailhogResponse;
    return data.items;
  }

  /**
   * Helper to wait for message to appear (with retries)
   */
  async function waitForMessage(timeout = 5000): Promise<MailhogMessage> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const messages = await getMessages();
      if (messages.length > 0) {
        return messages[0];
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Timeout waiting for message');
  }

  // ==========================================================================
  // Basic Email Sending
  // ==========================================================================

  describe('send', () => {
    it('should send a simple email', async () => {
      const result = await transport.send({
        from: { email: 'sender@example.com', name: 'Sender' },
        to: [{ email: 'recipient@example.com' }],
        subject: 'Test Email',
        text: 'Hello, World!',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeTruthy();

      // Verify via MailHog API
      const message = await waitForMessage();

      expect(message.Content.Headers.Subject[0]).toBe('Test Email');
      expect(message.Content.Headers.From[0]).toContain('sender@example.com');
      expect(message.Content.Headers.To[0]).toContain('recipient@example.com');
    });

    it('should send email with HTML content', async () => {
      const result = await transport.send({
        from: { email: 'html@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'HTML Email',
        html: '<h1>Hello</h1><p>This is <strong>HTML</strong> content.</p>',
      });

      expect(result.success).toBe(true);

      const message = await waitForMessage();
      expect(message.Content.Headers['Content-Type'][0]).toContain('text/html');
    });

    it('should send email with both HTML and text', async () => {
      const result = await transport.send({
        from: { email: 'multi@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Multipart Email',
        html: '<p>HTML version</p>',
        text: 'Text version',
      });

      expect(result.success).toBe(true);

      const message = await waitForMessage();
      // Should be multipart
      expect(message.Content.Headers['Content-Type'][0]).toContain('multipart/alternative');
    });

    it('should send to multiple recipients', async () => {
      const result = await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user1@example.com' }, { email: 'user2@example.com', name: 'User Two' }],
        subject: 'Multi-recipient',
        text: 'Hello everyone!',
      });

      expect(result.success).toBe(true);

      const message = await waitForMessage();
      expect(message.Content.Headers.To[0]).toContain('user1@example.com');
      expect(message.Content.Headers.To[0]).toContain('user2@example.com');
    });

    it('should support CC and BCC', async () => {
      const result = await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'main@example.com' }],
        cc: [{ email: 'cc@example.com' }],
        bcc: [{ email: 'bcc@example.com' }],
        subject: 'CC/BCC Test',
        text: 'Testing CC and BCC',
      });

      expect(result.success).toBe(true);

      const message = await waitForMessage();
      expect(message.Content.Headers.Cc?.[0]).toContain('cc@example.com');
      // BCC should not be in headers (that's the point of BCC)
    });

    it('should support reply-to', async () => {
      const result = await transport.send({
        from: { email: 'no-reply@example.com' },
        to: [{ email: 'user@example.com' }],
        replyTo: { email: 'support@example.com', name: 'Support Team' },
        subject: 'Reply-To Test',
        text: 'Please reply to support',
      });

      expect(result.success).toBe(true);

      const message = await waitForMessage();
      expect(message.Content.Headers['Reply-To']?.[0]).toContain('support@example.com');
    });

    it('should include sender name correctly', async () => {
      const result = await transport.send({
        from: { email: 'sender@example.com', name: 'Test Sender Name' },
        to: [{ email: 'user@example.com' }],
        subject: 'Sender Name Test',
        text: 'Check the sender name',
      });

      expect(result.success).toBe(true);

      const message = await waitForMessage();
      expect(message.Content.Headers.From[0]).toContain('Test Sender Name');
    });
  });

  // ==========================================================================
  // Attachments
  // ==========================================================================

  describe('attachments', () => {
    it('should send email with text attachment', async () => {
      const result = await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Attachment Test',
        text: 'See attached file',
        attachments: [
          {
            filename: 'test.txt',
            content: Buffer.from('Hello from attachment!'),
            contentType: 'text/plain',
          },
        ],
      });

      expect(result.success).toBe(true);

      const message = await waitForMessage();
      expect(message.Content.Headers['Content-Type'][0]).toContain('multipart');

      // Check MIME parts for attachment
      const parts = message.MIME?.Parts ?? [];
      const attachmentPart = parts.find((p) =>
        p.Headers['Content-Disposition']?.[0]?.includes('attachment')
      );
      expect(attachmentPart).toBeDefined();
    });

    it('should send email with multiple attachments', async () => {
      const result = await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Multiple Attachments',
        text: 'Multiple files attached',
        attachments: [
          {
            filename: 'file1.txt',
            content: Buffer.from('First file'),
            contentType: 'text/plain',
          },
          {
            filename: 'file2.json',
            content: Buffer.from('{"key":"value"}'),
            contentType: 'application/json',
          },
        ],
      });

      expect(result.success).toBe(true);

      const message = await waitForMessage();
      const parts = message.MIME?.Parts ?? [];
      const attachments = parts.filter((p) =>
        p.Headers['Content-Disposition']?.[0]?.includes('attachment')
      );
      expect(attachments.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // Custom Headers
  // ==========================================================================

  describe('custom headers', () => {
    it('should include custom headers', async () => {
      const result = await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Custom Headers Test',
        text: 'Check headers',
        headers: {
          'X-Custom-Header': 'custom-value',
          'X-Priority': '1',
        },
      });

      expect(result.success).toBe(true);

      const message = await waitForMessage();
      expect(message.Content.Headers['X-Custom-Header']?.[0]).toBe('custom-value');
      expect(message.Content.Headers['X-Priority']?.[0]).toBe('1');
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling', () => {
    it('should handle invalid SMTP server gracefully', async () => {
      const badTransport = await createSmtpTransport({
        host: 'invalid.host.that.does.not.exist',
        port: 25,
        secure: false,
        requireTLS: false,
        connectionTimeout: 1000,
        socketTimeout: 1000,
      });

      try {
        const result = await badTransport.send({
          from: { email: 'sender@example.com' },
          to: [{ email: 'user@example.com' }],
          subject: 'Test',
          text: 'Should fail',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
      } finally {
        await badTransport.close();
      }
    });
  });

  // ==========================================================================
  // Transport Lifecycle
  // ==========================================================================

  describe('lifecycle', () => {
    it('should close transport without error', async () => {
      const tempTransport = await createSmtpTransport({
        host: mailhog.smtpHost,
        port: mailhog.smtpPort,
        secure: false,
        requireTLS: false,
      });

      // Send one message
      await tempTransport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Before Close',
        text: 'Message before closing',
      });

      // Close should not throw
      await expect(tempTransport.close()).resolves.toBeUndefined();
    });

    it('should send multiple emails in sequence', async () => {
      for (let i = 0; i < 3; i++) {
        const result = await transport.send({
          from: { email: 'sender@example.com' },
          to: [{ email: 'user@example.com' }],
          subject: `Sequential Email ${i + 1}`,
          text: `This is email number ${i + 1}`,
        });

        expect(result.success).toBe(true);
      }

      // Wait a bit for all messages to arrive
      await new Promise((r) => setTimeout(r, 500));

      const messages = await getMessages();
      expect(messages.length).toBe(3);
    });
  });
});
