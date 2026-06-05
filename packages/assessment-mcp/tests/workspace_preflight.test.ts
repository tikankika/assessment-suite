/**
 * Tests for workspace pre-flight validation (RFC-035 §9).
 *
 * Pre-flight runs at server startup, after --workspace is parsed but
 * before the server connects. It refuses obviously dangerous workspace
 * values (system roots, home directory, non-existent paths, files) and
 * warns on broad home subdirectories like ~/Documents.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, chmodSync } from 'fs';
import { tmpdir, homedir } from 'os';
import { join } from 'path';
import { validateWorkspaceArg } from '../src/core/workspace_preflight.js';

describe('validateWorkspaceArg (RFC-035 pre-flight)', () => {
  describe('refuses dangerous absolute paths', () => {
    it('refuses root /', () => {
      const result = validateWorkspaceArg('/');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/too broad|system/i);
    });

    it.each(['/Users', '/home', '/var', '/tmp', '/etc'])(
      'refuses %s',
      (path) => {
        const result = validateWorkspaceArg(path);
        expect(result.ok).toBe(false);
      }
    );

    it('refuses home directory exactly', () => {
      const result = validateWorkspaceArg(homedir());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/home directory/i);
    });
  });

  describe('refuses invalid paths', () => {
    it('refuses non-existent path', () => {
      const result = validateWorkspaceArg('/tmp/preflight-nonexistent-xyz-789-zzz');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/does not exist|not found/i);
    });

    it('refuses a regular file (not a directory)', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'preflight-'));
      const file = join(tmp, 'somefile.txt');
      writeFileSync(file, 'x');
      try {
        const result = validateWorkspaceArg(file);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/not a directory/i);
      } finally {
        rmSync(tmp, { recursive: true });
      }
    });
  });

  describe('accepts valid workspaces', () => {
    it('accepts a fresh tmp dir without warning', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'preflight-'));
      try {
        const result = validateWorkspaceArg(tmp);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.warning).toBeUndefined();
      } finally {
        rmSync(tmp, { recursive: true });
      }
    });

    it('accepts a path with trailing slash', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'preflight-'));
      try {
        const result = validateWorkspaceArg(tmp + '/');
        expect(result.ok).toBe(true);
      } finally {
        rmSync(tmp, { recursive: true });
      }
    });

    it('accepts a deep subdirectory of the home directory', () => {
      // Create a nested temp dir that happens to be inside the user's home
      // Use mkdtempSync rooted under home if possible; otherwise skip
      const home = homedir();
      const docs = join(home, 'Documents');
      if (!existsSync(docs)) return; // CI environments without ~/Documents
      const nested = mkdtempSync(join(docs, 'preflight-deep-'));
      try {
        const result = validateWorkspaceArg(nested);
        expect(result.ok).toBe(true);
        // No warning — it's a dedicated subfolder, not the broad ~/Documents itself
        if (result.ok) expect(result.warning).toBeUndefined();
      } finally {
        rmSync(nested, { recursive: true });
      }
    });
  });

  describe('warns on broad home top-level directories', () => {
    it('warns when workspace is exactly ~/Documents (if it exists)', () => {
      const docs = join(homedir(), 'Documents');
      if (!existsSync(docs)) return;
      const result = validateWorkspaceArg(docs);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.warning).toBeDefined();
        expect(result.warning).toMatch(/broad|top-level/i);
      }
    });
  });
});
