/**
 * Tests for generic_phase_tools — RFC-030 §6.2
 *
 * Tests the tool routing layer: config lookup, phase_start dispatch,
 * phase_complete session_id parsing, and error cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PHASE_CONFIGS } from '../src/core/phase_configs.js';

// ============================================================
// MOCKS — same as generic_phase_orchestrator.test.ts
// ============================================================

vi.mock('../src/utils/logging_config.js', () => ({
  setupProjectLogging: vi.fn().mockResolvedValue(undefined),
  logPhaseStart: vi.fn().mockResolvedValue(undefined),
  logPhaseComplete: vi.fn().mockResolvedValue(undefined),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../src/shared/project_state_manager.js', () => ({
  logWorkflowAction: vi.fn().mockResolvedValue(undefined),
}));

// ============================================================
// CONFIG TESTS
// ============================================================

describe('PHASE_CONFIGS', () => {
  it('should have configs for phases 9-14', () => {
    expect(Object.keys(PHASE_CONFIGS).sort()).toEqual(['10', '11', '12', '13', '14', '9']);
    expect(PHASE_CONFIGS[9].phaseId).toBe('PHASE_9');
    expect(PHASE_CONFIGS[10].phaseId).toBe('PHASE_10');
    expect(PHASE_CONFIGS[11].phaseId).toBe('PHASE_11');
    expect(PHASE_CONFIGS[12].phaseId).toBe('PHASE_12');
    expect(PHASE_CONFIGS[13].phaseId).toBe('PHASE_13');
    expect(PHASE_CONFIGS[14].phaseId).toBe('PHASE_14');
  });

  it('each config should have required fields', () => {
    for (const [num, cfg] of Object.entries(PHASE_CONFIGS)) {
      expect(cfg.phaseNumber).toBe(Number(num));
      expect(cfg.phaseId).toMatch(/^PHASE_\d+$/);
      expect(cfg.sectionTitle).toBeTruthy();
      expect(cfg.outputFolder).toBeTruthy();
      if (!cfg.classLevel) {
        expect(cfg.standaloneFilePattern).toContain('{studentId}');
      }
      expect(cfg.methodologyLoader).toMatch(/^loadPhase\d+Methodology$/);
      if (!cfg.classLevel) {
        expect(cfg.inputFiles.length).toBeGreaterThan(0);
      }
    }
  });

  it('Phase 10 should load Phase 9 generalization', () => {
    const p10 = PHASE_CONFIGS[10];
    const labels = p10.inputFiles.map(f => f.label);
    expect(labels).toContain('Phase 9 generalisering');
  });

  it('Phase 11 should load Phase 10 extrapolation', () => {
    const p11 = PHASE_CONFIGS[11];
    const labels = p11.inputFiles.map(f => f.label);
    expect(labels).toContain('Phase 10 extrapolering');
  });

  it('Phase 12 should load Phase 9, 10, 11 data', () => {
    const p12 = PHASE_CONFIGS[12];
    const labels = p12.inputFiles.map(f => f.label);
    expect(labels).toContain('Phase 9 generalisering');
    expect(labels).toContain('Phase 10 extrapolering');
    expect(labels).toContain('Phase 11 betygsbeslut');
  });

  it('student-level configs should include Complete_ report as input', () => {
    for (const cfg of Object.values(PHASE_CONFIGS)) {
      if (cfg.classLevel) continue;
      const hasComplete = cfg.inputFiles.some(f =>
        f.filePattern.startsWith('Complete_')
      );
      expect(hasComplete).toBe(true);
    }
  });
});

// ============================================================
// TOOL HANDLER TESTS
// ============================================================

describe('handlePhaseStart', () => {
  // Dynamic import to get handlers after mocks are set up
  let handlePhaseStart: typeof import('../src/tools/generic_phase_tools.js').handlePhaseStart;

  beforeEach(async () => {
    const mod = await import('../src/tools/generic_phase_tools.js');
    handlePhaseStart = mod.handlePhaseStart;
  });

  it('should reject unknown phase number', async () => {
    await expect(
      handlePhaseStart({ phase: 99, project_path: '/tmp', student_id: 'test' })
    ).rejects.toThrow('Unknown phase 99');
  });

  it('should reject phase 0', async () => {
    await expect(
      handlePhaseStart({ phase: 0, project_path: '/tmp', student_id: 'test' })
    ).rejects.toThrow('Unknown phase 0');
  });
});

describe('handlePhaseComplete', () => {
  let handlePhaseComplete: typeof import('../src/tools/generic_phase_tools.js').handlePhaseComplete;

  beforeEach(async () => {
    const mod = await import('../src/tools/generic_phase_tools.js');
    handlePhaseComplete = mod.handlePhaseComplete;
  });

  it('should reject invalid session_id format', async () => {
    await expect(
      handlePhaseComplete({ session_id: 'bad_format_123', content: 'test' })
    ).rejects.toThrow('Invalid session_id format');
  });

  it('should reject session_id without phase prefix', async () => {
    await expect(
      handlePhaseComplete({ session_id: 'session_abc_123', content: 'test' })
    ).rejects.toThrow('Invalid session_id format');
  });

  it('should parse phase number from valid session_id', async () => {
    // This will fail with "Session not found" (no active session),
    // but it should NOT fail with "Invalid session_id format"
    await expect(
      handlePhaseComplete({ session_id: 'phase10_TestStudent_1234567890', content: 'test' })
    ).rejects.toThrow(/not found/);
  });
});

// ============================================================
// TOOL DEFINITION TESTS
// ============================================================

describe('genericPhaseTools', () => {
  it('should export exactly 2 tools', async () => {
    const mod = await import('../src/tools/generic_phase_tools.js');
    expect(mod.genericPhaseTools).toHaveLength(2);
  });

  it('should have phase_start and phase_complete', async () => {
    const mod = await import('../src/tools/generic_phase_tools.js');
    const names = mod.genericPhaseTools.map(t => t.name);
    expect(names).toEqual(['phase_start', 'phase_complete']);
  });

  it('phase_start should require phase and project_path (student_id optional)', async () => {
    const mod = await import('../src/tools/generic_phase_tools.js');
    const schema = mod.phaseStartTool.inputSchema as Record<string, unknown>;
    expect(schema.required).toEqual(['phase', 'project_path']);
  });

  it('phase_complete should require session_id, content', async () => {
    const mod = await import('../src/tools/generic_phase_tools.js');
    const schema = mod.phaseCompleteTool.inputSchema as Record<string, unknown>;
    expect(schema.required).toEqual(['session_id', 'content']);
  });
});

// ============================================================
// PHASE 13 CLASS-LEVEL TESTS
// ============================================================

describe('Phase 13 class-level handling', () => {
  it('Phase 13 config should be marked as classLevel', () => {
    expect(PHASE_CONFIGS[13].classLevel).toBe(true);
  });

  it('Phase 13 config should have no inputFiles', () => {
    expect(PHASE_CONFIGS[13].inputFiles).toHaveLength(0);
  });

  it('Phase 13 standaloneFilePattern should not contain {studentId}', () => {
    expect(PHASE_CONFIGS[13].standaloneFilePattern).not.toContain('{studentId}');
  });

  it('phase_start(13) should work without student_id', async () => {
    const mod = await import('../src/tools/generic_phase_tools.js');
    // Phase 13 is class-level — no student_id needed, no input files.
    // Should succeed (returns session + methodology) even with bogus path
    // since there are no input files to load.
    const result = await mod.handlePhaseStart({ phase: 13, project_path: '/tmp/nonexistent' });
    expect(result.session_id).toMatch(/^phase13_class_/);
    expect(result.methodology).toBeTruthy();
  });

  it('phase_start for student-level phase should require student_id', async () => {
    const mod = await import('../src/tools/generic_phase_tools.js');
    await expect(
      mod.handlePhaseStart({ phase: 9, project_path: '/tmp/nonexistent' })
    ).rejects.toThrow('student_id is required');
  });
});

// ============================================================
// PHASE 14 PER-STUDENT TESTS
// ============================================================

describe('Phase 14 per-student handling', () => {
  it('Phase 14 config should NOT be classLevel', () => {
    expect(PHASE_CONFIGS[14].classLevel).toBeUndefined();
  });

  it('Phase 14 config should have inputFiles', () => {
    expect(PHASE_CONFIGS[14].inputFiles.length).toBeGreaterThan(0);
  });

  it('Phase 14 standaloneFilePattern should contain {studentId}', () => {
    expect(PHASE_CONFIGS[14].standaloneFilePattern).toContain('{studentId}');
  });

  it('Phase 14 should load Complete_ report and Phase 8 data', () => {
    const labels = PHASE_CONFIGS[14].inputFiles.map(f => f.label);
    expect(labels).toContain('Bedömningsrapport');
    expect(labels).toContain('Phase 8 kvantitativ data');
  });
});
