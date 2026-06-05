import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { isPathWithinBase, enforceWorkspace } from '../src/core/path_validator.js';

describe('isPathWithinBase', () => {
  it('allows path within base', () => {
    expect(isPathWithinBase('/workspace/project_A/exam.yaml', '/workspace')).toBe(true);
  });

  it('allows path equal to base', () => {
    expect(isPathWithinBase('/workspace', '/workspace')).toBe(true);
  });

  it('rejects path outside base', () => {
    expect(isPathWithinBase('/home/user/Documents/secret.txt', '/workspace')).toBe(false);
  });

  it('rejects path traversal', () => {
    expect(isPathWithinBase('/workspace/../etc/passwd', '/workspace')).toBe(false);
  });

  it('rejects sibling with prefix overlap', () => {
    // /workspace-backup should NOT match /workspace
    expect(isPathWithinBase('/workspace-backup/file.txt', '/workspace')).toBe(false);
  });
});

describe('enforceWorkspace (RFC-035)', () => {
  const workspace = '/tmp/test_workspace';

  it('allows path within workspace', () => {
    expect(() => enforceWorkspace('/tmp/test_workspace/project/file.md', workspace)).not.toThrow();
  });

  it('allows workspace root itself', () => {
    expect(() => enforceWorkspace('/tmp/test_workspace', workspace)).not.toThrow();
  });

  it('throws for path outside workspace', () => {
    expect(() => enforceWorkspace('/home/user/secret.txt', workspace)).toThrow('Access denied');
  });

  it('throws for path traversal', () => {
    expect(() => enforceWorkspace('/tmp/test_workspace/../../etc/passwd', workspace)).toThrow('Access denied');
  });

  it('throws for sibling directory with prefix overlap', () => {
    expect(() => enforceWorkspace('/tmp/test_workspace_evil/file.txt', workspace)).toThrow('Access denied');
  });

  it('error message includes both paths', () => {
    expect(() => enforceWorkspace('/other/path', workspace)).toThrow(/outside workspace/);
  });

  it('throws for symlink that points outside workspace (parity with Python)', () => {
    // Create real workspace + outside dir + symlink inside workspace pointing
    // to a file outside. enforceWorkspace must follow the symlink and refuse.
    const workspaceReal = mkdtempSync(join(tmpdir(), 'enforce-ws-'));
    const outsideDir = mkdtempSync(join(tmpdir(), 'enforce-outside-'));
    const secret = join(outsideDir, 'secret.txt');
    writeFileSync(secret, 'sensitive');
    const sneaky = join(workspaceReal, 'sneaky_link');
    symlinkSync(secret, sneaky);

    try {
      expect(() => enforceWorkspace(sneaky, workspaceReal)).toThrow(/outside workspace|Access denied/);
    } finally {
      rmSync(workspaceReal, { recursive: true });
      rmSync(outsideDir, { recursive: true });
    }
  });
});

describe('enforceWorkspace logging (RFC-035 §8 Q1)', () => {
  const workspace = '/tmp/test_workspace';
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
  });

  it('does not log on valid path', () => {
    enforceWorkspace('/tmp/test_workspace/file.md', workspace);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('logs to stderr before throwing on violation', () => {
    expect(() =>
      enforceWorkspace('/etc/passwd', workspace, { tool: 'phase6_write', argName: 'q_file_path' })
    ).toThrow();
    expect(errSpy).toHaveBeenCalledTimes(1);
    const message = errSpy.mock.calls[0][0] as string;
    expect(message).toContain('[WORKSPACE VIOLATION]');
    expect(message).toContain('phase6_write');
    expect(message).toContain('q_file_path');
    expect(message).toContain('/etc/passwd');
    expect(message).toContain(workspace);
  });

  it('logs without context fields when context omitted', () => {
    expect(() => enforceWorkspace('/etc/passwd', workspace)).toThrow();
    const message = errSpy.mock.calls[0][0] as string;
    expect(message).toContain('[WORKSPACE VIOLATION]');
    expect(message).toContain('/etc/passwd');
  });
});
