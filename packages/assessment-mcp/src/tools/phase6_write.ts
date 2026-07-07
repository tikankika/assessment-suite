import { promises as fs } from 'fs';
import { StatusManager } from '../core/status_manager.js';
import { StudentReader } from '../core/student_reader.js';
import { AssessmentWriter } from '../core/assessment_writer.js';
import { SummaryWriter } from '../core/summary_writer.js';
import { debugLog } from '../core/debug.js';
import { Assessment, AssessmentWriteResult, Student } from '../types/assessment.js';
import { calculateProgress } from '../types/status.js';
import {
  deriveProjectPath,
  getPhase6Session,
  markPhaseComplete,
  logWorkflowAction,
  updateSources,
  safeStateOperation,
} from '../shared/project_state_manager.js';

/**
 * assessment_write - Write a teacher-confirmed assessment
 *
 * This tool:
 * 1. Validates the assessment data
 * 2. Inserts BEDÖMNING section after student's answer
 * 3. Updates ASSESSMENT-STATUS
 * 4. Returns next unassessed student automatically
 *
 * @param args.q_file_path - Path to Q-file (optional: auto-resolved from session state)
 * @param args.student_id - Student ID to assess
 * @param args.assessment - Assessment data (aspects, points, feedback)
 * @param args.overwrite - Optional: Set to true to replace existing BEDÖMNING
 * @returns AssessmentWriteResult with success status and next student
 */
