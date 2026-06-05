/**
 * Tests for GenericPhaseOrchestrator — RFC-030 P2
 *
 * Uses real filesystem in /tmp for integration-style testing.
 * Mocks logging and methodology loader to isolate orchestrator logic.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { PhaseConfig } from '../src/types/generic_phase_types.js';

// ============================================================
// MOCKS
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
// FIXTURES
// ============================================================

const TEST_DIR = '/tmp/generic_phase_orch_test';
const PROJECT_PATH = `${TEST_DIR}/project`;
const STUDENT_ID = 'TestStudent01';

const QUANT_DATA = {
  student_id: STUDENT_ID,
  total_points: 25,
  max_points: 40,
  percentage: 62.5,
  questions_answered: 5,
  questions_total: 6,
  aspect_distribution: { excellent: 2, good: 5, partial: 3, missing: 1 },
  questions: [
    { question_id: 'Q001', points: 5, max_points: 8, status: 'good' },
  ],
};

const PHASE7_REPORT_CONTENT = `# Bedömningsrapport: ${STUDENT_ID}

## Q001: Evolution
Bra svar om evolution.

<!-- PHASE_7_END -->
`;

const SOURCES_YAML = `name: BIOG2000X_dugga2\ncreated: 2026-01-01\n`;

const COMPLETE_REPORT = `# Complete Report: ${STUDENT_ID}

<!-- PHASE_7_START -->
## DEL 1: ANALYTISK BEDÖMNING

Some Phase 7 content here.

<!-- PHASE_7_END -->
`;

const METHODOLOGY_TEXT = '# Phase 9 Methodology\n\n## STEG 1: Områdesanalys\nGör analys.';

const TEST_CONFIG: PhaseConfig = {
  phaseNumber: 9,
  phaseId: 'PHASE_9',
  sectionTitle: 'DEL 2: KVALITATIV GENERALISERING',
  outputFolder: '09_qualitative',
  standaloneFilePattern: 'Student_{studentId}_generalization.md',
  methodologyLoader: 'loadPhase9Methodology',
  inputFiles: [
    {
      folder: '08_quantitative',
      filePattern: 'Student_{studentId}_quantitative.json',
      parser: 'json' as const,
      label: 'Phase 8 kvantitativ data',
    },
    {
      folder: 'complete_assessment',
      filePattern: 'Complete_{studentId}.md',
      parser: 'text' as const,
      label: 'Phase 7 bedömningsrapport',
    },
  ],
};

// ============================================================
// SETUP / TEARDOWN
// ============================================================

beforeAll(async () => {
  // Create project directory structure
  await fs.mkdir(join(PROJECT_PATH, '08_quantitative'), { recursive: true });
  await fs.mkdir(join(PROJECT_PATH, 'complete_assessment'), { recursive: true });

  // Write input files
  await fs.writeFile(
    join(PROJECT_PATH, '08_quantitative', `Student_${STUDENT_ID}_quantitative.json`),
    JSON.stringify(QUANT_DATA),
    'utf-8',
  );
  await fs.writeFile(
    join(PROJECT_PATH, 'complete_assessment', `Complete_${STUDENT_ID}.md`),
    COMPLETE_REPORT,
    'utf-8',
  );
  await fs.writeFile(
    join(PROJECT_PATH, 'sources.yaml'),
    SOURCES_YAML,
    'utf-8',
  );
});

afterAll(async () => {
  try {
    await fs.rm(TEST_DIR, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// TESTS
// ============================================================

describe('GenericPhaseOrchestrator', () => {
  // Dynamic import after mocks are set up
  async function createOrchestrator() {
    const { GenericPhaseOrchestrator } = await import(
      '../src/core/generic_phase_orchestrator.js'
    );
    const { MethodologyLoader } = await import(
      '../src/core/methodology_loader.js'
    );

    const mockLoader = new MethodologyLoader();
    // Override the method to return test methodology
    mockLoader.loadPhase9Methodology = vi.fn().mockResolvedValue(METHODOLOGY_TEXT);

    return new GenericPhaseOrchestrator(TEST_CONFIG, undefined, mockLoader);
  }

  // ----------------------------------------------------------
  // start()
  // ----------------------------------------------------------

  describe('start()', () => {
    it('should return session_id, loaded_data, methodology, and project_info', async () => {
      const orch = await createOrchestrator();
      const result = await orch.start(PROJECT_PATH, STUDENT_ID);

      expect(result.session_id).toMatch(/^phase9_TestStudent01_/);
      expect(result.methodology).toBe(METHODOLOGY_TEXT);
      expect(result.project_info.courseName).toBe('BIOG2000X');
      expect(result.project_info.examName).toBe('dugga2');
    });

    it('should load JSON input files as parsed objects', async () => {
      const orch = await createOrchestrator();
      const result = await orch.start(PROJECT_PATH, STUDENT_ID);

      const quantData = result.loaded_data['Phase 8 kvantitativ data'] as typeof QUANT_DATA;
      expect(quantData.student_id).toBe(STUDENT_ID);
      expect(quantData.total_points).toBe(25);
      expect(quantData.percentage).toBe(62.5);
    });

    it('should load text input files as strings', async () => {
      const orch = await createOrchestrator();
      const result = await orch.start(PROJECT_PATH, STUDENT_ID);

      const report = result.loaded_data['Phase 7 bedömningsrapport'] as string;
      expect(typeof report).toBe('string');
      expect(report).toContain('ANALYTISK BEDÖMNING');
    });

    it('should throw on missing required input file', async () => {
      const orch = await createOrchestrator();
      await expect(
        orch.start(PROJECT_PATH, 'NonExistentStudent'),
      ).rejects.toThrow('Missing required input');
    });

    it('should return null for optional missing input file', async () => {
      const configWithOptional: PhaseConfig = {
        ...TEST_CONFIG,
        inputFiles: [
          ...TEST_CONFIG.inputFiles,
          {
            folder: '99_nonexistent',
            filePattern: 'missing_{studentId}.txt',
            parser: 'text' as const,
            label: 'Optional data',
            optional: true,
          },
        ],
      };

      const { GenericPhaseOrchestrator } = await import(
        '../src/core/generic_phase_orchestrator.js'
      );
      const { MethodologyLoader } = await import(
        '../src/core/methodology_loader.js'
      );
      const mockLoader = new MethodologyLoader();
      mockLoader.loadPhase9Methodology = vi.fn().mockResolvedValue(METHODOLOGY_TEXT);

      const orch = new GenericPhaseOrchestrator(configWithOptional, undefined, mockLoader);
      const result = await orch.start(PROJECT_PATH, STUDENT_ID);

      expect(result.loaded_data['Optional data']).toBeNull();
    });

    it('should log workflow action', async () => {
      const { logWorkflowAction } = await import(
        '../src/shared/project_state_manager.js'
      );
      const orch = await createOrchestrator();
      await orch.start(PROJECT_PATH, STUDENT_ID);

      expect(logWorkflowAction).toHaveBeenCalledWith(
        PROJECT_PATH,
        9,
        'phase9_start',
        'session_start',
        expect.objectContaining({ student_id: STUDENT_ID }),
        expect.objectContaining({ input_files_loaded: 2 }),
      );
    });
  });

  // ----------------------------------------------------------
  // complete()
  // ----------------------------------------------------------

  describe('complete()', () => {
    it('should write to Complete_ report and standalone file', async () => {
      const orch = await createOrchestrator();
      const startResult = await orch.start(PROJECT_PATH, STUDENT_ID);

      const content = '### Kunskapsprofil\nStudenten visar god förståelse.';
      const result = await orch.complete(startResult.session_id, content);

      expect(result.success).toBe(true);
      expect(result.output_path).toContain('complete_assessment');
      expect(result.standalone_path).toContain('09_qualitative');

      // Verify standalone file was written
      const standaloneContent = await fs.readFile(result.standalone_path, 'utf-8');
      expect(standaloneContent).toBe(content);

      // Verify Complete_ report was updated with PHASE_9 markers
      const reportContent = await fs.readFile(result.output_path, 'utf-8');
      expect(reportContent).toContain('<!-- PHASE_9_START -->');
      expect(reportContent).toContain('DEL 2: KVALITATIV GENERALISERING');
      expect(reportContent).toContain('Studenten visar god förståelse');
      expect(reportContent).toContain('<!-- PHASE_9_END -->');
    });

    it('should throw on invalid session_id', async () => {
      const orch = await createOrchestrator();
      await expect(
        orch.complete('nonexistent_session', 'content'),
      ).rejects.toThrow('Session nonexistent_session not found');
    });

    it('should clean up session after complete', async () => {
      const orch = await createOrchestrator();
      const startResult = await orch.start(PROJECT_PATH, STUDENT_ID);
      await orch.complete(startResult.session_id, 'Done.');

      // Second complete with same session should fail
      await expect(
        orch.complete(startResult.session_id, 'Again.'),
      ).rejects.toThrow('not found');
    });

    it('should log workflow action on complete', async () => {
      const { logWorkflowAction } = await import(
        '../src/shared/project_state_manager.js'
      );
      const orch = await createOrchestrator();
      const startResult = await orch.start(PROJECT_PATH, STUDENT_ID);
      await orch.complete(startResult.session_id, 'Content.');

      expect(logWorkflowAction).toHaveBeenCalledWith(
        PROJECT_PATH,
        9,
        'phase9_complete',
        'session_complete',
        expect.objectContaining({ student_id: STUDENT_ID }),
        expect.objectContaining({ output_path: expect.stringContaining('Complete_') }),
      );
    });
  });

  // ----------------------------------------------------------
  // Class-level phase (Phase 13)
  // ----------------------------------------------------------

  describe('class-level phase', () => {
    const CLASS_CONFIG: PhaseConfig = {
      phaseNumber: 13,
      phaseId: 'PHASE_13',
      sectionTitle: 'DEL 6: LÄRARSAMMANFATTNING',
      outputFolder: '13_teacher_summary',
      standaloneFilePattern: 'Class_Summary_Formative.md',
      methodologyLoader: 'loadPhase9Methodology', // reuse for test
      inputFiles: [],
      classLevel: true,
    };

    async function createClassOrchestrator() {
      const { GenericPhaseOrchestrator } = await import(
        '../src/core/generic_phase_orchestrator.js'
      );
      const { MethodologyLoader } = await import(
        '../src/core/methodology_loader.js'
      );
      const mockLoader = new MethodologyLoader();
      mockLoader.loadPhase9Methodology = vi.fn().mockResolvedValue('# Phase 13 test methodology');
      return new GenericPhaseOrchestrator(CLASS_CONFIG, undefined, mockLoader);
    }

    it('start() should work with student_id "class"', async () => {
      const orch = await createClassOrchestrator();
      const result = await orch.start(PROJECT_PATH, 'class');

      expect(result.session_id).toMatch(/^phase13_class_/);
      expect(result.methodology).toBe('# Phase 13 test methodology');
      expect(Object.keys(result.loaded_data)).toHaveLength(0);
    });

    it('complete() should write standalone file but NOT update Complete_ report', async () => {
      const orch = await createClassOrchestrator();
      const startResult = await orch.start(PROJECT_PATH, 'class');

      const content = '# Klassammanfattning\nBra resultat.';
      const result = await orch.complete(startResult.session_id, content);

      expect(result.success).toBe(true);
      expect(result.standalone_path).toContain('13_teacher_summary');
      // output_path should be empty for class-level (no Complete_ report)
      expect(result.output_path).toBe('');

      // Verify standalone file was written
      const standaloneContent = await fs.readFile(result.standalone_path, 'utf-8');
      expect(standaloneContent).toBe(content);
    });
  });

  // ----------------------------------------------------------
  // Constructor validation
  // ----------------------------------------------------------

  describe('constructor', () => {
    it('should fail-fast on invalid methodologyLoader method name', async () => {
      const { GenericPhaseOrchestrator } = await import(
        '../src/core/generic_phase_orchestrator.js'
      );

      const badConfig: PhaseConfig = {
        ...TEST_CONFIG,
        methodologyLoader: 'nonExistentMethod',
      };

      expect(() => new GenericPhaseOrchestrator(badConfig)).toThrow(
        "PhaseConfig error: 'nonExistentMethod' is not a method on MethodologyLoader",
      );
    });
  });
});
