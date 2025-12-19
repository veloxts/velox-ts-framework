/**
 * HTML Utility Functions
 *
 * Provides security-focused utilities for HTML content handling,
 * including XSS prevention through proper escaping.
 *
 * @module @veloxts/web/utils/html
 */

/**
 * HTML entities escape map.
 *
 * Maps characters that have special meaning in HTML to their
 * corresponding HTML entity encodings. Using hex entities for
 * consistency with OWASP recommendations.
 */
const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
} as const;

/**
 * Pre-compiled regex for HTML escape characters.
 * Matches any character that needs to be escaped in HTML context.
 */
const HTML_ESCAPE_REGEX = /[&<>"']/g;

/**
 * Escapes HTML special characters to prevent XSS attacks.
 *
 * This function escapes the five characters that have special meaning
 * in HTML contexts:
 * - `&` becomes `&amp;`
 * - `<` becomes `&lt;`
 * - `>` becomes `&gt;`
 * - `"` becomes `&quot;`
 * - `'` becomes `&#x27;`
 *
 * Use this function when inserting user-provided content into HTML
 * to prevent script injection attacks.
 *
 * @param str - The string to escape
 * @returns The escaped string safe for HTML insertion
 *
 * @example
 * ```typescript
 * import { escapeHtml } from '@veloxts/web/utils/html';
 *
 * const userInput = '<script>alert("xss")</script>';
 * const safe = escapeHtml(userInput);
 * // Result: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 * ```
 *
 * @example
 * ```typescript
 * // In an error page template
 * const html = `<pre>${escapeHtml(error.stack)}</pre>`;
 * ```
 */
export function escapeHtml(str: string): string {
  return str.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] ?? char);
}
