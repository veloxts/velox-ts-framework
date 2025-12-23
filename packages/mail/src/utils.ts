/**
 * Mail Utilities
 *
 * Helper functions for mail operations.
 */

import type { EmailAddress, Recipient } from './types.js';

/**
 * Normalize a recipient to EmailAddress format.
 *
 * @param recipient - String email or EmailAddress object
 * @returns Normalized EmailAddress
 *
 * @example
 * ```typescript
 * normalizeRecipient('user@example.com')
 * // { email: 'user@example.com' }
 *
 * normalizeRecipient({ email: 'user@example.com', name: 'John' })
 * // { email: 'user@example.com', name: 'John' }
 *
 * normalizeRecipient('John Doe <john@example.com>')
 * // { email: 'john@example.com', name: 'John Doe' }
 * ```
 */
export function normalizeRecipient(recipient: Recipient): EmailAddress {
  if (typeof recipient === 'object') {
    return recipient;
  }

  // Parse "Name <email@example.com>" format
  const match = recipient.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1].trim(),
      email: match[2].trim(),
    };
  }

  return { email: recipient };
}

/**
 * Normalize multiple recipients.
 */
export function normalizeRecipients(recipients: Recipient | Recipient[]): EmailAddress[] {
  const recipientArray = Array.isArray(recipients) ? recipients : [recipients];
  return recipientArray.map(normalizeRecipient);
}

/**
 * Sanitize a string to prevent email header injection.
 * Removes newlines, carriage returns, and other control characters.
 *
 * @param value - String to sanitize
 * @returns Sanitized string safe for email headers
 */
export function sanitizeHeaderValue(value: string): string {
  // Remove newlines, carriage returns, tabs, and other control characters
  // that could be used for header injection attacks.
  // Uses character-by-character filtering to avoid regex lint warnings.
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    // Replace control characters (0x00-0x1f) and DEL (0x7f) with space
    if (code <= 0x1f || code === 0x7f) {
      result += ' ';
    } else {
      result += char;
    }
  }
  return result.trim();
}

/**
 * Format an EmailAddress to string.
 *
 * @param address - EmailAddress to format
 * @returns Formatted string (e.g., "John Doe <john@example.com>")
 */
export function formatAddress(address: EmailAddress): string {
  if (address.name) {
    // Sanitize name to prevent header injection attacks
    const sanitizedName = sanitizeHeaderValue(address.name);
    return `${sanitizedName} <${address.email}>`;
  }
  return address.email;
}

/**
 * Validate an email address format.
 *
 * Validates that:
 * - Local part contains valid characters (alphanumeric, dots, plus, hyphens, underscores)
 * - Domain contains valid characters (alphanumeric, dots, hyphens)
 * - TLD has at least 2 characters
 * - No consecutive dots
 * - Doesn't start or end with special characters
 *
 * @param email - Email address to validate
 * @returns True if valid
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // More robust email validation:
  // - Local part: letters, numbers, dots, plus, hyphens, underscores (no consecutive dots)
  // - @ symbol
  // - Domain: letters, numbers, dots, hyphens (no consecutive dots)
  // - TLD: at least 2 letters
  const emailRegex =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9._+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;

  // Additional check: no consecutive dots anywhere
  if (email.includes('..')) {
    return false;
  }

  return emailRegex.test(email);
}

/**
 * Validate a recipient.
 *
 * @param recipient - Recipient to validate
 * @throws Error if recipient is invalid
 */
export function validateRecipient(recipient: Recipient): void {
  const normalized = normalizeRecipient(recipient);

  if (!normalized.email) {
    throw new Error('Recipient email is required');
  }

  if (!isValidEmail(normalized.email)) {
    throw new Error(`Invalid email address: ${normalized.email}`);
  }
}

/**
 * Validate multiple recipients.
 *
 * @param recipients - Recipients to validate
 * @throws Error if any recipient is invalid
 */
export function validateRecipients(recipients: Recipient | Recipient[]): void {
  const recipientArray = Array.isArray(recipients) ? recipients : [recipients];

  if (recipientArray.length === 0) {
    throw new Error('At least one recipient is required');
  }

  for (const recipient of recipientArray) {
    validateRecipient(recipient);
  }
}

/**
 * Escape HTML entities for safe text output.
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * Strip HTML tags from string.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Decode &amp;
    .replace(/&lt;/g, '<') // Decode &lt;
    .replace(/&gt;/g, '>') // Decode &gt;
    .replace(/&quot;/g, '"') // Decode &quot;
    .replace(/&#39;/g, "'") // Decode &#39;
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Generate a unique message ID.
 */
export function generateMessageId(domain?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  const domainPart = domain ?? 'veloxts.local';
  return `<${timestamp}.${random}@${domainPart}>`;
}

/**
 * Validate mail template name format.
 * Template names should be kebab-case identifiers.
 */
export function validateTemplateName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new Error('Template name must be a non-empty string');
  }

  if (!/^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$/.test(name)) {
    throw new Error(
      `Invalid template name: ${name}. Use kebab-case format (e.g., 'welcome', 'password-reset')`
    );
  }
}
