import { StatusManager } from '../core/status_manager.js';
import { StudentReader } from '../core/student_reader.js';
import { AssessmentParser } from '../core/assessment_parser.js';
import { Assessment } from '../types/assessment.js';
import {
  deriveProjectPath,
  logWorkflowAction,
  safeStateOperation,
} from '../shared/project_state_manager.js';

/**
 * Result from assessment_get
 */
export interface AssessmentGetResult {
  student: {
    id: string;
    wordCount: number;
    answer: string;
  };
  assessment: Assessment | null;
  rawBedömning: string | null;
  assessed: boolean;
}

/**
 * assessment_get - Read a specific student's assessment
 *
 * This tool:
 * 1. Finds the student by ID
 * 2. Returns student answer and metadata
 * 3. If assessed, returns parsed assessment and raw BEDÖMNING
 *
 * @param args.q_file_path - Path to Q-file
 * @param args.student_id - Student ID to retrieve
 * @returns AssessmentGetResult with student data and assessment
 */
export async function assessmentGet(args: {
  q_file_path: string;
  student_id: string;
}): Promise<AssessmentGetResult> {
  const { q_file_path, student_id } = args;

  const statusManager = new StatusManager();
  const studentReader = new StudentReader();
  const assessmentParser = new AssessmentParser();

  // 1. Check STATUS exists (session was started)
  if (!(await statusManager.hasStatus(q_file_path))) {
    throw new Error('No assessment session found. Use assessment_start first.');
  }

  // 2. Find student
  const student = await studentReader.findStudent(q_file_path, student_id);
  if (!student) {
    throw new Error(`Student ${student_id} not found in file`);
  }

  // 3. Get assessment if exists
  let assessment: Assessment | null = null;
  let rawBedömning: string | null = null;

  if (student.assessed) {
    const result = await assessmentParser.getAssessment(q_file_path, student_id);
    if (result) {
      assessment = result.assessment;
      rawBedömning = result.rawBedömning;
    }
  }

  // RFC-027: Log assessment retrieval for research timeline
  const projectPath = await deriveProjectPath(q_file_path);
  if (projectPath) {
    await safeStateOperation(
      () => logWorkflowAction(
        projectPath,
        6,
        'phase6_get',
        'assessment_get',
        { q_file_path, student_id },
        { assessed: student.assessed, success: true }
      ),
      'phase6_get logWorkflowAction'
    );
  }

  return {
    student: {
      id: student.id,
      wordCount: student.wordCount,
      answer: student.answer,
    },
    assessment,
    rawBedömning,
    assessed: student.assessed,
  };
}
