/**
 * debug.ts - Debug logging configuration
 *
 * Controls verbose logging that may contain sensitive data (student IDs, paths).
 * Enable with: DEBUG=1 or DEBUG=true environment variable
 *
 * Security: By default, sensitive data is NOT logged.
 */

/**
 * Check if debug mode is enabled via environment variable
 */
export function isDebugEnabled(): boolean {
  const debug = process.env.DEBUG;
  return debug === '1' || debug === 'true' || debug === 'assessment-mcp';
}

/**
 * Log message only if debug mode is enabled
 *
 * Use this for logs that contain sensitive data:
 * - Student IDs
 * - File paths
 * - Assessment scores
 *
 * @param prefix - Log prefix (e.g., '[AssessmentWriter]')
 * @param args - Arguments to log
 */
export function debugLog(prefix: string, ...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.error(prefix, ...args);
  }
}

/**
 * Always log (for errors and important events that don't contain sensitive data)
 *
 * @param prefix - Log prefix
 * @param args - Arguments to log
 */
export function alwaysLog(prefix: string, ...args: unknown[]): void {
  console.error(prefix, ...args);
}
