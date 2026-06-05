import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for ADR-005 auto-resolve in assessment_write_free.
 *
 * Verifies that when Phase6Session exists:
 * - Original q_file_path is redirected to session.assessment_file (dated copy)
 * - Missing q_file_path is auto-discovered from session
 * - Missing path + no session throws error
 */

// Track which path StatusManager.hasStatus receives
const mockHasStatus = vi.fn().mockResolvedValue(true);
const mockStatusUpdate = vi.fn().mockResolvedValue(undefined);
const mockFindStudent = vi.fn().mockResolvedValue({
  id: 'test_student', index: 0, assessed: false,
});
const mockParseStudents = vi.fn().mockResolvedValue([
  { id: 'test_student', index: 0, assessed: true },
]);
const mockWriteFreetext = vi.fn().mockResolvedValue({ success: true });

// Mock project_state_manager
const mockGetPhase6Session = vi.fn();
const mockDeriveProjectPath = vi.fn();

vi.mock('../src/shared/project_state_manager.js', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getPhase6Session: (...args: unknown[]) => mockGetPhase6Session(...args),
    deriveProjectPath: (...args: unknown[]) => mockDeriveProjectPath(...args),
    // Prevent real file operations in state tracking
    safeStateOperation: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../src/core/status_manager.js', () => ({
  StatusManager: class {
    hasStatus = mockHasStatus;
    update = mockStatusUpdate;
  },
}));

vi.mock('../src/core/student_reader.js', () => ({
  StudentReader: class {
    findStudent = mockFindStudent;
    parseStudents = mockParseStudents;
  },
}));

vi.mock('../src/core/assessment_writer.js', () => ({
  AssessmentWriter: class {
    writeFreetextAssessment = mockWriteFreetext;
    writeAssessment = vi.fn().mockResolvedValue({ success: true });
    removeAssessment = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('../src/core/summary_writer.js', () => ({
  SummaryWriter: class {
    writeSummary = vi.fn().mockResolvedValue(undefined);
  },
}));

// Test data
const ORIGINAL_PATH = '/project/06_analytic_assessment/Q001_alla_elever.md';
const DATED_COPY_PATH = '/project/06_analytic_assessment/Q001_alla_elever_2026-02-28_Author.md';
const PROJECT_PATH = '/project';

describe('phase6_write_free ADR-005 auto-resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeriveProjectPath.mockResolvedValue(PROJECT_PATH);
    mockGetPhase6Session.mockResolvedValue({
      current_question: 'Q001',
      assessment_file: DATED_COPY_PATH,
      original_file: ORIGINAL_PATH,
      started_at: '2026-02-28T10:00:00Z',
      assessor: 'TestTeacher',
      methodology_loaded: true,
      rubric_displayed: true,
    });
  });

  it('should redirect original path to dated copy', async () => {
    const { assessmentWriteFree } = await import('../src/tools/phase6_write_free.js');

    await assessmentWriteFree({
      q_file_path: ORIGINAL_PATH,  // Bug scenario: caller passes original
      student_id: 'test_student',
      bedomning_text: 'Bra svar.',
    });

    // StatusManager.hasStatus should receive the DATED path, not the original
    expect(mockHasStatus).toHaveBeenCalledWith(DATED_COPY_PATH);

    // writeFreetextAssessment should write to the DATED path
    // RFC-029 R7: metadata always includes assessed_by from session
    expect(mockWriteFreetext).toHaveBeenCalledWith(
      DATED_COPY_PATH,
      'test_student',
      'Bra svar.',
      { total_points: undefined, max_points: undefined, assessed_by: 'TestTeacher' },
    );
  });

  it('should auto-discover path from session when not provided', async () => {
    const { assessmentWriteFree } = await import('../src/tools/phase6_write_free.js');

    await assessmentWriteFree({
      student_id: 'test_student',
      bedomning_text: 'Bra svar.',
    });

    // Should have discovered and used session.assessment_file
    expect(mockHasStatus).toHaveBeenCalledWith(DATED_COPY_PATH);
    // RFC-029 R7: metadata always includes assessed_by from session
    expect(mockWriteFreetext).toHaveBeenCalledWith(
      DATED_COPY_PATH,
      'test_student',
      'Bra svar.',
      { total_points: undefined, max_points: undefined, assessed_by: 'TestTeacher' },
    );
  });

  it('should throw when no path and no session', async () => {
    mockDeriveProjectPath.mockResolvedValue(null);

    const { assessmentWriteFree } = await import('../src/tools/phase6_write_free.js');

    await expect(
      assessmentWriteFree({
        student_id: 'test_student',
        bedomning_text: 'Bra svar.',
      })
    ).rejects.toThrow('No q_file_path provided');
  });

  it('should preserve explicit non-original path', async () => {
    const CUSTOM_PATH = '/other/Q002_alla_elever.md';

    const { assessmentWriteFree } = await import('../src/tools/phase6_write_free.js');

    await assessmentWriteFree({
      q_file_path: CUSTOM_PATH,
      student_id: 'test_student',
      bedomning_text: 'Bra svar.',
    });

    // Should NOT redirect — custom path != session.original_file
    expect(mockHasStatus).toHaveBeenCalledWith(CUSTOM_PATH);
    // RFC-029 R7: metadata always includes assessed_by from session
    expect(mockWriteFreetext).toHaveBeenCalledWith(
      CUSTOM_PATH,
      'test_student',
      'Bra svar.',
      { total_points: undefined, max_points: undefined, assessed_by: 'TestTeacher' },
    );
  });
});
