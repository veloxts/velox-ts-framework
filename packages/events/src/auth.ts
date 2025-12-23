/**
 * Channel Authentication
 *
 * HMAC-SHA256 signing for secure channel authorization.
 * Prevents forgery of auth tokens for private/presence channels.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Channel authentication signature generator.
 * Uses HMAC-SHA256 for cryptographic security.
 */
export interface ChannelAuthSigner {
  /**
   * Generate a signed authentication token for a channel subscription.
   *
   * @param socketId - The unique socket identifier
   * @param channel - The channel name being subscribed to
   * @param channelData - Optional presence channel member data (JSON string)
   * @returns The HMAC signature (hex-encoded)
   */
  sign(socketId: string, channel: string, channelData?: string): string;

  /**
   * Verify a signature is valid for the given parameters.
   * Uses timing-safe comparison to prevent timing attacks.
   *
   * @param signature - The signature to verify
   * @param socketId - The socket ID
   * @param channel - The channel name
   * @param channelData - Optional presence channel data
   * @returns true if signature is valid
   */
  verify(signature: string, socketId: string, channel: string, channelData?: string): boolean;
}

/**
 * Minimum secret length for security.
 */
const MIN_SECRET_LENGTH = 16;

/**
 * Create a channel authentication signer with HMAC-SHA256.
 *
 * @param secret - The secret key (minimum 16 characters)
 * @returns A signer instance
 * @throws If secret is too short
 *
 * @example
 * ```typescript
 * const signer = createChannelAuthSigner(process.env.EVENTS_SECRET!);
 *
 * // Generate auth for private channel
 * const signature = signer.sign('socket123', 'private-user-42');
 *
 * // Verify auth token
 * const isValid = signer.verify(signature, 'socket123', 'private-user-42');
 * ```
 */
export function createChannelAuthSigner(secret: string): ChannelAuthSigner {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`Auth secret must be at least ${MIN_SECRET_LENGTH} characters for security`);
  }

  /**
   * Create the string to sign.
   * Format: socketId:channel or socketId:channel:channelData
   */
  function createStringToSign(socketId: string, channel: string, channelData?: string): string {
    const base = `${socketId}:${channel}`;
    return channelData ? `${base}:${channelData}` : base;
  }

  /**
   * Generate HMAC-SHA256 signature.
   */
  function generateSignature(stringToSign: string): string {
    return createHmac('sha256', secret).update(stringToSign, 'utf8').digest('hex');
  }

  return {
    sign(socketId: string, channel: string, channelData?: string): string {
      const stringToSign = createStringToSign(socketId, channel, channelData);
      return generateSignature(stringToSign);
    },

    verify(signature: string, socketId: string, channel: string, channelData?: string): boolean {
      const stringToSign = createStringToSign(socketId, channel, channelData);
      const expectedSignature = generateSignature(stringToSign);

      // Use timing-safe comparison to prevent timing attacks
      try {
        const signatureBuffer = Buffer.from(signature, 'hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');

        if (signatureBuffer.length !== expectedBuffer.length) {
          return false;
        }

        return timingSafeEqual(signatureBuffer, expectedBuffer);
      } catch {
        // Invalid hex string or other error
        return false;
      }
    },
  };
}