export async function assessmentWrite(args: {
  q_file_path?: string;
  student_id: string;
  assessment: Assessment;
  overwrite?: boolean;
}): Promise<AssessmentWriteResult> {
  let { q_file_path } = args;
  const { student_id, assessment, overwrite = false } = args;

  // ADR-005: Auto-resolve assessment file from session state
  const projectPath = await deriveProjectPath(q_file_path || process.cwd());
  let session: Awaited<ReturnType<typeof getPhase6Session>> = undefined;
  if (projectPath) {
    session = await getPhase6Session(projectPath);
    if (!q_file_path && session?.assessment_file) {
      q_file_path = session.assessment_file;
      console.error('[assessment_write] ADR-005: Auto-discovered q_file_path from session:', q_file_path);
    } else if (q_file_path && session?.assessment_file
               && q_file_path === session.original_file) {
      console.error('[assessment_write] ADR-005: Redirecting to dated copy:', session.assessment_file);
      q_file_path = session.assessment_file;
    }
  }

  // Per-student (lab-report) mode is not yet supported in v1: its assessment_file
  // is a directory, which made the status check fail with an opaque error. Fail
  // clearly instead. (Full per-student support is tracked for a later version.)
  if (session?.mode === 'per_student') {
    throw new Error('Per-student assessment is not yet supported in v1.');
  }

  if (!q_file_path) {
    throw new Error(
      'No q_file_path provided and none found in session state.\n' +
      'Either provide q_file_path or run assessment_start first.'
    );
  }

  debugLog('[assessment_write] START ========================');
  debugLog('[assessment_write] q_file_path:', q_file_path);
  debugLog('[assessment_write] student_id:', student_id);
  debugLog('[assessment_write] overwrite:', overwrite);
  debugLog('[assessment_write] assessment.totalPoints:', assessment.totalPoints);
  debugLog('[assessment_write] assessment.aspects.length:', assessment.aspects?.length);

  const statusManager = new StatusManager();
  const studentReader = new StudentReader();
  const assessmentWriter = new AssessmentWriter();

  try {

  // Read the pre-write Q-file once; steps 1 and 2 both inspect this same
  // unmodified content (the STATUS check and the student lookup), so a single
  // read serves both. If the file is unreadable, leave content undefined and
  // let hasStatus fall back to its own read+catch, preserving the exact
  // "no session" error below rather than surfacing a raw filesystem error.
  let preWriteContent: string | undefined;
  try {
    preWriteContent = await fs.readFile(q_file_path, 'utf-8');
  } catch {
    preWriteContent = undefined;
  }

  // 1. Check STATUS exists
  debugLog('[assessment_write] Step 1: Checking STATUS exists...');
  if (!(await statusManager.hasStatus(q_file_path, preWriteContent))) {
    debugLog('[assessment_write] ERROR: No assessment session found');
    throw new Error('No assessment session found. Use assessment_start first.');
  }
  debugLog('[assessment_write] Step 1: OK - STATUS exists');

  // 2. Validate student exists (reuse the content read above)
  debugLog('[assessment_write] Step 2: Finding student...');
  const student = await studentReader.findStudent(q_file_path, student_id, preWriteContent);
  if (!student) {
    debugLog('[assessment_write] ERROR: Student not found:', student_id);
    throw new Error(`Student ${student_id} not found in file`);
  }
  debugLog('[assessment_write] Step 2: OK - Student found:', student.id, 'index:', student.index);

  // 3. Check not already assessed (unless overwrite is true)
  debugLog('[assessment_write] Step 3: Checking if already assessed...');
  if (student.assessed && !overwrite) {
    debugLog('[assessment_write] ERROR: Student already assessed');
    throw new Error(
      `Student ${student_id} already has BEDÖMNING. ` +
      'Set overwrite: true to replace the existing assessment.'
    );
  }
  debugLog('[assessment_write] Step 3: OK - Student not yet assessed or overwrite=true');

  // 4. If overwriting, remove existing BEDÖMNING first
  if (student.assessed && overwrite) {
    debugLog('[assessment_write] Step 4: Removing existing BEDÖMNING...');
    await assessmentWriter.removeAssessment(q_file_path, student_id);
    debugLog('[assessment_write] Step 4: OK - Existing BEDÖMNING removed');
  }

  // 5. Validate assessment data
  debugLog('[assessment_write] Step 5: Validating assessment data...');
  validateAssessment(assessment);
  debugLog('[assessment_write] Step 5: OK - Assessment data valid');

  // 6. Write BEDÖMNING section
  debugLog('[assessment_write] Step 6: Writing BEDÖMNING section...');
  // RFC-029 §14.4 R7: Pass session assessor for v2 metadata traceability
  const writeResult = await assessmentWriter.writeAssessment(q_file_path, student_id, assessment, session?.assessor);
  debugLog('[assessment_write] Step 6: writeAssessment returned:', JSON.stringify(writeResult));

  // 7. Re-parse students (file was modified by writeAssessment) and update STATUS
  debugLog('[assessment_write] Step 7: Updating STATUS...');
  const updatedStudents = await studentReader.parseStudents(q_file_path);
  const totalStudents = updatedStudents.length;
  await statusManager.update(q_file_path, student_id, student.index, totalStudents);
  debugLog('[assessment_write] Step 7: OK - STATUS updated');

  // 8. Auto-update summary document (RFC-003)
  debugLog('[assessment_write] Step 8: Updating summary document...');
  try {
    const summaryWriter = new SummaryWriter();
    await summaryWriter.writeSummary(q_file_path);
    debugLog('[assessment_write] Step 8: OK - Summary updated');
  } catch (summaryError) {
    // Log but don't fail - summary is optional enhancement
    debugLog('[assessment_write] Step 8: WARNING - Summary update failed:', summaryError);
  }

  // 9. Get next unassessed student (reuse parsed students from step 7)
  debugLog('[assessment_write] Step 9: Getting next unassessed student...');
  const assessedCount = updatedStudents.filter(s => s.assessed).length;
  const nextStudent = updatedStudents.find(s => !s.assessed) || null;
  const progress = calculateProgress(assessedCount, totalStudents);
  debugLog('[assessment_write] Step 9: assessedCount:', assessedCount, 'nextStudent:', nextStudent?.id || 'none');

  // 10. Update project state tracking
  const stateProjectPath = await deriveProjectPath(q_file_path);
  if (stateProjectPath) {
    // Log each assessment write
    await safeStateOperation(
      () => logWorkflowAction(
        stateProjectPath,
        6,
        'phase6_write',
        'assessment_write',
        {
          q_file_path,
          student_id,
          overwrite,
        },
        {
          total_points: assessment.totalPoints,
          max_points: assessment.maxPoints,
          aspects: assessment.aspects.map(a => ({
            name: a.name,
            symbol: a.symbol,
            points: a.points,
          })),
          progress,
          has_next_student: !!nextStudent,
          success: true,
        }
      ),
      'phase6_write logWorkflowAction'
    );

    // Mark phase as complete when all students assessed
    if (!nextStudent) {
      await safeStateOperation(
        () => markPhaseComplete(stateProjectPath, 6, '6_assessment', {
          total_students_assessed: assessedCount,
          q_file: q_file_path.split('/').pop(),
        }),
        'phase6_write markPhaseComplete'
      );

      // Update sources.yaml with assessment summary
      await safeStateOperation(
        () => updateSources(stateProjectPath, 'assessment_summary', {
          type: 'markdown',
          copied_to: 'Assessment_Status_Summary.md',
          note: 'Assessment status summary - Phase 6',
        }),
        'phase6_write updateSources'
      );
    }
  }

  debugLog('[assessment_write] SUCCESS - returning result');
  debugLog('[assessment_write] END ==========================');

  const result: AssessmentWriteResult = {
    success: true,
    studentId: student_id,
    progress,
    nextStudent,
  };

  // Subtle hint when question is complete (all students assessed)
  if (!nextStudent) {
    result.tip =
      'All students assessed! Consider using insights_save ' +
      'to document any patterns or pedagogical observations.';
  }

  return result;

  } catch (error) {
    // RFC-029 §14.3 R2: Log error for diagnostics
    debugLog('[assessment_write] ERROR:', error);
    throw error;
  }
}

/**
 * Validate assessment data
 */
function validateAssessment(assessment: Assessment): void {
  if (!assessment.aspects || assessment.aspects.length === 0) {
    throw new Error('Assessment must have at least one aspect');
  }

  // Check all aspects have required fields
  for (const aspect of assessment.aspects) {
    if (!aspect.name) {
      throw new Error('Each aspect must have a name');
    }
    if (!aspect.symbol) {
      throw new Error(`Aspect "${aspect.name}" is missing quality symbol`);
    }
    if (typeof aspect.points !== 'number') {
      throw new Error(`Aspect "${aspect.name}" must have numeric points`);
    }
  }

  // Check total points match sum
  const sum = assessment.aspects.reduce((total, a) => total + a.points, 0);
  if (Math.abs(sum - assessment.totalPoints) > 0.01) {
    throw new Error(
      `Total points (${assessment.totalPoints}) don't match sum of aspects (${sum})`
    );
  }

  // nextStep presence is a pedagogical decision — enforced by methodology, not code.
}
