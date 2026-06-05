/**
 * Security test — validatePath must follow symlinks before its blocked-path
 * check, so a symlink inside an allowed dir cannot smuggle access to a blocked
 * system path.
 *
 * validatePath() resolved with the syntactic resolve() (no symlink following),
 * so a symlink `<tmp>/sneaky -> /private/etc` resolved to the symlink's own
 * literal path and slipped past the BLOCKED_PATHS check. resolveSafely()
 * (already used by isPathWithinBase/enforceWorkspace) follows symlinks and
 * closes this gap.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, symlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { validatePath } from '../src/core/path_validator.js';

describe('validatePath — symlink escape to blocked path', () => {
  it('blocks a symlink that points into a blocked system directory', () => {
    // Only meaningful on macOS where /private/etc is in BLOCKED_PATHS and exists.
    if (process.platform !== 'darwin') return;
    if (!existsSync('/private/etc')) return;

    const dir = mkdtempSync(join(tmpdir(), 'pv-symlink-'));
    try {
      const sneaky = join(dir, 'sneaky');
      // symlink inside an allowed temp dir pointing at a blocked system dir
      symlinkSync('/private/etc', sneaky);

      const result = validatePath(join(sneaky, 'passwd'));

      // Must be rejected: following the symlink lands in /private/etc (blocked).
      expect(result.valid).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('still allows a normal non-symlinked path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pv-ok-'));
    try {
      const result = validatePath(join(dir, 'project', 'file.md'));
      expect(result.valid).toBe(true);
      expect(result.resolvedPath).toBeDefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
