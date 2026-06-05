import {
  deriveProjectPath,
  getPhase6Session,
  logWorkflowAction,
  safeStateOperation,
} from '../shared/project_state_manager.js';

/**
 * teacher_annotation - Log teacher interventions during assessment
 *
 * RFC-027: Research-grade logging of teacher involvement that would
 * otherwise only be visible in chat history. Designed for human-AI
 * collaborative assessment research (Paper 1).
 *
 * Annotation types derived from real Q002 analysis:
 * - rubric_clarification: teacher clarifies criterion interpretation
 * - rubric_correction: teacher finds error in rubric
 * - generous_interpretation: teacher requests generous reading
 * - score_adjustment: teacher adjusts AI's proposed score before write
 * - context_addition: teacher provides domain knowledge AI lacks
 * - retroactive_change: teacher revises previously assessed students
 * - calibration_note: teacher notes about consistency
 * - general_note: freeform annotation
 */

export const ANNOTATION_TYPES = [
  'rubric_clarification',
  'rubric_correction',
  'generous_interpretation',
  'score_adjustment',
  'context_addition',
  'retroactive_change',
  'calibration_note',
  'general_note',
] as const;

export type AnnotationType = typeof ANNOTATION_TYPES[number];

export interface TeacherAnnotationInput {
  annotation_type: AnnotationType;
  description: string;
  student_id?: string;
  question_id?: string;
  related_students?: string[];
  original_value?: string;
  adjusted_value?: string;
  reasoning?: string;
  project_path?: string;
  q_file_path?: string;
}

export interface TeacherAnnotationResult {
  success: boolean;
  logged: boolean;
  annotation_type: string;
  message: string;
}

export async function teacherAnnotation(
  args: TeacherAnnotationInput
): Promise<TeacherAnnotationResult> {
  const {
    annotation_type,
    description,
    student_id,
    question_id,
    related_students,
    original_value,
    adjusted_value,
    reasoning,
    project_path,
    q_file_path,
  } = args;

  if (!ANNOTATION_TYPES.includes(annotation_type)) {
    return {
      success: false,
      logged: false,
      annotation_type,
      message: `Unknown annotation_type: ${annotation_type}. Valid types: ${ANNOTATION_TYPES.join(', ')}`,
    };
  }

  if (!description || description.trim() === '') {
    return {
      success: false,
      logged: false,
      annotation_type,
      message: 'description is required and cannot be empty',
    };
  }

  // Auto-derive project path from session state or provided paths
  let resolvedPath = project_path || null;

  if (!resolvedPath && q_file_path) {
    resolvedPath = await deriveProjectPath(q_file_path);
  }

  if (!resolvedPath) {
    // Try session state
    const cwdPath = await deriveProjectPath(process.cwd());
    if (cwdPath) {
      const session = await getPhase6Session(cwdPath);
      if (session) {
        resolvedPath = cwdPath;
      }
    }
  }

  if (!resolvedPath) {
    return {
      success: false,
      logged: false,
      annotation_type,
      message: 'Could not determine project path. Provide project_path or q_file_path, or start a Phase 6 session first.',
    };
  }

  // Build input/output objects for the log entry
  const inputData: Record<string, unknown> = {
    annotation_type,
    description,
  };
  if (student_id) inputData.student_id = student_id;
  if (question_id) inputData.question_id = question_id;
  if (related_students?.length) inputData.related_students = related_students;
  if (original_value) inputData.original_value = original_value;
  if (adjusted_value) inputData.adjusted_value = adjusted_value;
  if (reasoning) inputData.reasoning = reasoning;

  await safeStateOperation(
    () => logWorkflowAction(
      resolvedPath!,
      6,
      'teacher_annotation',
      annotation_type,
      inputData,
      {
        logged: true,
      }
    ),
    'teacher_annotation logWorkflowAction'
  );

  return {
    success: true,
    logged: true,
    annotation_type,
    message: `Teacher annotation logged: ${annotation_type}`,
  };
}
