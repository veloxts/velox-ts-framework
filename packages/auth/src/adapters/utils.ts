/**
 * Shared utilities for auth adapters
 *
 * @module auth/adapters/utils
 * @internal
 */

// ============================================================================
// Token Extraction
// ============================================================================

/**
 * Extract Bearer token from Authorization header
 *
 * @param headerValue - Authorization header value
 * @returns Token string or null if not a Bearer token
 *
 * @example
 * ```typescript
 * const token = extractBearerToken('Bearer eyJhbGci...');
 * // Returns: 'eyJhbGci...'
 *
 * const invalid = extractBearerToken('Basic abc123');
 * // Returns: null
 * ```
 */
export function extractBearerToken(headerValue: string): string | null {
  const parts = headerValue.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }
  // Trim whitespace from token to handle malformed headers
  return parts[1].trim();
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that a string value is non-empty
 *
 * @param value - Value to check
 * @param fieldName - Field name for error message
 * @returns The trimmed value if valid
 * @throws Error if value is empty or whitespace-only
 */
export function validateNonEmptyString(value: string | undefined, fieldName: string): string {
  if (!value || value.trim() === '') {
    throw new Error(`${fieldName} is required and cannot be empty`);
  }
  return value.trim();
}
