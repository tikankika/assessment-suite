import { describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import type { PhaseConfig } from '../src/types/generic_phase_types.js';

vi.mock('../src/utils/logging_config.js', () => ({
  setupProjectLogging: vi.fn().mockResolvedValue(undefined),
  logPhaseStart: vi.fn().mockResolvedValue(undefined),
  logPhaseComplete: vi.fn().mockResolvedValue(undefined),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../src/shared/project_state_manager.js', () => ({
  logWorkflowAction: vi.fn().mockResolvedValue(undefined),
}));

const CONFIG: PhaseConfig = {
  phaseNumber: 13,
  phaseId: 'PHASE_13_METHODOLOGY_FAILURE_TEST',
  sectionTitle: 'TEST',
  outputFolder: '13_teacher_summary',
  standaloneFilePattern: 'Class_Summary_Formative.md',
  methodologyLoader: 'loadPhase13Methodology',
  inputFiles: [],
  classLevel: true,
};

describe('GenericPhaseOrchestrator.start() when the methodology cannot be loaded', () => {
  it('rejects and removes the session it created', async () => {
    const { GenericPhaseOrchestrator } = await import('../src/core/generic_phase_orchestrator.js');
    const { MethodologyLoader } = await import('../src/core/methodology_loader.js');

    const loader = new MethodologyLoader();
    loader.loadPhase13Methodology = vi.fn().mockRejectedValue(new Error('methodology missing'));

    const sessions = new Map<string, unknown>();
    const manager = {
      createSession: vi.fn((projectPath: string, studentId: string, prefix: string) => {
        const session = { session_id: `${prefix}_${studentId}_test`, project_path: projectPath };
        sessions.set(session.session_id, session);
        return session;
      }),
      deleteSession: vi.fn((id: string) => sessions.delete(id)),
      getSession: vi.fn((id: string) => sessions.get(id)),
      updateSession: vi.fn(),
    };

    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'generic-phase-methodology-'));
    try {
      const orchestrator = new GenericPhaseOrchestrator(CONFIG, manager as never, loader);
      await expect(orchestrator.start(project, 'class')).rejects.toThrow('methodology missing');
      expect(manager.createSession).toHaveBeenCalledTimes(1);
      expect(sessions.size).toBe(0);
    } finally {
      await fs.rm(project, { recursive: true, force: true });
    }
  });
});
