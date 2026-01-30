/**
 * Resend Transport Tests
 *
 * Unit tests for the Resend mail transport driver using mocked API.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createResendTransport } from '../transports/resend.js';

// Mock the resend module
const mockSend = vi.fn();

vi.mock('resend', () => {
  // Create a proper class mock
  return {
    Resend: class MockResend {
      emails = {
        send: mockSend,
      };
    },
  };
});

describe('createResendTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a transport with required config', async () => {
    const transport = await createResendTransport({
      apiKey: 'test-api-key',
    });

    expect(transport).toBeDefined();
    expect(typeof transport.send).toBe('function');
    expect(typeof transport.close).toBe('function');
  });

  describe('send', () => {
    it('should send a simple email successfully', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-123' },
        error: null,
      });

      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      const result = await transport.send({
        from: { email: 'sender@example.com', name: 'Sender' },
        to: [{ email: 'recipient@example.com' }],
        subject: 'Test Subject',
        html: '<h1>Hello World</h1>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockSend).toHaveBeenCalledWith({
        from: 'Sender <sender@example.com>',
        to: ['recipient@example.com'],
        cc: undefined,
        bcc: undefined,
        replyTo: undefined,
        subject: 'Test Subject',
        html: '<h1>Hello World</h1>',
        text: undefined,
        attachments: undefined,
        headers: undefined,
        tags: undefined,
      });
    });

    it('should send email with plain text', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-124' },
        error: null,
      });

      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      const result = await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'recipient@example.com' }],
        subject: 'Plain Text Email',
        text: 'Hello World',
      });

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Hello World',
        })
      );
    });

    it('should send to multiple recipients', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-125' },
        error: null,
      });

      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user1@example.com' }, { email: 'user2@example.com', name: 'User Two' }],
        subject: 'Multi-recipient',
        html: '<p>Hello</p>',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user1@example.com', 'User Two <user2@example.com>'],
        })
      );
    });

    it('should include CC and BCC recipients', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-126' },
        error: null,
      });

      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'main@example.com' }],
        cc: [{ email: 'cc@example.com' }],
        bcc: [{ email: 'bcc@example.com', name: 'Hidden' }],
        subject: 'CC/BCC Test',
        html: '<p>Test</p>',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: ['cc@example.com'],
          bcc: ['Hidden <bcc@example.com>'],
        })
      );
    });

    it('should include reply-to address', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-127' },
        error: null,
      });

      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      await transport.send({
        from: { email: 'no-reply@example.com' },
        to: [{ email: 'user@example.com' }],
        replyTo: { email: 'support@example.com', name: 'Support Team' },
        subject: 'Reply-To Test',
        html: '<p>Test</p>',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: 'Support Team <support@example.com>',
        })
      );
    });

    it('should include custom headers', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-128' },
        error: null,
      });

      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Headers Test',
        html: '<p>Test</p>',
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'X-Custom-Header': 'custom-value',
          },
        })
      );
    });

    it('should convert tags to Resend format', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-129' },
        error: null,
      });

      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Tags Test',
        html: '<p>Test</p>',
        tags: ['marketing', 'welcome'],
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [
            { name: 'marketing', value: 'true' },
            { name: 'welcome', value: 'true' },
          ],
        })
      );
    });

    it('should encode Buffer attachments to base64', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-130' },
        error: null,
      });

      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      const content = Buffer.from('Hello attachment!');

      await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Attachment Test',
        html: '<p>See attached</p>',
        attachments: [
          {
            filename: 'test.txt',
            content,
          },
        ],
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            {
              filename: 'test.txt',
              content: content.toString('base64'),
            },
          ],
        })
      );
    });

    it('should encode string attachments to base64', async () => {
      mockSend.mockResolvedValue({
        data: { id: 'msg-131' },
        error: null,
      });

      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'String Attachment Test',
        html: '<p>See attached</p>',
        attachments: [
          {
            filename: 'test.txt',
            content: 'String content' as unknown as Buffer,
          },
        ],
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            {
              filename: 'test.txt',
              content: Buffer.from('String content', 'utf-8').toString('base64'),
            },
          ],
        })
      );
    });

    it('should return error result when API returns error', async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: 'Invalid API key' },
      });

      const transport = await createResendTransport({
        apiKey: 'invalid-key',
      });

      const result = await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key');
      expect(result.messageId).toBeUndefined();
    });

    it('should handle thrown exceptions gracefully', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));

      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      const result = await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle non-Error exceptions', async () => {
      mockSend.mockRejectedValue('String error');

      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      const result = await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });

    it('should handle undefined messageId in response', async () => {
      mockSend.mockResolvedValue({
        data: { id: undefined },
        error: null,
      });

      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      const result = await transport.send({
        from: { email: 'sender@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeUndefined();
    });
  });

  describe('close', () => {
    it('should close without error', async () => {
      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      await expect(transport.close()).resolves.toBeUndefined();
    });

    it('should be callable multiple times', async () => {
      const transport = await createResendTransport({
        apiKey: 'test-api-key',
      });

      await transport.close();
      await expect(transport.close()).resolves.toBeUndefined();
    });
  });
});
