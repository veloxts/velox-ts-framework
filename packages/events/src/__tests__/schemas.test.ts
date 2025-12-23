/**
 * Schemas Tests
 *
 * Tests for Zod validation schemas and helpers.
 */

import { describe, expect, it } from 'vitest';

import {
  ClientMessageSchema,
  formatValidationErrors,
  PresenceMemberSchema,
  SseSubscribeBodySchema,
  SseUnsubscribeBodySchema,
  validateBody,
  WsAuthBodySchema,
} from '../schemas.js';

describe('PresenceMemberSchema', () => {
  it('should accept valid member', () => {
    const result = PresenceMemberSchema.safeParse({ id: 'user123' });
    expect(result.success).toBe(true);
  });

  it('should accept member with info', () => {
    const result = PresenceMemberSchema.safeParse({
      id: 'user123',
      info: { name: 'John', avatar: '/avatars/john.png' },
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty id', () => {
    const result = PresenceMemberSchema.safeParse({ id: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing id', () => {
    const result = PresenceMemberSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('SseSubscribeBodySchema', () => {
  it('should accept valid subscribe request', () => {
    const result = SseSubscribeBodySchema.safeParse({
      connectionId: 'conn123',
      channel: 'public-channel',
    });
    expect(result.success).toBe(true);
  });

  it('should accept subscribe with member', () => {
    const result = SseSubscribeBodySchema.safeParse({
      connectionId: 'conn123',
      channel: 'presence-room',
      member: { id: 'user1', info: { name: 'John' } },
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing connectionId', () => {
    const result = SseSubscribeBodySchema.safeParse({ channel: 'public-channel' });
    expect(result.success).toBe(false);
  });

  it('should reject missing channel', () => {
    const result = SseSubscribeBodySchema.safeParse({ connectionId: 'conn123' });
    expect(result.success).toBe(false);
  });

  it('should reject empty strings', () => {
    const result = SseSubscribeBodySchema.safeParse({ connectionId: '', channel: '' });
    expect(result.success).toBe(false);
  });
});

describe('SseUnsubscribeBodySchema', () => {
  it('should accept valid unsubscribe request', () => {
    const result = SseUnsubscribeBodySchema.safeParse({
      connectionId: 'conn123',
      channel: 'public-channel',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing fields', () => {
    expect(SseUnsubscribeBodySchema.safeParse({}).success).toBe(false);
    expect(SseUnsubscribeBodySchema.safeParse({ connectionId: 'conn123' }).success).toBe(false);
    expect(SseUnsubscribeBodySchema.safeParse({ channel: 'channel' }).success).toBe(false);
  });
});

describe('WsAuthBodySchema', () => {
  it('should accept valid auth request', () => {
    const result = WsAuthBodySchema.safeParse({
      socketId: 'socket123',
      channel: 'private-channel',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing socketId', () => {
    const result = WsAuthBodySchema.safeParse({ channel: 'private-channel' });
    expect(result.success).toBe(false);
  });

  it('should reject missing channel', () => {
    const result = WsAuthBodySchema.safeParse({ socketId: 'socket123' });
    expect(result.success).toBe(false);
  });

  it('should reject empty strings', () => {
    const result = WsAuthBodySchema.safeParse({ socketId: '', channel: '' });
    expect(result.success).toBe(false);
  });
});

describe('ClientMessageSchema', () => {
  describe('subscribe message', () => {
    it('should accept basic subscribe', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'subscribe',
        channel: 'public-channel',
      });
      expect(result.success).toBe(true);
    });

    it('should accept subscribe with auth', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'subscribe',
        channel: 'private-channel',
        auth: 'socket123:signature',
      });
      expect(result.success).toBe(true);
    });

    it('should accept subscribe with member data', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'subscribe',
        channel: 'presence-room',
        data: { id: 'user1', info: { name: 'John' } },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('unsubscribe message', () => {
    it('should accept unsubscribe', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'unsubscribe',
        channel: 'public-channel',
      });
      expect(result.success).toBe(true);
    });

    it('should reject unsubscribe without channel', () => {
      const result = ClientMessageSchema.safeParse({ type: 'unsubscribe' });
      expect(result.success).toBe(false);
    });
  });

  describe('ping message', () => {
    it('should accept ping', () => {
      const result = ClientMessageSchema.safeParse({ type: 'ping' });
      expect(result.success).toBe(true);
    });
  });

  describe('message message', () => {
    it('should accept message', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'message',
        channel: 'presence-room',
        event: 'typing',
        data: { userId: 'user1' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject message without channel', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'message',
        event: 'typing',
      });
      expect(result.success).toBe(false);
    });

    it('should reject message without event', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'message',
        channel: 'presence-room',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('invalid messages', () => {
    it('should reject unknown type', () => {
      const result = ClientMessageSchema.safeParse({ type: 'unknown' });
      expect(result.success).toBe(false);
    });

    it('should reject missing type', () => {
      const result = ClientMessageSchema.safeParse({ channel: 'test' });
      expect(result.success).toBe(false);
    });
  });
});

describe('validateBody()', () => {
  it('should return success with data for valid input', () => {
    const result = validateBody({ socketId: 'socket1', channel: 'channel1' }, WsAuthBodySchema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.socketId).toBe('socket1');
      expect(result.data.channel).toBe('channel1');
    }
  });

  it('should return failure with errors for invalid input', () => {
    const result = validateBody({}, WsAuthBodySchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('should return correct error paths', () => {
    const result = validateBody({ socketId: '' }, WsAuthBodySchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.errors.map((e) => e.path.join('.'));
      expect(paths).toContain('socketId');
      expect(paths).toContain('channel');
    }
  });
});

describe('formatValidationErrors()', () => {
  it('should format errors with path and message', () => {
    const result = WsAuthBodySchema.safeParse({});
    if (!result.success) {
      const formatted = formatValidationErrors(result.error.issues);

      expect(formatted.error).toBe('Validation failed');
      expect(formatted.details.length).toBeGreaterThan(0);
      expect(formatted.details[0]).toHaveProperty('path');
      expect(formatted.details[0]).toHaveProperty('message');
    }
  });

  it('should join nested paths with dots', () => {
    const result = SseSubscribeBodySchema.safeParse({
      connectionId: 'conn1',
      channel: 'presence-room',
      member: { id: '' }, // Invalid - empty id
    });

    if (!result.success) {
      const formatted = formatValidationErrors(result.error.issues);
      const memberError = formatted.details.find((d) => d.path.includes('member'));

      expect(memberError).toBeDefined();
      expect(memberError?.path).toContain('member');
    }
  });
});
