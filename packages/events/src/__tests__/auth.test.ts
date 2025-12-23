/**
 * Auth Tests
 *
 * Tests for HMAC-SHA256 channel authentication signing.
 */

import { describe, expect, it } from 'vitest';

import { createChannelAuthSigner } from '../auth.js';

describe('createChannelAuthSigner', () => {
  const validSecret = 'this-is-a-valid-secret-key-123';

  describe('creation', () => {
    it('should create signer with valid secret', () => {
      const signer = createChannelAuthSigner(validSecret);
      expect(signer).toBeDefined();
      expect(typeof signer.sign).toBe('function');
      expect(typeof signer.verify).toBe('function');
    });

    it('should throw with secret shorter than 16 characters', () => {
      expect(() => createChannelAuthSigner('short')).toThrow(
        'Auth secret must be at least 16 characters'
      );
    });

    it('should accept secret exactly 16 characters', () => {
      const signer = createChannelAuthSigner('1234567890123456');
      expect(signer).toBeDefined();
    });
  });

  describe('sign()', () => {
    it('should generate a hex signature', () => {
      const signer = createChannelAuthSigner(validSecret);
      const signature = signer.sign('socket123', 'private-channel');

      expect(signature).toMatch(/^[a-f0-9]{64}$/); // SHA-256 = 64 hex chars
    });

    it('should generate deterministic signatures', () => {
      const signer = createChannelAuthSigner(validSecret);
      const sig1 = signer.sign('socket123', 'private-channel');
      const sig2 = signer.sign('socket123', 'private-channel');

      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different sockets', () => {
      const signer = createChannelAuthSigner(validSecret);
      const sig1 = signer.sign('socket1', 'private-channel');
      const sig2 = signer.sign('socket2', 'private-channel');

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different channels', () => {
      const signer = createChannelAuthSigner(validSecret);
      const sig1 = signer.sign('socket123', 'private-channel1');
      const sig2 = signer.sign('socket123', 'private-channel2');

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures with different secrets', () => {
      const signer1 = createChannelAuthSigner(validSecret);
      const signer2 = createChannelAuthSigner('another-valid-secret-456');
      const sig1 = signer1.sign('socket123', 'private-channel');
      const sig2 = signer2.sign('socket123', 'private-channel');

      expect(sig1).not.toBe(sig2);
    });

    it('should include channelData in signature when provided', () => {
      const signer = createChannelAuthSigner(validSecret);
      const sigWithoutData = signer.sign('socket123', 'presence-channel');
      const sigWithData = signer.sign('socket123', 'presence-channel', '{"id":"user1"}');

      expect(sigWithoutData).not.toBe(sigWithData);
    });
  });

  describe('verify()', () => {
    it('should verify valid signature', () => {
      const signer = createChannelAuthSigner(validSecret);
      const signature = signer.sign('socket123', 'private-channel');

      expect(signer.verify(signature, 'socket123', 'private-channel')).toBe(true);
    });

    it('should reject invalid signature', () => {
      const signer = createChannelAuthSigner(validSecret);

      expect(signer.verify('invalid', 'socket123', 'private-channel')).toBe(false);
    });

    it('should reject signature for wrong socket', () => {
      const signer = createChannelAuthSigner(validSecret);
      const signature = signer.sign('socket123', 'private-channel');

      expect(signer.verify(signature, 'socket456', 'private-channel')).toBe(false);
    });

    it('should reject signature for wrong channel', () => {
      const signer = createChannelAuthSigner(validSecret);
      const signature = signer.sign('socket123', 'private-channel');

      expect(signer.verify(signature, 'socket123', 'private-other')).toBe(false);
    });

    it('should reject signature from different secret', () => {
      const signer1 = createChannelAuthSigner(validSecret);
      const signer2 = createChannelAuthSigner('another-valid-secret-456');
      const signature = signer1.sign('socket123', 'private-channel');

      expect(signer2.verify(signature, 'socket123', 'private-channel')).toBe(false);
    });

    it('should verify signature with channelData', () => {
      const signer = createChannelAuthSigner(validSecret);
      const channelData = '{"id":"user1","info":{"name":"John"}}';
      const signature = signer.sign('socket123', 'presence-channel', channelData);

      expect(signer.verify(signature, 'socket123', 'presence-channel', channelData)).toBe(true);
    });

    it('should reject signature when channelData differs', () => {
      const signer = createChannelAuthSigner(validSecret);
      const signature = signer.sign('socket123', 'presence-channel', '{"id":"user1"}');

      expect(signer.verify(signature, 'socket123', 'presence-channel', '{"id":"user2"}')).toBe(
        false
      );
    });

    it('should reject non-hex strings gracefully', () => {
      const signer = createChannelAuthSigner(validSecret);

      expect(signer.verify('not-a-hex-string!@#$', 'socket123', 'private-channel')).toBe(false);
    });

    it('should reject empty signature', () => {
      const signer = createChannelAuthSigner(validSecret);

      expect(signer.verify('', 'socket123', 'private-channel')).toBe(false);
    });

    it('should reject signature of wrong length', () => {
      const signer = createChannelAuthSigner(validSecret);

      expect(signer.verify('abcd1234', 'socket123', 'private-channel')).toBe(false);
    });
  });
});
