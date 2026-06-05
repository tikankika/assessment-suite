/**
 * ADR-007: Canonical folder names — single source of truth.
 *
 * All project directory names are defined here. Never hardcode folder names
 * elsewhere; import from this module instead.
 */

/** Current folder names, keyed by phase. */
export const FOLDERS = {
  PHASE1_ORIGINAL:       '01_original',
  PHASE2_MARKDOWN:       '02_markdown',
  PHASE3_MATERIAL:       '03_material',
  PHASE4_RUBRIC:         '04_rubric',
  PHASE5_ANSWERS:        '05_answers_by_question',
  PHASE6_ASSESSMENT:     '06_analytic_assessment',
  PHASE7_STUDENT:        '07_analytic_student',
  PHASE8_QUANTITATIVE:   '08_quantitative',
  PHASE9_QUALITATIVE:    '09_qualitative',
  PHASE10_EXTRAPOLATION: '10_extrapolation',
  PHASE11_GRADING:       '11_grading',
  PHASE12_FEEDBACK:      '12_feedback',
  PHASE13_SUMMARY:       '13_teacher_summary',
  PHASE14_FEEDBACK:      '14_student_feedback',
  COMPLETE_ASSESSMENT:   'complete_assessment',
  METHODOLOGY:           'methodology',
} as const;

/** Legacy folder names kept for migration and backwards compatibility. */
export const LEGACY_FOLDERS = {
  CONVERTED:       '02_converted',
  ANSWERS_OLD:     '03_answers_by_question',
  STUDENT_ANSWERS: '03_student_answers',
  REPORTS_OLD:     '04_student_reports',
  FEEDBACK_OLD:    '14_aterkoppling_till_elev',
} as const;

/** All known folder names (current + legacy), useful for project_repair. */
export const ALL_KNOWN_FOLDERS = [
  ...Object.values(FOLDERS),
  ...Object.values(LEGACY_FOLDERS),
] as const;

export type FolderName = typeof FOLDERS[keyof typeof FOLDERS];
export type LegacyFolderName = typeof LEGACY_FOLDERS[keyof typeof LEGACY_FOLDERS];
