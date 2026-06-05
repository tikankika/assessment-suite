import { describe, it, expect } from 'vitest';
import { validatePath, validatePathOrThrow } from '../src/core/path_validator.js';

describe('validatePath', () => {
  it('returns valid for normal path', () => {
    const result = validatePath('/tmp/test/file.md');
    expect(result.valid).toBe(true);
    expect(result.resolvedPath).toBeDefined();
  });

  it('resolves relative paths to absolute', () => {
    const result = validatePath('./test/file.md');
    expect(result.valid).toBe(true);
    expect(result.resolvedPath).toMatch(/^\//);
  });

  it('resolves .. in paths', () => {
    const result = validatePath('/tmp/a/../b/file.md');
    expect(result.valid).toBe(true);
    // resolveSafely follows symlinks (e.g. macOS /tmp -> /private/tmp), so
    // assert the .. is collapsed and the path is absolute rather than pinning
    // the exact symlink form.
    expect(result.resolvedPath).toMatch(/^\/(private\/)?tmp\/b\/file\.md$/);
    expect(result.resolvedPath).not.toContain('..');
  });

  it('blocks /private/etc on macOS', () => {
    if (process.platform !== 'darwin') return;
    const result = validatePath('/private/etc/passwd');
    expect(result.valid).toBe(false);
  });

  it('blocks /System on macOS', () => {
    if (process.platform !== 'darwin') return;
    const result = validatePath('/System/Library/file');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('blocked');
  });

  it('blocks hidden home directories except .config', () => {
    const home = require('os').homedir();
    const sshResult = validatePath(`${home}/.ssh/id_rsa`);
    expect(sshResult.valid).toBe(false);
    expect(sshResult.error).toContain('.ssh');

    const configResult = validatePath(`${home}/.config/something`);
    expect(configResult.valid).toBe(true);
  });
});

describe('validatePathOrThrow', () => {
  it('returns resolved path for valid path', () => {
    const resolved = validatePathOrThrow('/tmp/test.md');
    // Symlink-resolved (macOS /tmp -> /private/tmp); assert shape, not exact form.
    expect(resolved).toMatch(/^\/(private\/)?tmp\/test\.md$/);
  });

  it('throws for blocked path', () => {
    if (process.platform !== 'darwin') return;
    expect(() => validatePathOrThrow('/System/Library/file')).toThrow();
  });

  it('throws for hidden home directories', () => {
    const home = require('os').homedir();
    expect(() => validatePathOrThrow(`${home}/.gnupg/key`)).toThrow();
  });
});
