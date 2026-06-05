import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';

/**
 * Security tests: Verify path traversal is blocked in all tools
 * that accept user-provided paths.
 *
 * These tests ensure that validatePathOrThrow() is called BEFORE
 * any file operations in each tool entry point.
 */

// Mock project_state_manager to prevent file writes
vi.mock('../src/shared/project_state_manager.js', () => ({
  deriveProjectPath: vi.fn().mockResolvedValue(null),
  markPhaseInProgress: vi.fn(),
  markPhaseComplete: vi.fn(),
  markPhaseIncomplete: vi.fn(),
  logWorkflowAction: vi.fn(),
  safeStateOperation: vi.fn().mockImplementation((fn) => fn()),
  updateSources: vi.fn(),
  updatePhase6Session: vi.fn(),
  getPhase6Session: vi.fn().mockResolvedValue(undefined),
  getTimestamp: vi.fn().mockReturnValue('2026-04-12'),
  SourcesYaml: {},
}));

describe('Security: path traversal blocked in tool entry points', () => {
  it('phase2b_questions rejects traversal in exam_path', async () => {
    const { phase2bQuestionDetection } = await import('../src/tools/phase2b_questions.js');
    await expect(
      phase2bQuestionDetection({
        exam_path: '/System/Library/../../etc/passwd',
        mode: 'single',
      })
    ).rejects.toThrow();
  });

  it('phase2c_boundaries rejects traversal in project_path', async () => {
    const { phase2cAnswerBoundaries } = await import('../src/tools/phase2c_boundaries.js');
    await expect(
      phase2cAnswerBoundaries({
        project_path: '/System/Library/secret',
        mode: 'load',
      })
    ).rejects.toThrow();
  });

  it('phase2d_students rejects traversal in project_path', async () => {
    const { phase2dStudents } = await import('../src/tools/phase2d_students.js');
    await expect(
      phase2dStudents({
        project_path: '/System/Library/Preferences/evil',
        mode: 'discover',
      })
    ).rejects.toThrow();
  });

  it('phase3_validate rejects traversal in project_path', async () => {
    const { phase3Validate } = await import('../src/tools/phase3_validate.js');
    await expect(
      phase3Validate({
        project_path: '/System/Library/secret',
      })
    ).rejects.toThrow();
  });
});
