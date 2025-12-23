/**
 * Log Transport Tests
 */

import { describe, expect, it, vi } from 'vitest';

import { createLogTransport } from '../transports/log.js';

describe('createLogTransport', () => {
  it('should create a log transport', () => {
    const transport = createLogTransport();
    expect(transport).toBeDefined();
    expect(typeof transport.send).toBe('function');
    expect(typeof transport.close).toBe('function');
  });

  it('should send and return success result', async () => {
    const logger = vi.fn();
    const transport = createLogTransport({ logger });

    const result = await transport.send({
      from: { email: 'from@example.com', name: 'Sender' },
      to: [{ email: 'to@example.com', name: 'Recipient' }],
      subject: 'Test Subject',
      html: '<h1>Hello World</h1>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(logger).toHaveBeenCalled();
  });

  it('should log email details', async () => {
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);
    const transport = createLogTransport({ logger });

    await transport.send({
      from: { email: 'from@example.com', name: 'Sender' },
      to: [{ email: 'to@example.com' }],
      subject: 'Test Subject',
      html: '<h1>Hello</h1>',
    });

    const logOutput = logs.join('\n');
    expect(logOutput).toContain('Sender <from@example.com>');
    expect(logOutput).toContain('to@example.com');
    expect(logOutput).toContain('Test Subject');
  });

  it('should log CC and BCC when present', async () => {
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);
    const transport = createLogTransport({ logger });

    await transport.send({
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      cc: [{ email: 'cc@example.com' }],
      bcc: [{ email: 'bcc@example.com' }],
      subject: 'Test',
      html: '<p>Test</p>',
    });

    const logOutput = logs.join('\n');
    expect(logOutput).toContain('CC:');
    expect(logOutput).toContain('cc@example.com');
    expect(logOutput).toContain('BCC:');
    expect(logOutput).toContain('bcc@example.com');
  });

  it('should log reply-to when present', async () => {
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);
    const transport = createLogTransport({ logger });

    await transport.send({
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      replyTo: { email: 'reply@example.com' },
      subject: 'Test',
      html: '<p>Test</p>',
    });

    const logOutput = logs.join('\n');
    expect(logOutput).toContain('Reply-To:');
    expect(logOutput).toContain('reply@example.com');
  });

  it('should log attachments when present', async () => {
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);
    const transport = createLogTransport({ logger });

    await transport.send({
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      subject: 'Test',
      html: '<p>Test</p>',
      attachments: [
        { filename: 'document.pdf', content: Buffer.from('test') },
        { filename: 'image.png', content: Buffer.from('test') },
      ],
    });

    const logOutput = logs.join('\n');
    expect(logOutput).toContain('Attachments:');
    expect(logOutput).toContain('document.pdf');
    expect(logOutput).toContain('image.png');
  });

  it('should log tags when present', async () => {
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);
    const transport = createLogTransport({ logger });

    await transport.send({
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      subject: 'Test',
      html: '<p>Test</p>',
      tags: ['marketing', 'welcome'],
    });

    const logOutput = logs.join('\n');
    expect(logOutput).toContain('Tags:');
    expect(logOutput).toContain('marketing');
    expect(logOutput).toContain('welcome');
  });

  it('should log plain text when present', async () => {
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);
    const transport = createLogTransport({ logger });

    await transport.send({
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      subject: 'Test',
      html: '<p>Hello HTML</p>',
      text: 'Hello Plain Text',
    });

    const logOutput = logs.join('\n');
    expect(logOutput).toContain('Plain Text:');
    expect(logOutput).toContain('Hello Plain Text');
  });

  it('should show HTML preview by default', async () => {
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);
    const transport = createLogTransport({ logger, showHtml: false });

    await transport.send({
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      subject: 'Test',
      html: '<h1>Full HTML Content</h1>',
    });

    const logOutput = logs.join('\n');
    expect(logOutput).toContain('HTML Preview:');
  });

  it('should show full HTML when showHtml is true', async () => {
    const logs: string[] = [];
    const logger = (msg: string) => logs.push(msg);
    const transport = createLogTransport({ logger, showHtml: true });

    await transport.send({
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      subject: 'Test',
      html: '<h1>Full HTML Content</h1>',
    });

    const logOutput = logs.join('\n');
    expect(logOutput).toContain('HTML:');
    expect(logOutput).toContain('<h1>Full HTML Content</h1>');
  });

  it('should close without error', async () => {
    const transport = createLogTransport();
    await expect(transport.close()).resolves.not.toThrow();
  });

  it('should generate unique message IDs', async () => {
    const transport = createLogTransport({ logger: () => {} });

    const result1 = await transport.send({
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      subject: 'Test 1',
      html: '<p>Test</p>',
    });

    const result2 = await transport.send({
      from: { email: 'from@example.com' },
      to: [{ email: 'to@example.com' }],
      subject: 'Test 2',
      html: '<p>Test</p>',
    });

    expect(result1.messageId).not.toBe(result2.messageId);
  });
});
