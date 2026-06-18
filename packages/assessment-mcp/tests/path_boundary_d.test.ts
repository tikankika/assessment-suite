import { describe, it, expect } from 'vitest';
import { platform, tmpdir, homedir } from 'os';
import { sep, join } from 'path';
import { mkdtempSync, symlinkSync, rmSync } from 'fs';
import { validatePath } from '../src/core/path_validator.js';
import { validateWorkspaceArg } from '../src/core/workspace_preflight.js';

// Pick a system directory that is blocked on the running platform.
const BLOCKED =
  platform() === 'win32' ? 'C:\\Windows' : platform() === 'darwin' ? '/System' : '/etc';

describe('blocked-path boundary uses a separator, not a bare prefix (finding D)', () => {
  it('blocks the system directory itself', () => {
    expect(validatePath(BLOCKED).valid).toBe(false);
  });

  it('blocks children of the system directory', () => {
    expect(validatePath(BLOCKED + sep + 'x').valid).toBe(false);
  });

  it('does NOT block a sibling that merely shares the string prefix', () => {
    // e.g. "/Systemfoo" must not be caught by "/System"
    expect(validatePath(BLOCKED + 'foo').valid).toBe(true);
  });
});

describe('workspace preflight follows symlinks (finding D)', () => {
  it('refuses a symlinked --workspace that resolves to a refused root', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wsln-'));
    const link = join(dir, 'link');
    symlinkSync(homedir(), link); // link → home, which is refused as the exact home dir
    try {
      expect(validateWorkspaceArg(link).ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
