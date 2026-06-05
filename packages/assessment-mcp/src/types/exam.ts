/**
 * Phase 4A: Question Detection Types
 *
 * Types for the analyze_exam MCP tool with preview/full modes.
 */

export interface Question {
  id: string;              // "Q016"
  number: number;          // 16
  rubric_id: string | null; // "A3" or null
  raw_header: string;      // Original header line
  question_title: string;  // Cleaned title
  title?: string;          // Legacy alias for question_title
  question_text: string;   // Full question text
  points: number | null;   // From "(15 poäng)" - null if conflict
  max_marks: number;       // From "Maximum marks: 15"
  question_type: string;   // "Essay", "Text area", etc.
  warnings: string[];      // Issues detected
  learning_objectives?: string[];  // LO codes linking to course LO register
}

export interface QuestionWarning {
  question_id: string;
  type: 'conflict' | 'missing' | 'inconsistent';
  message: string;
  suggested_fix?: string;
}

export interface QuestionPreviewResult {
  mode: 'preview';
  first_question: Question;
  detected_format: 'NUMBERED_RUBRIC' | 'NUMBERED_PLAIN' | 'UNKNOWN';
  confidence: 'high' | 'medium' | 'low';
  extraction_success: boolean;
  warnings: string[];
}

export interface QuestionDetectionResult {
  mode: 'full';
  questions: Question[];
  total_questions: number;
  essay_questions: number;
  detection_confidence: number;
  warnings: QuestionWarning[];
  needs_review: boolean;
}

export type AnalyzeExamResult = QuestionPreviewResult | QuestionDetectionResult;

// YAML output structure for exam_config.yaml
export interface ExamConfigYAML {
  exam: {
    id: string;
    course_code: string;
    exam_name: string;
    date: string;  // Note: 'date' not 'exam_date'
  };
  questions: Array<{
    id: string;
    number: number;
    rubric_id: string | null;
    raw_header: string;
    question_title: string;
    points: number | null;  // Teacher-verified points
    question_type: string;
    learning_objectives?: string[];  // LO codes linking to course LO register
    // question_text removed - exists in exam_questions_annotated.md
  }>;
  // Note: NO extraction section (that's from old Pre-Assessment system)
}

// ============================================================================
// Phase 4B: Rubric Validation Types
// ============================================================================

/**
 * Rubric aspect with ID, name, and point allocation (Phase 4B specific)
 * Note: Different from assessment.ts RubricAspect which uses maxPoints
 */
export interface Phase4bRubricAspect {
  id: string;
  name: string;
  points: number;
  description?: string;    // Optional detailed description
}

/**
 * Complete rubric data for a question
 */
export interface RubricData {
  section_title: string;
  rubric_points: number;
  aspects: Phase4bRubricAspect[];  // Array of Phase 4B aspects
  aspect_sum: number;          // Sum of aspect points (should = rubric_points)
}

/**
 * Conflict resolution information
 */
export interface ConflictResolution {
  original_conflict: string;
  rubric_confirms: string;
  resolution: string;
  auto_resolved: boolean;       // true if auto-resolved, false if needs teacher
}

/**
 * Question enriched with rubric validation data
 */
export interface QuestionWithRubric extends Question {
  rubric_verified: boolean;
  rubric_data?: RubricData;
  conflict_resolution?: ConflictResolution;
  teacher_action_required?: boolean;
  teacher_note?: string;
}

// ============================================================================
// Phase 4C: Answer Boundary Detection & Student-Question Mapping Types
// ============================================================================

/**
 * Exact location of a student's answer in the markdown file
 */
export interface AnswerLocation {
  page: number;                    // 9
  start_marker: string;            // "6 Skriv ditt svar här..."
  system_text_to_skip: string;     // "Skriv ditt svar här. Ändringar sparas automatiskt."
  end_marker: string;              // "Words: 125"
  start_line: number;              // 145 (0-indexed, first line of actual answer)
  end_line: number;                // 152 (0-indexed, last line of actual answer)
  // v2.0: Context for validation in Phase 5
  context_before?: string;         // 2 lines before answer (for validation)
  context_after?: string;          // 2 lines after answer (for validation)
}

/**
 * Single question answer with metadata and location
 */
export interface QuestionAnswer {
  question_id: string;             // "Q006"
  question_number: number;         // 6
  rubric_id?: string;              // "E3" (from exam_config)
  question_type: string;           // "Text area" | "Essay" | "Graphic Gap Match"

  // Grading flags
  auto_graded: boolean;            // true for Q001-Q005 (interactive)
  skip_manual_assessment?: boolean;   // true if auto_graded
  requires_manual_assessment?: boolean;  // true if NOT auto_graded
  has_answer: boolean;             // Did student answer this?

  // Auto-graded metadata (if auto_graded=true)
  system_result?: string;          // "Partially Correct. 8 of 12 marks."
  points_awarded?: number;         // 8
  max_points?: number;             // 12

  // Location data (if requires_manual_assessment=true)
  location?: AnswerLocation;

  // Validation metadata
  word_count?: number;             // 125
  status?: string;                 // "Answered" | "Not answered"
  warning?: string;                // "Very short answer"
  note?: string;                   // Teacher notes
}

/**
 * Complete mapping of a student's answers to all questions
 */
export interface StudentAnswerMapping {
  student_id: string;              // "10001"
  file_path: string;               // "02_markdown/student_answers/10001_200001.md"
  total_questions: number;         // 20
  questions_answered: number;      // 9
  completion_rate: number;         // 45 (percentage)

  answers: QuestionAnswer[];
}
