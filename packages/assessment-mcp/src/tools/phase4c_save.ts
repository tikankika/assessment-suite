import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { load } from 'js-yaml';
import { ExamConfig } from '../shared/exam_config_reader.js';
import { MethodologyLoader } from '../core/methodology_loader.js';
import {
  deriveProjectPath,
  markPhaseInProgress,
  markPhaseComplete,
  markPhaseIncomplete,
  logWorkflowAction,
  updateSources,
  safeStateOperation,
} from '../shared/project_state_manager.js';
import { FOLDERS } from '../shared/folder_constants.js';

/**
 * Phase 4C: Student Report Tool
 *
 * Creates a simple per-student completion report showing:
 * - Which students answered which questions
 * - Word counts and warnings for short answers
 * - Completion rates
 *
 * TWO-PHASE WORKFLOW:
 * 1. LOAD mode: Returns student files + methodology → Claude analyzes
 * 2. SAVE mode: Writes student_report.md
 *
 * @see methodology/phase4c_student_report.md
 */

// ============================================================================
// Input/Output Types
// ============================================================================

export interface Phase4cSaveInput {
  project_path: string;
  mode: 'load' | 'save';
  // SAVE mode parameters
  report_content?: string;
}

// Student question data
export interface StudentQuestionData {
  words: number;
  status: string;
  points: number;
}

// Per-student analyzed data
export interface StudentData {
  questions: Record<string, StudentQuestionData>;
  total_answered: number;
  total_questions: number;
}

// LOAD mode output
export interface Phase4cLoadOutput {
  mode: 'load';
  students_data: Record<string, StudentData>;
  total_students: number;
  methodology: string;
  instructions: string;
}

// SAVE mode output
export interface Phase4cSaveOutput {
  mode: 'save';
  success: boolean;
  report_path: string;
  summary: {
    total_students: number;
    report_file: string;
  };
}

export type Phase4cOutput = Phase4cLoadOutput | Phase4cSaveOutput;

// ============================================================================
// Main Entry Point
// ============================================================================

export async function phase4cSave(
  input: Phase4cSaveInput
): Promise<Phase4cOutput> {
  const { project_path, mode } = input;

  if (mode === 'save') {
    return handleSaveMode(input);
  }

  return handleLoadMode(project_path);
}

// ============================================================================
// LOAD Mode
// ============================================================================

async function handleLoadMode(project_path: string): Promise<Phase4cLoadOutput> {
  // Find student files
  const studentAnswersPath = join(project_path, FOLDERS.PHASE2_MARKDOWN, 'student_answers');

  const studentsData: Record<string, StudentData> = {};

  // Read total questions from exam_config.yaml
  let totalQuestions = 0;
  try {
    const configPath = join(project_path, 'exam_config.yaml');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = load(configContent) as Partial<ExamConfig>;
    totalQuestions = config?.questions?.length || 0;
  } catch {
    // Fallback: will be calculated from student data
  }

  try {
    const files = await fs.readdir(studentAnswersPath);
    const studentFiles = files
      .filter(f => f.endsWith('.md'))
      .map(f => join(studentAnswersPath, f));

    // Analyze each student file
    for (const filepath of studentFiles) {
      const studentId = basename(filepath, '.md');
      const content = await fs.readFile(filepath, 'utf-8');

      // Extract question answers and word counts
      // Pattern: Question X (Xp) ... Ord: XX
      const pattern = /Question (\d+) \((\d+)p\).*?Ord: (\d+)/gs;
      const questions: Record<string, StudentQuestionData> = {};
      let match;

      while ((match = pattern.exec(content)) !== null) {
        const [, qNum, points, words] = match;
        const qId = `Q${parseInt(qNum, 10).toString().padStart(3, '0')}`;
        const wordCount = parseInt(words, 10);

        // Determine status based on word count
        let status: string;
        if (wordCount >= 40) {
          status = 'Answered';
        } else if (wordCount >= 30) {
          status = 'Short';
        } else if (wordCount >= 20) {
          status = 'Very short';
        } else {
          status = 'Extremely short';
        }

        questions[qId] = {
          words: wordCount,
          status: status,
          points: parseInt(points, 10),
        };
      }

      studentsData[studentId] = {
        questions: questions,
        total_answered: Object.keys(questions).length,
        total_questions: totalQuestions,
      };
    }
  } catch (error) {
    // Directory might not exist yet
  }

  // Load methodology
  const methodologyLoader = new MethodologyLoader();
  const methodology = await methodologyLoader.loadPhase4CSave();

  const totalStudents = Object.keys(studentsData).length;

  const instructions = `
## Phase 4C: Student Report - LOAD Mode

Du har fått föranalyserad data för ${totalStudents} studenter.

### students_data struktur:
- Varje student har: questions, total_answered, total_questions
- Varje fråga har: words, status, points
- Status: "Answered" (40+), "Short" (30-39), "Very short" (20-29), "Extremely short" (<20)

### Din uppgift:

Skapa en markdown-rapport från students_data med:
1. **Sammanfattning** - Antal studenter, completion rate
2. **Per student** - Lista frågor med ordantal och status
3. **Varningar** - Flagga studenter med korta svar

### När du är klar:

Kalla phase4c_student_report med mode="save" och report_content=[din rapport]
`;

  return {
    mode: 'load',
    students_data: studentsData,
    total_students: totalStudents,
    methodology: methodology,
    instructions: instructions,
  };
}

