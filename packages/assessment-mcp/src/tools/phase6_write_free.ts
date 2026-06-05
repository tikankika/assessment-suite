import { StatusManager } from '../core/status_manager.js';
import { StudentReader } from '../core/student_reader.js';
import { AssessmentWriter } from '../core/assessment_writer.js';
import { SummaryWriter } from '../core/summary_writer.js';
import { debugLog } from '../core/debug.js';
import { AssessmentWriteResult } from '../types/assessment.js';
import { calculateProgress } from '../types/status.js';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import {
  deriveProjectPath,
  getPhase6Session,
  updatePhase6Session,
  markPhaseComplete,
  logWorkflowAction,
  updateSources,
  safeStateOperation,
  Phase6Session,
} from '../shared/project_state_manager.js';

/**
 * assessment_write_free - Write a free-text assessment (no structured validation)
 *
 * This tool:
 * 1. Validates that text is non-empty (minimal validation)
 * 2. Inserts BEDÖMNING section after student's answer
 * 3. Adds machine-readable metadata block if total_points is provided
 * 4. Updates ASSESSMENT-STATUS
 * 5. Returns next unassessed student automatically
 *
 * Unlike assessment_write, this tool does NOT require structured aspects.
 * Claude Desktop writes whatever text comes from the dialogue with the teacher.
 *
 * NEW: If total_points/max_points are provided, a PHASE6_ASSESSMENT metadata
 * block is added for reliable Phase 7 parsing.
 *
 * @param args.q_file_path - Path to Q-file (optional: auto-resolved from session state)
 * @param args.student_id - Student ID to assess
 * @param args.bedomning_text - Free-form assessment text from Claude Desktop
 * @param args.total_points - Optional: Total points awarded (enables Phase 7 metadata)
 * @param args.max_points - Optional: Maximum possible points for this question
 * @param args.overwrite - Optional: Set to true to replace existing BEDÖMNING
 * @returns AssessmentWriteResult with success status and next student
 *
 * @see docs/rfcs/002-free-text-assessment.md
 */
