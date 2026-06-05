import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Per-student (lab-report) mode is documented as "not yet supported" in v1.
 * assessment_write must fail with a clear message in that mode rather than the
 * opaque "No assessment session found" that the directory-as-file path produced.
 */

const mockGetPhase6Session = vi.fn();
const mockDeriveProjectPath = vi.fn();

vi.mock('../src/shared/project_state_manager.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getPhase6Session: (...args: unknown[]) => mockGetPhase6Session(...args),
    deriveProjectPath: (...args: unknown[]) => mockDeriveProjectPath(...args),
    safeStateOperation: vi.fn().mockResolvedValue(undefined),
  };
});

const PROJECT_PATH = '/project';
const PER_STUDENT_DIR = '/project/07_analytic_student';

const minimalAssessment = {
  aspects: [{ name: 'A', symbol: '✓', points: 1, comment: 'ok' }],
  totalPoints: 1,
  maxPoints: 1,
  nextStep: '',
} as unknown as import('../src/types/assessment.js').Assessment;

describe('assessment_write — per-student guard (v1 not yet supported)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeriveProjectPath.mockResolvedValue(PROJECT_PATH);
    mockGetPhase6Session.mockResolvedValue({
      mode: 'per_student',
      current_question: '',
      assessment_file: PER_STUDENT_DIR, // a directory in per-student mode
      original_file: '',
      started_at: '2026-02-28T10:00:00Z',
      assessor: 'TestTeacher',
      methodology_loaded: true,
      rubric_displayed: true,
    });
  });

  it('rejects with a clear "not yet supported" message in per-student mode', async () => {
    const { assessmentWrite } = await import('../src/tools/phase6_write.js');

    await expect(
      assessmentWrite({
        student_id: 'student_A',
        assessment: minimalAssessment,
      })
    ).rejects.toThrow('Per-student assessment is not yet supported in v1');
  });
});