// ============================================================================
// SAVE Mode
// ============================================================================

async function handleSaveMode(
  input: Phase4cSaveInput
): Promise<Phase4cSaveOutput> {
  const { project_path, report_content } = input;
  const startTime = performance.now();

  if (!report_content) {
    throw new Error('report_content is required for SAVE mode');
  }

  // Derive project root for state tracking
  const stateProjectPath = await deriveProjectPath(project_path);

  // Mark phase as in_progress
  if (stateProjectPath) {
    await safeStateOperation(
      () => markPhaseInProgress(stateProjectPath, 4, '4c_student_report'),
      'phase4c markPhaseInProgress'
    );
  }

  try {
    // Save report
    const reportPath = join(project_path, 'student_report.md');
    await fs.writeFile(reportPath, report_content, 'utf-8');

    // Count students from content (rough estimate)
    const studentMatches = report_content.match(/^## [A-Za-z]/gm);
    const totalStudents = studentMatches ? studentMatches.length : 0;

    const durationSeconds = (performance.now() - startTime) / 1000;

    // Update project state on success
    if (stateProjectPath) {
      await safeStateOperation(
        () => markPhaseComplete(stateProjectPath, 4, '4c_student_report', {
          students_analyzed: totalStudents,
        }),
        'phase4c markPhaseComplete'
      );

      // Update sources.yaml
      await safeStateOperation(
        () => updateSources(stateProjectPath, 'student_report', {
          type: 'markdown',
          copied_to: 'student_report.md',
          note: 'Student completion report - Phase 4C',
        }),
        'phase4c updateSources'
      );

      // Log workflow action
      await safeStateOperation(
        () => logWorkflowAction(
          stateProjectPath,
          '4c',
          'phase4c_save',
          'student_report_save',
          {
            project_path,
          },
          {
            report_path: reportPath,
            total_students: totalStudents,
            success: true,
          },
          durationSeconds
        ),
        'phase4c logWorkflowAction'
      );
    }

    return {
      mode: 'save',
      success: true,
      report_path: reportPath,
      summary: {
        total_students: totalStudents,
        report_file: 'student_report.md',
      },
    };
  } catch (error) {
    // Mark phase as incomplete on error
    if (stateProjectPath) {
      await safeStateOperation(
        () => markPhaseIncomplete(stateProjectPath, 4, '4c_student_report', error as Error),
        'phase4c markPhaseIncomplete'
      );
    }
    throw error;
  }
}