export async function assessmentWriteFree(args: {
  q_file_path?: string;
  project_path?: string;
  student_id: string;
  bedomning_text: string;
  total_points?: number;
  max_points?: number;
  overwrite?: boolean;
}): Promise<AssessmentWriteResult> {
  let { q_file_path } = args;
  const { student_id, bedomning_text, total_points, max_points, overwrite = false } = args;

  // ADR-005: Auto-resolve assessment file from session state
  const projectPath = args.project_path || await deriveProjectPath(q_file_path || process.cwd());
  let session: Awaited<ReturnType<typeof getPhase6Session>> = undefined;
  if (projectPath) {
    session = await getPhase6Session(projectPath);
    if (!q_file_path && session?.assessment_file) {
      q_file_path = session.assessment_file;
      console.error('[assessment_write_free] ADR-005: Auto-discovered q_file_path from session:', q_file_path);
    } else if (q_file_path && session?.assessment_file
               && q_file_path === session.original_file) {
      console.error('[assessment_write_free] ADR-005: Redirecting to dated copy:', session.assessment_file);
      q_file_path = session.assessment_file;
    }
  }

  // Per-student mode: delegate to separate handler
  if (session?.mode === 'per_student' && projectPath) {
    return assessmentWriteFreePerStudent(
      session, projectPath, student_id, bedomning_text,
      total_points, max_points, overwrite
    );
  }

  if (!q_file_path) {
    throw new Error(
      'No q_file_path provided and none found in session state.\n' +
      'Either provide q_file_path or run assessment_start first.'
    );
  }

  debugLog('[assessment_write_free] START ========================');
  debugLog('[assessment_write_free] q_file_path:', q_file_path);
  debugLog('[assessment_write_free] student_id:', student_id);
  debugLog('[assessment_write_free] overwrite:', overwrite);
  debugLog('[assessment_write_free] bedomning_text length:', bedomning_text?.length);
  debugLog('[assessment_write_free] total_points:', total_points);
  debugLog('[assessment_write_free] max_points:', max_points);

  // Minimal validation - only check non-empty
  if (!bedomning_text || bedomning_text.trim() === '') {
    debugLog('[assessment_write_free] ERROR: Empty bedomning_text');
    throw new Error('bedomning_text cannot be empty');
  }

  const statusManager = new StatusManager();
  const studentReader = new StudentReader();
  const assessmentWriter = new AssessmentWriter();

  // RFC-029 §14.4 R7: Get assessor from session state for metadata
  const sessionAssessor = session?.assessor || 'unknown';

  try {

  // 1. Check STATUS exists
  debugLog('[assessment_write_free] Step 1: Checking STATUS exists...');
  if (!(await statusManager.hasStatus(q_file_path))) {
    debugLog('[assessment_write_free] ERROR: No assessment session found');
    throw new Error('No assessment session found. Use assessment_start first.');
  }
  debugLog('[assessment_write_free] Step 1: OK - STATUS exists');

  // 2. Validate student exists
  debugLog('[assessment_write_free] Step 2: Finding student...');
  const student = await studentReader.findStudent(q_file_path, student_id);
  if (!student) {
    debugLog('[assessment_write_free] ERROR: Student not found:', student_id);
    throw new Error(`Student ${student_id} not found in file`);
  }
  debugLog('[assessment_write_free] Step 2: OK - Student found:', student.id, 'index:', student.index);

  // 3. Check not already assessed (unless overwrite is true)
  debugLog('[assessment_write_free] Step 3: Checking if already assessed...');
  if (student.assessed && !overwrite) {
    debugLog('[assessment_write_free] ERROR: Student already assessed');
    throw new Error(
      `Student ${student_id} already has BEDÖMNING. ` +
      'Set overwrite: true to replace the existing assessment.'
    );
  }
  debugLog('[assessment_write_free] Step 3: OK - Student not yet assessed or overwrite=true');

  // 4. If overwriting, remove existing BEDÖMNING first
  if (student.assessed && overwrite) {
    debugLog('[assessment_write_free] Step 4: Removing existing BEDÖMNING...');
    await assessmentWriter.removeAssessment(q_file_path, student_id);
    debugLog('[assessment_write_free] Step 4: OK - Existing BEDÖMNING removed');
  }

  // 5. Write free-text BEDÖMNING section
  debugLog('[assessment_write_free] Step 5: Writing free-text BEDÖMNING section...');
  // Build metadata for Phase 7 parsing
  // RFC-029 §14.4 R7: Always pass session assessor for traceability
  const metadata = {
    total_points: total_points ?? undefined,
    max_points: max_points ?? undefined,
    assessed_by: sessionAssessor,
  };

  const writeResult = await assessmentWriter.writeFreetextAssessment(
    q_file_path,
    student_id,
    bedomning_text,
    metadata
  );
  debugLog('[assessment_write_free] Step 5: writeFreetextAssessment returned:', JSON.stringify(writeResult));

  // 6. Re-parse students (file was modified by writeFreetextAssessment) and update STATUS
  debugLog('[assessment_write_free] Step 6: Updating STATUS...');
  const updatedStudents = await studentReader.parseStudents(q_file_path);
  const totalStudents = updatedStudents.length;
  await statusManager.update(q_file_path, student_id, student.index, totalStudents);
  debugLog('[assessment_write_free] Step 6: OK - STATUS updated');

  // 7. Summary update DEFERRED to step 9 (only when question complete)
  // PERFORMANCE FIX: Summary regeneration reads ALL Q-files - too slow per-student
  // especially on network drives like Nextcloud
  debugLog('[assessment_write_free] Step 7: Summary deferred to question completion');

  // 8. Get next unassessed student (reuse parsed students from step 6)
  debugLog('[assessment_write_free] Step 8: Getting next unassessed student...');
  const assessedCount = updatedStudents.filter(s => s.assessed).length;
  const nextStudent = updatedStudents.find(s => !s.assessed) || null;
  const progress = calculateProgress(assessedCount, totalStudents);
  debugLog('[assessment_write_free] Step 8: assessedCount:', assessedCount, 'nextStudent:', nextStudent?.id || 'none');

  // 9. Update project state tracking
  const stateProjectPath = await deriveProjectPath(q_file_path);
  if (stateProjectPath) {
    // Log each assessment write
    await safeStateOperation(
      () => logWorkflowAction(
        stateProjectPath,
        6,
        'phase6_write_free',
        'assessment_write_free',
        {
          q_file_path,
          student_id,
          overwrite,
        },
        {
          text_length: bedomning_text.length,
          total_points: total_points ?? null,
          max_points: max_points ?? null,
          progress,
          has_next_student: !!nextStudent,
          success: true,
        }
      ),
      'phase6_write_free logWorkflowAction'
    );

    // Mark phase as complete when all students assessed
    if (!nextStudent) {
      await safeStateOperation(
        () => markPhaseComplete(stateProjectPath, 6, '6_assessment', {
          total_students_assessed: assessedCount,
          q_file: q_file_path.split('/').pop(),
        }),
        'phase6_write_free markPhaseComplete'
      );

      // LAZY SUMMARY: Only update when question is complete (not per-student)
      debugLog('[assessment_write_free] Step 9b: Updating summary (question complete)...');
      try {
        const summaryWriter = new SummaryWriter();
        await summaryWriter.writeSummary(q_file_path);
        debugLog('[assessment_write_free] Step 9b: OK - Summary updated');
      } catch (summaryError) {
        debugLog('[assessment_write_free] Step 9b: WARNING - Summary update failed:', summaryError);
      }

      // Update sources.yaml with assessment summary
      await safeStateOperation(
        () => updateSources(stateProjectPath, 'assessment_summary', {
          type: 'markdown',
          copied_to: 'Assessment_Status_Summary.md',
          note: 'Assessment status summary - Phase 6',
        }),
        'phase6_write_free updateSources'
      );
    }
  }

  debugLog('[assessment_write_free] SUCCESS - returning result');
  debugLog('[assessment_write_free] END ==========================');

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
    // RFC-029 §14.3 R3: Log error for diagnostics
    debugLog('[assessment_write_free] ERROR:', error);
    throw error;
  }
}


