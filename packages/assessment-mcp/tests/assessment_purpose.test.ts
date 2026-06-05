/**
 * Tests for assessment_purpose tool (RFC-041)
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';

// ============================================================
// MOCKS
// ============================================================

vi.mock('../src/shared/project_state_manager.js', () => ({
  deriveProjectPath: vi.fn().mockImplementation((p: string) => Promise.resolve(p)),
  logWorkflowAction: vi.fn().mockResolvedValue(undefined),
  safeStateOperation: vi.fn().mockImplementation((fn: () => Promise<void>) => fn()),
}));

// ============================================================
// FIXTURES
// ============================================================

const TEST_DIR = '/tmp/assessment_purpose_test';

beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });
});

afterAll(async () => {
  try { await fs.rm(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
});

// ============================================================
// TESTS
// ============================================================

describe('assessment_purpose', () => {
  async function getHandler() {
    const mod = await import('../src/tools/assessment_purpose.js');
    return mod.assessmentPurpose;
  }

  it('should create assessment_purpose.md with correct content', async () => {
    const handler = await getHandler();
    const result = await handler({
      project_path: TEST_DIR,
      level: 'minitest',
      purpose: 'Formativ kontrollpunkt KK3 — identifiera kunskapsluckor inför slutprov.',
    });

    expect(result.success).toBe(true);
    expect(result.level).toBe('minitest');
    expect(result.file_path).toBe(join(TEST_DIR, 'assessment_purpose.md'));

    const content = await fs.readFile(result.file_path, 'utf-8');
    expect(content).toContain('level: minitest');
    expect(content).toContain('Formativ kontrollpunkt KK3');
    expect(content).toContain('Touch Point 1: Deklaration');
  });

  it('should use default pipeline for minitest', async () => {
    const handler = await getHandler();
    const result = await handler({
      project_path: TEST_DIR,
      level: 'minitest',
      purpose: 'Quick check.',
    });

    expect(result.pipeline.phase_9).toBe('short');
    expect(result.pipeline.phase_10).toBe('off');
    expect(result.pipeline.phase_11).toBe('off');
    expect(result.pipeline.phase_12).toBe('short');

    const content = await fs.readFile(result.file_path, 'utf-8');
    expect(content).toContain('phase_10: off');
  });

  it('should use default pipeline for tenta', async () => {
    const handler = await getHandler();
    const result = await handler({
      project_path: TEST_DIR,
      level: 'tenta',
      purpose: 'Slutexamination med betygsättning.',
    });

    expect(result.pipeline.phase_9).toBe('full');
    expect(result.pipeline.phase_10).toBe('full');
    expect(result.pipeline.phase_11).toBe('full');
  });

  it('should allow pipeline overrides', async () => {
    const handler = await getHandler();
    const result = await handler({
      project_path: TEST_DIR,
      level: 'minitest',
      purpose: 'Minitest men med full Phase 12.',
      pipeline: { phase_12: 'full' },
    });

    expect(result.pipeline.phase_9).toBe('short');  // default
    expect(result.pipeline.phase_12).toBe('full');   // overridden
  });

  it('should include student exceptions', async () => {
    const handler = await getHandler();
    const result = await handler({
      project_path: TEST_DIR,
      level: 'minitest',
      purpose: 'Minitest med undantag.',
      student_exceptions: [
        { student_id: '10001', level: 'prov', reason: 'Gränsfall — 52%' },
      ],
    });

    const content = await fs.readFile(result.file_path, 'utf-8');
    expect(content).toContain('10001');
    expect(content).toContain('Gränsfall');
    expect(content).toContain('Individuella undantag');
  });

  it('should reject empty purpose', async () => {
    const handler = await getHandler();
    await expect(
      handler({ project_path: TEST_DIR, level: 'minitest', purpose: '' })
    ).rejects.toThrow('Purpose text is required');
  });

  it('should log to workflow_log', async () => {
    const { logWorkflowAction } = await import('../src/shared/project_state_manager.js');
    const handler = await getHandler();
    await handler({
      project_path: TEST_DIR,
      level: 'prov',
      purpose: 'Delprov i biologi.',
    });

    expect(logWorkflowAction).toHaveBeenCalledWith(
      TEST_DIR,
      2,
      'assessment_purpose',
      'purpose_declared',
      expect.objectContaining({ level: 'prov' }),
      expect.objectContaining({ saved_to: expect.stringContaining('assessment_purpose.md') }),
    );
  });
});

describe('phase_start loads assessment_purpose', () => {
  it('should return assessment_purpose content when file exists', async () => {
    // Write a purpose file
    await fs.writeFile(
      join(TEST_DIR, 'assessment_purpose.md'),
      '---\nlevel: minitest\n---\n# PURPOSE\nTest.',
      'utf-8',
    );
    // Also need sources.yaml and input files for phase_start
    await fs.mkdir(join(TEST_DIR, '08_quantitative'), { recursive: true });
    await fs.mkdir(join(TEST_DIR, 'complete_assessment'), { recursive: true });
    await fs.writeFile(join(TEST_DIR, 'sources.yaml'), 'name: test_course_exam\n', 'utf-8');
    await fs.writeFile(
      join(TEST_DIR, '08_quantitative', 'Student_test01_quantitative.json'),
      '{"student_id":"test01","total_points":20}',
      'utf-8',
    );
    await fs.writeFile(
      join(TEST_DIR, 'complete_assessment', 'Complete_test01.md'),
      '# Report\nContent.',
      'utf-8',
    );

    const { GenericPhaseOrchestrator } = await import('../src/core/generic_phase_orchestrator.js');
    const { MethodologyLoader } = await import('../src/core/methodology_loader.js');
    const { PHASE_CONFIGS } = await import('../src/core/phase_configs.js');

    const mockLoader = new MethodologyLoader();
    mockLoader.loadPhase9Methodology = vi.fn().mockResolvedValue('# Phase 9 method');

    const orch = new GenericPhaseOrchestrator(PHASE_CONFIGS[9], undefined, mockLoader);
    const result = await orch.start(TEST_DIR, 'test01');

    expect(result.assessment_purpose).toContain('level: minitest');
    expect(result.assessment_purpose).toContain('# PURPOSE');
  });

  it('should return null when no assessment_purpose file', async () => {
    const emptyDir = join(TEST_DIR, 'no_purpose');
    await fs.mkdir(join(emptyDir, '08_quantitative'), { recursive: true });
    await fs.mkdir(join(emptyDir, 'complete_assessment'), { recursive: true });
    await fs.writeFile(join(emptyDir, 'sources.yaml'), 'name: test\n', 'utf-8');
    await fs.writeFile(
      join(emptyDir, '08_quantitative', 'Student_x_quantitative.json'),
      '{"student_id":"x"}',
      'utf-8',
    );
    await fs.writeFile(
      join(emptyDir, 'complete_assessment', 'Complete_x.md'),
      '# R\nC.',
      'utf-8',
    );

    const { GenericPhaseOrchestrator } = await import('../src/core/generic_phase_orchestrator.js');
    const { MethodologyLoader } = await import('../src/core/methodology_loader.js');
    const { PHASE_CONFIGS } = await import('../src/core/phase_configs.js');

    const mockLoader = new MethodologyLoader();
    mockLoader.loadPhase9Methodology = vi.fn().mockResolvedValue('# method');

    const orch = new GenericPhaseOrchestrator(PHASE_CONFIGS[9], undefined, mockLoader);
    const result = await orch.start(emptyDir, 'x');

    expect(result.assessment_purpose).toBeNull();
  });
});
