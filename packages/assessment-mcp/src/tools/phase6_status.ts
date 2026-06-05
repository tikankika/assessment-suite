import { StatusManager } from '../core/status_manager.js';
import { StudentReader } from '../core/student_reader.js';
import { debugLog } from '../core/debug.js';
import { calculateProgress } from '../types/status.js';
import {
  deriveProjectPath,
  getPhase6Session,
  logWorkflowAction,
  safeStateOperation,
} from '../shared/project_state_manager.js';

/**
 * Result of assessment_status
 */
export interface AssessmentStatusResult {
  status: {
    file: string;
    question: string;
    maxPoints: number;
    totalStudents: number;
    assessedCount: number;
    remaining: number;
    lastAssessedStudent: string | null;
    progress: string;
    date: string;
  };
  assessedStudents: string[];
  remainingStudents: string[];
  summary?: {
    mean: number;
    median: number;
    min: number;
    max: number;
  };
}

/**
 * assessment_status - Show current assessment progress
 *
 * ADR-005: Auto-discovers q_file_path from session state if not provided.
 *
 * @param args.q_file_path - Path to Q-file (optional: auto-discovered from session state)
 * @returns AssessmentStatusResult with detailed progress info
 */
export async function assessmentStatus(args: {
  q_file_path?: string;
  project_path?: string;
}): Promise<AssessmentStatusResult> {
  let { q_file_path } = args;

  // ADR-005: Auto-discover from session state (explicit project_path > derived)
  const projectPath = args.project_path || await deriveProjectPath(q_file_path || process.cwd());
  if (projectPath) {
    const session = await getPhase6Session(projectPath);

    // Per-student mode: return status from session state
    if (session?.mode === 'per_student') {
      return assessmentStatusPerStudent(session, projectPath);
    }

    if (!q_file_path && session?.assessment_file) {
      q_file_path = session.assessment_file;
      console.error('[assessment_status] ADR-005: Auto-discovered q_file_path from session:', q_file_path);
    }
  }

  if (!q_file_path) {
    throw new Error(
      'No q_file_path provided and none found in session state.\n' +
      'Either provide q_file_path or run phase6_start first.'
    );
  }

  const statusManager = new StatusManager();
  const studentReader = new StudentReader();

  // 1. Check STATUS exists
  if (!(await statusManager.hasStatus(q_file_path))) {
    throw new Error('No assessment session found. Use assessment_start first.');
  }

  // 2. Read STATUS
  const status = await statusManager.read(q_file_path);

  // 3. Parse students to get current state
  const students = await studentReader.parseStudents(q_file_path);
  const assessedStudents = students.filter(s => s.assessed).map(s => s.id);
  const remainingStudents = students.filter(s => !s.assessed).map(s => s.id);

  const assessedCount = assessedStudents.length;
  const remaining = remainingStudents.length;
  const progress = calculateProgress(assessedCount, status.totalStudents);

  // 4. Build result
  const result: AssessmentStatusResult = {
    status: {
      file: status.file,
      question: status.question,
      maxPoints: status.maxPoints,
      totalStudents: status.totalStudents,
      assessedCount,
      remaining,
      lastAssessedStudent: status.lastAssessedStudent,
      progress,
      date: status.date,
    },
    assessedStudents,
    remainingStudents,
  };

  // 5. Calculate summary statistics if partially complete
  if (assessedCount > 0) {
    const scores = await extractScores(q_file_path, assessedStudents);
    if (scores.length > 0) {
      result.summary = calculateSummary(scores);
    }
  }

  // RFC-027: Log status check for research timeline
  const stateProjectPath = await deriveProjectPath(q_file_path);
  if (stateProjectPath) {
    await safeStateOperation(
      () => logWorkflowAction(
        stateProjectPath,
        6,
        'phase6_status',
        'status_check',
        {
          q_file_path,
        },
        {
          assessed_count: assessedCount,
          remaining,
          progress,
        }
      ),
      'phase6_status logWorkflowAction'
    );
  }

  return result;
}

/**
 * Per-student mode: Return status from session state.
 */
async function assessmentStatusPerStudent(
  session: import('../shared/project_state_manager.js').Phase6Session,
  projectPath: string
): Promise<AssessmentStatusResult> {
  const students = session.students || [];
  const assessedStudents = students.filter(s => s.assessed).map(s => s.id);
  const remainingStudents = students.filter(s => !s.assessed).map(s => s.id);
  const assessedCount = assessedStudents.length;
  const remaining = remainingStudents.length;
  const totalStudents = students.length;
  const progress = calculateProgress(assessedCount, totalStudents);
  const today = new Date().toISOString().split('T')[0];

  await safeStateOperation(
    () => logWorkflowAction(
      projectPath, 6, 'phase6_status', 'per_student_status_check',
      { mode: 'per_student' },
      { assessed_count: assessedCount, remaining, progress }
    ),
    'phase6_status_per_student logWorkflowAction'
  );

  return {
    status: {
      file: session.student_files_dir || 'per_student',
      question: session.current_question || 'Per-student assessment',
      maxPoints: 0,
      totalStudents,
      assessedCount,
      remaining,
      lastAssessedStudent: assessedStudents[assessedStudents.length - 1] || null,
      progress,
      date: today,
    },
    assessedStudents,
    remainingStudents,
  };
}

/**
 * Extract scores from assessed students
 * (Parses BEDÖMNING sections to find TOTALPOÄNG)
 */
async function extractScores(
  filePath: string,
  studentIds: string[]
): Promise<number[]> {
  try {
    const { promises: fs } = await import('fs');
    const content = await fs.readFile(filePath, 'utf-8');

    const scores: number[] = [];

    // Pattern: **TOTALPOÄNG: 2.5/5p** or **TOTAL: 2.5/5p**
    const scorePattern = /\*\*(?:TOTALPOÄNG|TOTAL):\s*([\d.,]+)\s*\/\s*[\d.,]+p\*\*/g;

    let match;
    while ((match = scorePattern.exec(content)) !== null) {
      const score = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(score)) {
        scores.push(score);
      }
    }

    return scores;
  } catch (err) {
    console.error(`[phase6_status] Warning: Failed to extract scores from ${filePath}: ${err}`);
    return [];
  }
}

/**
 * Calculate summary statistics
 */
function calculateSummary(scores: number[]): {
  mean: number;
  median: number;
  min: number;
  max: number;
} {
  const sorted = [...scores].sort((a, b) => a - b);
  const sum = scores.reduce((a, b) => a + b, 0);

  const mean = sum / scores.length;
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  return {
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}
