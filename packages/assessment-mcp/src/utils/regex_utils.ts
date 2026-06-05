/**
 * Regex Utilities
 *
 * RFC-029 §18.3 P8: Shared regex escaping to prevent broken patterns
 * when interpolating user-provided strings into RegExp constructors.
 */

/**
 * Escape special regex characters in a string for safe interpolation
 * into `new RegExp(...)` template literals.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