/**
 * Per-student mode: Write assessment to a standalone BEDÖMNING file.
 * Creates 06_analytic_assessment/BEDÖMNING_{student_id}.md
 */
async function assessmentWriteFreePerStudent(
  session: Phase6Session,
  projectPath: string,
  studentId: string,
  bedomningText: string,
  totalPoints?: number,
  maxPoints?: number,
  overwrite: boolean = false
): Promise<AssessmentWriteResult> {
  debugLog('[assessment_write_free_per_student] START');

  if (!bedomningText || bedomningText.trim() === '') {
    throw new Error('bedomning_text cannot be empty');
  }

  const students = session.students || [];
  const studentEntry = students.find(s => s.id === studentId);

  if (!studentEntry) {
    throw new Error(
      `Student ${studentId} not found in session. Available: ${students.map(s => s.id).join(', ')}`
    );
  }

  if (studentEntry.assessed && !overwrite) {
    throw new Error(
      `Student ${studentId} already has BEDÖMNING. Set overwrite: true to replace.`
    );
  }

  // Build output file path
  const outputDir = session.assessment_output_dir || path.join(projectPath, '06_analytic_assessment');
  await fsPromises.mkdir(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `BEDÖMNING_${studentId}.md`);

  // Build v2 format with YAML frontmatter + markers
  const assessedAt = new Date().toISOString();
  const assessedBy = session.assessor || 'unknown';

  const content = `---
student_id: "${studentId}"
source_file: "${studentEntry.source_file}"
rubric: "${session.rubric_path || ''}"
assessor: "${assessedBy}"
assessed_at: "${assessedAt}"
format_version: 2
${totalPoints !== undefined ? `total_points: ${totalPoints}` : ''}
${maxPoints !== undefined ? `max_points: ${maxPoints}` : ''}
---

<!-- PHASE6_ASSESSMENT_START student_id="${studentId}" -->
### BEDÖMNING: ${studentId}

${bedomningText.trim()}

<!-- PHASE6_ASSESSMENT
student_id: ${studentId}
total_points: ${totalPoints ?? 'null'}
max_points: ${maxPoints ?? 'null'}
assessed_by: ${assessedBy}
assessed_at: ${assessedAt}
format_version: 2
-->
<!-- PHASE6_ASSESSMENT_END -->
`;

  await fsPromises.writeFile(outputFile, content, 'utf-8');
  debugLog('[assessment_write_free_per_student] Written:', outputFile);

  // Update session state
  studentEntry.assessed = true;
  studentEntry.assessment_file = outputFile;

  const assessedCount = students.filter(s => s.assessed).length;
  const nextEntry = students.find(s => !s.assessed) || null;
  const progress = calculateProgress(assessedCount, students.length);

  await safeStateOperation(
    () => updatePhase6Session(projectPath, {
      students,
      total_students: students.length,
    }),
    'assessment_write_free_per_student: update session'
  );

  // Log
  await safeStateOperation(
    () => logWorkflowAction(
      projectPath, 6, 'phase6_write_free', 'per_student_assessment_write',
      { student_id: studentId, mode: 'per_student' },
      { output_file: outputFile, progress, success: true }
    ),
    'assessment_write_free_per_student logWorkflowAction'
  );

  // Mark phase complete if all done
  if (!nextEntry) {
    await safeStateOperation(
      () => markPhaseComplete(projectPath, 6, '6_assessment', {
        total_students_assessed: assessedCount,
        mode: 'per_student',
      }),
      'assessment_write_free_per_student markPhaseComplete'
    );
  }

  const nextStudent = nextEntry ? {
    id: nextEntry.id,
    index: students.indexOf(nextEntry),
    wordCount: 0,
    answer: `[Read PDF: ${nextEntry.source_file}]`,
    assessed: false,
  } : null;

  const result: AssessmentWriteResult = {
    success: true,
    studentId,
    progress,
    nextStudent,
  };

  if (!nextEntry) {
    result.tip = 'All students assessed! Consider Phase 9 for hermeneutic synthesis.';
  }

  return result;
}
