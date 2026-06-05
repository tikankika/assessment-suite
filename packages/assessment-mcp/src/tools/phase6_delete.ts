import { AssessmentWriter } from '../core/assessment_writer.js';
import { StudentReader } from '../core/student_reader.js';
import { debugLog } from '../core/debug.js';
import {
  deriveProjectPath,
  logWorkflowAction,
  safeStateOperation,
} from '../shared/project_state_manager.js';

/**
 * assessment_delete - Remove an existing assessment for a student
 *
 * This tool allows explicitly removing an assessment without writing a new one.
 * Useful for:
 * - Cleaning up duplicate assessments
 * - Resetting a student for re-assessment
 * - Fixing errors
 *
 * RFC-025: Exposed removeAssessment as MCP tool
 *
 * @param args.q_file_path - Path to Q-file
 * @param args.student_id - Student ID to remove assessment for
 * @returns Success status and student info
 */
export async function assessmentDelete(args: {
  q_file_path: string;
  student_id: string;
}): Promise<{
  success: boolean;
  removed: boolean;
  student_id: string;
  message: string;
}> {
  const { q_file_path, student_id } = args;

  debugLog('[assessment_delete] START ========================');
  debugLog('[assessment_delete] q_file_path:', q_file_path);
  debugLog('[assessment_delete] student_id:', student_id);

  const assessmentWriter = new AssessmentWriter();
  const studentReader = new StudentReader();

  // 1. Check file exists
  if (!(await studentReader.fileExists(q_file_path))) {
    return {
      success: false,
      removed: false,
      student_id,
      message: `File not found: ${q_file_path}`,
    };
  }

  // 2. Check student exists
  const student = await studentReader.findStudent(q_file_path, student_id);
  if (!student) {
    return {
      success: false,
      removed: false,
      student_id,
      message: `Student ${student_id} not found in file`,
    };
  }

  // 3. Check if student has assessment
  if (!student.assessed) {
    return {
      success: true,
      removed: false,
      student_id,
      message: `Student ${student_id} has no assessment to remove`,
    };
  }

  // 4. Remove assessment
  debugLog('[assessment_delete] Removing assessment...');
  const removed = await assessmentWriter.removeAssessment(q_file_path, student_id);

  // RFC-027: Log assessment delete for research timeline
  const stateProjectPath = await deriveProjectPath(q_file_path);
  if (stateProjectPath) {
    await safeStateOperation(
      () => logWorkflowAction(
        stateProjectPath,
        6,
        'phase6_delete',
        'assessment_delete',
        {
          q_file_path,
          student_id,
        },
        {
          removed,
        }
      ),
      'phase6_delete logWorkflowAction'
    );
  }

  if (removed) {
    debugLog('[assessment_delete] SUCCESS - Assessment removed');
    return {
      success: true,
      removed: true,
      student_id,
      message: `Successfully removed assessment for ${student_id}`,
    };
  } else {
    debugLog('[assessment_delete] WARNING - removeAssessment returned false');
    return {
      success: true,
      removed: false,
      student_id,
      message: `No assessment block found to remove for ${student_id}`,
    };
  }
}
