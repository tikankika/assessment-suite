import { StatusManager } from '../core/status_manager.js';
import { StudentReader } from '../core/student_reader.js';
import { RubricParser } from '../shared/rubric_parser.js';
import { debugLog } from '../core/debug.js';
import { StudentReadResult } from '../types/assessment.js';
import { calculateProgress } from '../types/status.js';
import {
  deriveProjectPath,
  getPhase6Session,
  logWorkflowAction,
  safeStateOperation,
  Phase6Session,
} from '../shared/project_state_manager.js';

/**
 * ADR-005 warning result (soft enforcement)
 */
export interface MethodologyWarningResult {
  warning: string;
  recommended_action: string;
  message: string;
  can_continue: boolean;
  student: null;
}

/**
 * assessment_read_next - Read the next unassessed student
 *
 * ADR-005: Auto-discovers q_file_path from session state if not provided.
 * Also warns (soft enforcement) if methodology has not been loaded.
 *
 * Returns:
 * - Student's complete answer (unabridged)
 * - Relevant rubric section for this question
 * - Progress status
 *
 * @param args.q_file_path - Path to Q-file (optional: auto-discovered from session state)
 * @returns StudentReadResult with student, rubric, progress (or warning if methodology not loaded)
 */
export async function assessmentReadNext(args: {
  q_file_path?: string;
  project_path?: string;
}): Promise<StudentReadResult | MethodologyWarningResult> {
  let { q_file_path } = args;

  // ADR-005: Auto-discover and enforce
  let projectPath: string | null = null;
  let session: Phase6Session | undefined;

  // Try to get session state (explicit project_path > derived from q_file_path > cwd)
  if (args.project_path) {
    projectPath = args.project_path;
  } else {
    projectPath = await deriveProjectPath(q_file_path || process.cwd());
  }
  if (projectPath) {
    session = await getPhase6Session(projectPath);

    // Auto-discover q_file_path if not provided
    if (!q_file_path && session?.assessment_file) {
      q_file_path = session.assessment_file;
      console.error('[assessment_read_next] ADR-005: Auto-discovered q_file_path from session:', q_file_path);
    }
  }

  // Per-student mode: delegate to separate handler
  if (session?.mode === 'per_student') {
    return assessmentReadNextPerStudent(session, projectPath!);
  }

  // Validate q_file_path (Q-file mode)
  if (!q_file_path) {
    throw new Error(
      'No q_file_path provided and none found in session state.\n' +
      'Either provide q_file_path or run phase6_start first.'
    );
  }

  // ADR-005: Soft enforcement - warn if methodology not loaded
  if (session && !session.methodology_loaded) {
    console.error('[assessment_read_next] ADR-005: Methodology not loaded - returning warning');
    return {
      warning: 'Methodology not yet loaded',
      recommended_action: 'phase6_methodology',
      message: 'Assessment methodology documents contain critical instructions.\n' +
               'Consider loading them before continuing.',
      can_continue: true,  // Soft enforcement - allows override
      student: null,
    };
  }

  const statusManager = new StatusManager();
  const studentReader = new StudentReader();
  const rubricParser = new RubricParser();

  // 1. Check STATUS exists
  if (!(await statusManager.hasStatus(q_file_path))) {
    throw new Error('No assessment session found. Use assessment_start first.');
  }

  // 2. Read STATUS
  const status = await statusManager.read(q_file_path);

  // 3. Get next unassessed student
  const students = await studentReader.parseStudents(q_file_path);
  const assessedCount = students.filter(s => s.assessed).length;
  const nextStudent = students.find(s => !s.assessed) || null;

  // 4. Calculate progress
  const totalStudents = status.totalStudents;
  const remaining = totalStudents - assessedCount;
  const progress = calculateProgress(assessedCount, totalStudents);

  // 5. Get rubric section if available
  let rubricSection = '';
  if (status.rubricFile) {
    const questionMatch = status.question.match(/(\d+)/);
    if (questionMatch) {
      const questionNumber = parseInt(questionMatch[1], 10);
      try {
        rubricSection = await rubricParser.getRubricSection(
          status.rubricFile,
          questionNumber
        );
      } catch {
        rubricSection = 'Rubric not available';
      }
    }
  }

  // If no rubric file, build from status aspects
  if (!rubricSection && status.aspects.length > 0) {
    rubricSection = buildAspectSummary(status.question, status.maxPoints, status.aspects);
  }

  // RFC-027: Log student read for research timeline
  if (projectPath) {
    await safeStateOperation(
      () => logWorkflowAction(
        projectPath!,
        6,
        'phase6_read_next',
        'student_read',
        {
          q_file_path,
          student_id: nextStudent?.id || null,
        },
        {
          word_count: nextStudent?.answer?.split(/\s+/).length || 0,
          progress,
          remaining,
        }
      ),
      'phase6_read_next logWorkflowAction'
    );
  }

  return {
    student: nextStudent,
    rubricSection,
    progress,
    remaining,
  };
}

/**
 * Per-student mode: find next unassessed student from session state.
 * Returns file path (not content) — Claude reads the PDF directly.
 */
async function assessmentReadNextPerStudent(
  session: Phase6Session,
  projectPath: string
): Promise<StudentReadResult | MethodologyWarningResult> {
  // Soft enforcement: warn if methodology not loaded
  if (!session.methodology_loaded) {
    return {
      warning: 'Methodology not yet loaded',
      recommended_action: 'phase6_methodology',
      message: 'Assessment methodology documents contain critical instructions.\nConsider loading them before continuing.',
      can_continue: true,
      student: null,
    };
  }

  const students = session.students || [];
  const totalStudents = students.length;
  const assessedCount = students.filter(s => s.assessed).length;
  const nextEntry = students.find(s => !s.assessed) || null;
  const remaining = totalStudents - assessedCount;
  const progress = calculateProgress(assessedCount, totalStudents);

  // Load rubric section
  let rubricSection = '';
  if (session.rubric_path) {
    try {
      const { promises: fs } = await import('fs');
      rubricSection = await fs.readFile(session.rubric_path, 'utf-8');
    } catch {
      rubricSection = 'Rubric not available';
    }
  }

  const nextStudent = nextEntry ? {
    id: nextEntry.id,
    index: students.indexOf(nextEntry),
    wordCount: 0,
    answer: `[Read PDF: ${nextEntry.source_file}]`,
    assessed: false,
  } : null;

  // Log
  if (projectPath) {
    await safeStateOperation(
      () => logWorkflowAction(
        projectPath, 6, 'phase6_read_next', 'per_student_read',
        { student_id: nextStudent?.id || null, mode: 'per_student' },
        { progress, remaining }
      ),
      'phase6_read_next_per_student logWorkflowAction'
    );
  }

  return { student: nextStudent, rubricSection, progress, remaining };
}

/**
 * Build aspect summary from status aspects
 */
function buildAspectSummary(
  question: string,
  maxPoints: number,
  aspects: Array<{ name: string; max: number }>
): string {
  const lines = [
    `## ${question} (${maxPoints}p)`,
    '',
    '### Aspekter:',
    ...aspects.map(a => `- **${a.name}**: max ${a.max}p`),
  ];

  return lines.join('\n');
}
