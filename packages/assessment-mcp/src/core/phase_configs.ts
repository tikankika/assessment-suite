/**
 * Phase Configs — RFC-030 P2
 *
 * Declarative configuration for each phase that uses GenericPhaseOrchestrator.
 * Phase selected via parameter: phase_start(phase=9, student_id="...")
 */

import { FOLDERS } from '../shared/folder_constants.js';
import type { PhaseConfig } from '../types/generic_phase_types.js';

export const PHASE9_CONFIG: PhaseConfig = {
  phaseNumber: 9,
  phaseId: 'PHASE_9',
  sectionTitle: 'DEL 2: KVALITATIV GENERALISERING',
  outputFolder: FOLDERS.PHASE9_QUALITATIVE,
  standaloneFilePattern: 'Student_{studentId}_generalization.md',
  methodologyLoader: 'loadPhase9Methodology',
  inputFiles: [
    {
      folder: FOLDERS.PHASE8_QUANTITATIVE,
      filePattern: 'Student_{studentId}_quantitative.json',
      parser: 'json',
      label: 'Phase 8 kvantitativ data',
    },
    {
      folder: FOLDERS.COMPLETE_ASSESSMENT,
      filePattern: 'Complete_{studentId}.md',
      parser: 'text',
      label: 'Bedömningsrapport',
    },
  ],
};

export const PHASE10_CONFIG: PhaseConfig = {
  phaseNumber: 10,
  phaseId: 'PHASE_10',
  sectionTitle: 'DEL 3: EXTRAPOLERING',
  outputFolder: FOLDERS.PHASE10_EXTRAPOLATION,
  standaloneFilePattern: 'Student_{studentId}_extrapolation.md',
  methodologyLoader: 'loadPhase10Methodology',
  inputFiles: [
    {
      folder: FOLDERS.PHASE9_QUALITATIVE,
      filePattern: 'Student_{studentId}_generalization.md',
      parser: 'text',
      label: 'Phase 9 generalisering',
    },
    {
      folder: FOLDERS.COMPLETE_ASSESSMENT,
      filePattern: 'Complete_{studentId}.md',
      parser: 'text',
      label: 'Bedömningsrapport',
    },
  ],
};

export const PHASE11_CONFIG: PhaseConfig = {
  phaseNumber: 11,
  phaseId: 'PHASE_11',
  sectionTitle: 'DEL 4: BETYGSBESLUT',
  outputFolder: FOLDERS.PHASE11_GRADING,
  standaloneFilePattern: 'Student_{studentId}_grade_decision.md',
  methodologyLoader: 'loadPhase11Methodology',
  inputFiles: [
    {
      folder: FOLDERS.PHASE10_EXTRAPOLATION,
      filePattern: 'Student_{studentId}_extrapolation.md',
      parser: 'text',
      label: 'Phase 10 extrapolering',
    },
    {
      folder: FOLDERS.COMPLETE_ASSESSMENT,
      filePattern: 'Complete_{studentId}.md',
      parser: 'text',
      label: 'Bedömningsrapport',
    },
  ],
};

export const PHASE12_CONFIG: PhaseConfig = {
  phaseNumber: 12,
  phaseId: 'PHASE_12',
  sectionTitle: 'DEL 5: ÅTERKOPPLING',
  outputFolder: FOLDERS.PHASE12_FEEDBACK,
  standaloneFilePattern: 'Student_{studentId}_feedback.md',
  methodologyLoader: 'loadPhase12Methodology',
  inputFiles: [
    {
      folder: FOLDERS.PHASE9_QUALITATIVE,
      filePattern: 'Student_{studentId}_generalization.md',
      parser: 'text',
      label: 'Phase 9 generalisering',
    },
    {
      folder: FOLDERS.PHASE10_EXTRAPOLATION,
      filePattern: 'Student_{studentId}_extrapolation.md',
      parser: 'text',
      label: 'Phase 10 extrapolering',
    },
    {
      folder: FOLDERS.PHASE11_GRADING,
      filePattern: 'Student_{studentId}_grade_decision.md',
      parser: 'text',
      label: 'Phase 11 betygsbeslut',
      optional: true,
    },
    {
      folder: FOLDERS.COMPLETE_ASSESSMENT,
      filePattern: 'Complete_{studentId}.md',
      parser: 'text',
      label: 'Bedömningsrapport',
    },
  ],
};

export const PHASE13_CONFIG: PhaseConfig = {
  phaseNumber: 13,
  phaseId: 'PHASE_13',
  sectionTitle: 'DEL 6: LÄRARSAMMANFATTNING',
  outputFolder: FOLDERS.PHASE13_SUMMARY,
  standaloneFilePattern: 'Class_Summary_Formative.md',
  methodologyLoader: 'loadPhase13Methodology',
  inputFiles: [
    // Phase 13 is class-level — reads entire directories, not per-student files.
    // Input loading is handled by the LLM reading files directly.
    // No per-student input files needed here.
  ],
  classLevel: true,
};

export const PHASE14_CONFIG: PhaseConfig = {
  phaseNumber: 14,
  phaseId: 'PHASE_14',
  sectionTitle: 'DEL 7: ELEVÅTERKOPPLING',
  outputFolder: FOLDERS.PHASE14_FEEDBACK,
  standaloneFilePattern: 'Aterkoppling_{studentId}.md',
  methodologyLoader: 'loadPhase14Methodology',
  inputFiles: [
    {
      folder: FOLDERS.COMPLETE_ASSESSMENT,
      filePattern: 'Complete_{studentId}.md',
      parser: 'text',
      label: 'Bedömningsrapport',
    },
    {
      folder: FOLDERS.PHASE8_QUANTITATIVE,
      filePattern: 'Student_{studentId}_quantitative.json',
      parser: 'json',
      label: 'Phase 8 kvantitativ data',
    },
    {
      folder: FOLDERS.PHASE9_QUALITATIVE,
      filePattern: 'Student_{studentId}_generalization.md',
      parser: 'text',
      label: 'Phase 9 generalisering',
      optional: true,
    },
  ],
};

/** All phase configs, keyed by phase number. */
export const PHASE_CONFIGS: Record<number, PhaseConfig> = {
  9: PHASE9_CONFIG,
  10: PHASE10_CONFIG,
  11: PHASE11_CONFIG,
  12: PHASE12_CONFIG,
  13: PHASE13_CONFIG,
  14: PHASE14_CONFIG,
};
