/**
 * workspace_preflight.ts — Validate the --workspace argument at server startup.
 *
 * Refuses obviously dangerous workspace values (system roots, home directory
 * exactly, non-existent paths, files instead of directories, non-writable
 * paths). Warns on broad home top-level directories like ~/Documents,
 * ~/Desktop, ~/Nextcloud — these are still allowed but reduce the value
 * of workspace lockdown.
 *
 * @see RFC-035 §9 (added 2026-05-03 as part of share-readiness work).
 */

import { resolve, sep } from 'path';
import { existsSync, statSync, accessSync, constants, realpathSync } from 'fs';
import { homedir } from 'os';

export type WorkspaceValidationResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

const REFUSED_ABSOLUTE_PATHS = [
  '/',
  '/Users',
  '/home',
  '/var',
  '/tmp',
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/root',
  // macOS aliases for parity with the Python implementation, where
  // Path.resolve() follows symlinks (/tmp → /private/tmp).
  '/private',
  '/private/tmp',
  '/private/var',
  '/private/etc',
];

const WARN_HOME_TOP_LEVEL = [
  'Documents',
  'Desktop',
  'Downloads',
  'Nextcloud',
  'iCloud Drive',
];

export function validateWorkspaceArg(workspace: string): WorkspaceValidationResult {
  // Follow symlinks (parity with the Python preflight's Path.resolve), so a
  // symlinked --workspace pointing at a refused root is still caught.
  let resolved = resolve(workspace);
  if (existsSync(resolved)) {
    try {
      resolved = realpathSync(resolved);
    } catch {
      // Broken symlink / permission — keep the syntactic resolution.
    }
  }

  if (REFUSED_ABSOLUTE_PATHS.includes(resolved)) {
    return {
      ok: false,
      error: `Workspace path is too broad or system-critical: ${resolved}. Choose a dedicated subfolder.`,
    };
  }

  const home = resolve(homedir());
  if (resolved === home) {
    return {
      ok: false,
      error: `Workspace path is your home directory (${home}). Choose a dedicated subfolder, e.g. ${home}/assessment_workspace.`,
    };
  }

  if (!existsSync(resolved)) {
    return {
      ok: false,
      error: `Workspace path does not exist: ${resolved}. Create it first: mkdir -p ${resolved}`,
    };
  }

  const stat = statSync(resolved);
  if (!stat.isDirectory()) {
    return {
      ok: false,
      error: `Workspace path is not a directory: ${resolved}.`,
    };
  }

  try {
    accessSync(resolved, constants.W_OK);
  } catch {
    return {
      ok: false,
      error: `Workspace path is not writable: ${resolved}.`,
    };
  }

  if (resolved.startsWith(home + sep)) {
    const relative = resolved.slice(home.length + 1);
    if (!relative.includes(sep) && WARN_HOME_TOP_LEVEL.includes(relative)) {
      return {
        ok: true,
        warning: `Workspace is a broad top-level home directory (${resolved}). Consider a dedicated subfolder for tighter isolation.`,
      };
    }
  }

  return { ok: true };
}
