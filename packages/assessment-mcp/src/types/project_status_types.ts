/**
 * Project Status Types (RFC-013: Session Continuity)
 *
 * Types for the project_status tool that enables resuming projects.
 */

/**
 * Status of a single Q-file
 */
export interface QFileStatus {
  question_id: string; // e.g., "Q001a", "Q004d"
  original_file: string; // Relative path to original Q-file
  assessment_copies: AssessmentCopy[]; // Assessment copies created
  total_students: number;
  assessed_students: number;
  progress_percent: number;
  status: 'not_started' | 'in_progress' | 'complete';
}

/**
 * Assessment copy info
 */
export interface AssessmentCopy {
  filename: string;
  assessor: string;
  date: string;
  is_current: boolean; // True if this is the active session file
  assessed_students?: number; // RFC-018: Track progress in copy
}

/**
 * Phase status summary
 */
export interface PhaseStatusSummary {
  phase: string; // e.g., "1_setup", "6_assessment"
  status: 'pending' | 'in_progress' | 'complete' | 'incomplete';
  timestamp?: string;
  details?: string;
}

/**
 * Result of the project_status tool
 */
export interface ProjectStatusResult {
  // Project info
  project_name: string;
  project_path: string;
  created: string;
  last_updated: string;

  // Phase overview
  current_phase: number;
  phases: PhaseStatusSummary[];

  // Q-file details (Phase 6)
  qfiles: QFileStatus[];
  total_questions: number;
  questions_complete: number;
  questions_in_progress: number;
  questions_not_started: number;

  // Active session (if any)
  active_session?: {
    question_id: string;
    assessment_file: string;
    assessor: string;
    started_at: string;
  };

  // Source files
  sources: {
    rubric: string;
    exam_questions: string;
    methodology: string;
  };

  // Recommendations
  recommendations: string[];
}

/**
 * Input parameters for project_status tool
 */
export interface ProjectStatusInput {
  project_path: string;
}
