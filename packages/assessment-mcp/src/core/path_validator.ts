/**
 * path_validator.ts - Shared path validation for security
 *
 * Security: Validates file paths to prevent path traversal and
 * access to sensitive system files.
 *
 * @see packages/assessment-data-mcp/src/assessment_data_mcp/validators/path_validator.py
 */

import { resolve, dirname, basename, join } from 'path';
import { existsSync, realpathSync } from 'fs';
import { homedir, platform } from 'os';

/**
 * Resolve a path while following symlinks where possible.
 *
 * Walks up the path until it finds a component that exists, runs
 * realpath on that prefix (which follows symlinks), then re-appends
 * the non-existent tail. This catches a symlink inside the workspace
 * that points outside it — `path.resolve()` alone is purely syntactic
 * and would miss this.
 *
 * Falls back to syntactic resolve if realpath fails (broken symlink,
 * permission, etc.).
 */
function resolveSafely(p: string): string {
  const abs = resolve(p);
  let cur = abs;
  const tail: string[] = [];
  while (!existsSync(cur) && dirname(cur) !== cur) {
    tail.unshift(basename(cur));
    cur = dirname(cur);
  }
  if (existsSync(cur)) {
    try {
      cur = realpathSync(cur);
    } catch {
      // realpath can fail on broken symlinks or permission errors —
      // fall back to the syntactic resolution.
    }
  }
  return tail.length ? join(cur, ...tail) : cur;
}

export interface PathValidationResult {
  valid: boolean;
  error?: string;
  resolvedPath?: string;
}

/**
 * Assert that an identifier (e.g. student_id) is safe to interpolate into a
 * filesystem path.
 *
 * Workspace containment (RFC-035) is enforced on an allowlist of *path*
 * argument names. Identifiers like `student_id` are not on that list but are
 * interpolated into filenames by several tools; a value such as
 * `../../etc/evil` would escape the workspace. Reject (rather than silently
 * strip) any value containing a path separator, a `..` sequence, a NUL, or a
 * control/whitespace character. Mirrors the guard in the Python phase3 tools.
 *
 * @throws Error if the identifier is unsafe.
 */
export function assertSafeIdentifier(value: string, argName = 'identifier'): void {
  // eslint-disable-next-line no-control-regex
  const unsafeChar = /[\x00-\x1f\x7f\s]/;
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('..') ||
    unsafeChar.test(value)
  ) {
    throw new Error(`Invalid ${argName}: ${JSON.stringify(value)}`);
  }
}

/**
 * Blocked paths by platform
 */
const BLOCKED_PATHS: Record<string, string[]> = {
  darwin: ['/System', '/Library/Preferences', '/private/etc'],
  linux: ['/etc', '/var/log', '/usr', '/bin', '/sbin', '/root'],
  win32: ['C:\\Windows', 'C:\\Program Files'],
};

/**
 * Allowed hidden directories in home (config files we might need)
 */
const ALLOWED_HIDDEN_DIRS = ['.config'];

/**
 * Validate that a path is safe to access
 *
 * Checks:
 * 1. Path must be absolute after resolution
 * 2. Path must not be in system-blocked directories
 * 3. Path must not be hidden files in home directory (except allowed)
 *
 * @param filePath - Path to validate
 * @returns Validation result with resolved path or error message
 */
export function validatePath(filePath: string): PathValidationResult {
  // Resolve to absolute path, following symlinks where possible. resolveSafely
  // (not the syntactic resolve()) ensures a symlink inside an allowed dir that
  // points at a blocked system path is caught by the BLOCKED_PATHS check below.
  const resolvedPath = resolveSafely(filePath);

  // Get platform-specific blocked paths
  const currentPlatform = platform();
  const blockedPaths = BLOCKED_PATHS[currentPlatform] || BLOCKED_PATHS.linux;

  // Check blocked paths
  for (const blockedPath of blockedPaths) {
    if (resolvedPath.startsWith(blockedPath)) {
      return {
        valid: false,
        error: `Access to ${blockedPath} is blocked for security`,
      };
    }
  }

  // Check for hidden files in home directory
  const home = homedir();
  if (resolvedPath.startsWith(home)) {
    // Get relative path from home
    const relativePath = resolvedPath.slice(home.length + 1);
    const firstPart = relativePath.split('/')[0] || '';

    // Block hidden directories except allowed ones
    if (firstPart.startsWith('.') && !ALLOWED_HIDDEN_DIRS.includes(firstPart)) {
      return {
        valid: false,
        error: `Access to hidden home files (${firstPart}) is blocked for security`,
      };
    }
  }

  return {
    valid: true,
    resolvedPath,
  };
}

/**
 * Validate path and throw if invalid
 *
 * Convenience wrapper that throws instead of returning result
 *
 * @param filePath - Path to validate
 * @returns Resolved absolute path
 * @throws Error if path is invalid
 */
export function validatePathOrThrow(filePath: string): string {
  const result = validatePath(filePath);
  if (!result.valid) {
    throw new Error(result.error);
  }
  return result.resolvedPath!;
}

/**
 * Check if path is within an allowed base directory
 *
 * Use this for operations that should be restricted to a project directory.
 *
 * @param filePath - Path to check
 * @param allowedBase - Base directory that path must be within
 * @returns true if path is within allowed base
 */
export function isPathWithinBase(filePath: string, allowedBase: string): boolean {
  const resolvedPath = resolveSafely(filePath);
  const resolvedBase = resolveSafely(allowedBase);
  return resolvedPath.startsWith(resolvedBase + '/') || resolvedPath === resolvedBase;
}

/**
 * Optional context for workspace enforcement, used in violation log messages.
 */
export interface WorkspaceEnforcementContext {
  tool?: string;
  argName?: string;
}

/**
 * Enforce that a file path is within the workspace boundary (RFC-035).
 *
 * On violation, logs an audit entry to stderr (visible in
 * ~/Library/Logs/Claude/mcp-server-*.log) before throwing.
 *
 * @param filePath - Path to check
 * @param workspace - Workspace root directory
 * @param context - Optional tool / argName for the audit log
 * @throws Error if path is outside workspace
 */
export function enforceWorkspace(
  filePath: string,
  workspace: string,
  context?: WorkspaceEnforcementContext
): void {
  if (!isPathWithinBase(filePath, workspace)) {
    const requested = resolveSafely(filePath);
    const resolvedWorkspace = resolveSafely(workspace);
    const tool = context?.tool ?? 'unknown';
    const argName = context?.argName ?? 'unknown';
    console.error(
      `[WORKSPACE VIOLATION] tool=${tool} arg=${argName} requested=${requested} workspace=${resolvedWorkspace}`
    );
    throw new Error(
      `Access denied: ${requested} is outside workspace ${resolvedWorkspace}`
    );
  }
}
