/**
 * Project Status - Session Continuity (RFC-013)
 *
 * Enables resuming projects by reading state files and listing Q-files.
 * This is the missing tool that allows users to continue where they left off.
 */

import { promises as fs } from 'fs';
import { join, basename } from 'path';
import type {
  ProjectStatusResult,
  QFileStatus,
  AssessmentCopy,
  PhaseStatusSummary,
} from '../types/project_status_types.js';
import {
  loadProjectState,
  loadSources,
  type ProjectState,
  type SourcesYaml,
} from '../shared/project_state_manager.js';
import { FOLDERS } from '../shared/folder_constants.js';

// ============================================================================
// Q-File Analysis
// ============================================================================

/**
 * Parse Q-file filename to extract question ID
 * Examples: Q001a_alla_elever.md -> Q001a
 *           Q004d_alla_elever_2026-01-08_LastName.md -> Q004d
 */
function extractQuestionId(filename: string): string | null {
  const match = filename.match(/^(Q\d+[a-z]?)_/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Parse assessment copy filename to extract metadata
 * Example: Q001a_alla_elever_2026-01-06_LastName.md
 */
function parseAssessmentCopyFilename(
  filename: string
): { date: string; assessor: string } | null {
  // Pattern: Q###_alla_elever_YYYY-MM-DD_Assessor Name.md
  const match = filename.match(
    /Q\d+[a-z]?_alla_elever_(\d{4}-\d{2}-\d{2})_(.+?)(?:\s+UPPDATERAD)?\.md$/i
  );
  if (match) {
    return {
      date: match[1],
      assessor: match[2].trim(),
    };
  }
  return null;
}

/**
 * Count assessed students in a Q-file by looking for BEDÖMNING sections
 */
async function countAssessedStudents(filePath: string): Promise<{
  assessed: number;
  total: number;
}> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    // Count student sections - various formats:
    // ## ELEV: xxx or ## Elev xxx or ## Student: xxx
    const studentMatches = content.match(/^## (?:ELEV|Elev|Student)[:\s]/gim);
    const total = studentMatches ? studentMatches.length : 0;

    // Count BEDÖMNING sections
    const assessmentMatches = content.match(
      /^### (?:BEDÖMNING|ANALYTIC ASSESSMENT):/gim
    );
    const assessed = assessmentMatches ? assessmentMatches.length : 0;

    return { assessed, total };
  } catch {
    return { assessed: 0, total: 0 };
  }
}

/**
 * List all Q-files in the answers directory
 * RFC-018: Originals in 05/, assessment copies in 06/
 */
async function listQFiles(
  projectPath: string,
  activeSession?: ProjectState['phase6']
): Promise<QFileStatus[]> {
  // RFC-018: Q-files originals in 05/, copies in 06/
  const originalsDir = join(projectPath, FOLDERS.PHASE5_ANSWERS);
  const assessmentDir = join(projectPath, FOLDERS.PHASE6_ASSESSMENT);
  const qfileMap = new Map<string, QFileStatus>();

  // Helper to process files from a directory
  const processFiles = async (dirPath: string, dirName: string, isOriginalDir: boolean) => {
    try {
      const files = await fs.readdir(dirPath);
      const mdFiles = files.filter(
        (f) => f.endsWith('.md') && f.startsWith('Q') && !f.includes('Summary')
      );

      for (const file of mdFiles) {
        const questionId = extractQuestionId(file);
        if (!questionId) continue;

        const isOriginal = file.match(/^Q\d+[a-z]?_alla_elever\.md$/i);
        const copyMeta = parseAssessmentCopyFilename(file);

        if (!qfileMap.has(questionId)) {
          qfileMap.set(questionId, {
            question_id: questionId,
            original_file: '',
            assessment_copies: [],
            total_students: 0,
            assessed_students: 0,
            progress_percent: 0,
            status: 'not_started',
          });
        }

        const qfile = qfileMap.get(questionId)!;

        if (isOriginal && isOriginalDir) {
          qfile.original_file = `${dirName}/${file}`;
          const counts = await countAssessedStudents(join(dirPath, file));
          qfile.total_students = counts.total;
        } else if (copyMeta) {
          const filePath = join(dirPath, file);
          const counts = await countAssessedStudents(filePath);

          const isCurrent = activeSession?.assessment_file?.includes(file) || false;

          qfile.assessment_copies.push({
            filename: file,
            assessor: copyMeta.assessor,
            date: copyMeta.date,
            is_current: isCurrent,
            assessed_students: counts.assessed,
          });

          if (counts.assessed > qfile.assessed_students) {
            qfile.assessed_students = counts.assessed;
          }
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  };

  // Process both directories
  await processFiles(originalsDir, FOLDERS.PHASE5_ANSWERS, true);
  await processFiles(assessmentDir, FOLDERS.PHASE6_ASSESSMENT, false);

  // Calculate status for each question
  for (const qfile of qfileMap.values()) {
    if (qfile.total_students > 0) {
      qfile.progress_percent = Math.round((qfile.assessed_students / qfile.total_students) * 100);
    }

    if (qfile.assessed_students === 0) {
      qfile.status = 'not_started';
    } else if (qfile.assessed_students < qfile.total_students) {
      qfile.status = 'in_progress';
    } else {
      qfile.status = 'complete';
    }
  }

  return Array.from(qfileMap.values()).sort((a, b) => a.question_id.localeCompare(b.question_id));
}


// ============================================================================
// Phase Analysis
// ============================================================================

/**
 * Convert project state phases to summary format
 */
function summarizePhases(state: ProjectState): PhaseStatusSummary[] {
  const summaries: PhaseStatusSummary[] = [];

  for (const [phaseName, phaseInfo] of Object.entries(state.phases || {})) {
    summaries.push({
      phase: phaseName,
      status: phaseInfo.status,
      timestamp: phaseInfo.timestamp,
      details: getPhaseDetails(phaseName, phaseInfo),
    });
  }

  // Sort by phase number
  return summaries.sort((a, b) => {
    const numA = parseInt(a.phase.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.phase.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });
}

/**
 * Get human-readable details for a phase
 */
function getPhaseDetails(
  phaseName: string,
  phaseInfo: Record<string, unknown>
): string {
  switch (phaseName) {
    case '1_setup':
      return `${phaseInfo.files_created || 0} files, ${phaseInfo.folders_created || 0} folders`;
    case '2_convert':
      return `${phaseInfo.files_processed || 0} files processed`;
    case '2b_questions':
      return `${phaseInfo.questions_detected || 0} questions detected`;
    case '4b_rubric':
      return `${phaseInfo.questions_validated || 0} questions validated`;
    case '2c_boundaries':
      return `${phaseInfo.questions_with_boundaries || 0} boundaries detected`;
    case '2d_students':
      return `${phaseInfo.students_registered || 0} students registered`;
    case '5_qfiles':
      return `${phaseInfo.qfiles_created || 0} Q-files, ${phaseInfo.students_processed || 0} students`;
    case '6_assessment':
      return `${phaseInfo.total_students_assessed || 0} students assessed`;
    case '7_insights':
      return `${phaseInfo.insight_type || 'insights'} saved`;
    default:
      return phaseInfo.status as string;
  }
}

// ============================================================================
// Recommendations
// ============================================================================

/**
 * Generate recommendations based on project state
 */
function generateRecommendations(
  state: ProjectState,
  qfiles: QFileStatus[],
  sources: SourcesYaml
): string[] {
  const recommendations: string[] = [];

  // Check for incomplete Q-files
  const inProgress = qfiles.filter((q) => q.status === 'in_progress');
  const notStarted = qfiles.filter((q) => q.status === 'not_started');

  if (inProgress.length > 0) {
    const q = inProgress[0];
    recommendations.push(
      `Continue assessment of ${q.question_id} (${q.assessed_students}/${q.total_students} done)`
    );
  }

  if (notStarted.length > 0 && inProgress.length === 0) {
    recommendations.push(
      `Start assessment of ${notStarted[0].question_id} (${notStarted.length} questions remaining)`
    );
  }

  // Check if Phase 8+ should be started
  const allComplete = qfiles.every((q) => q.status === 'complete');
  if (allComplete && qfiles.length > 0) {
    if (!state.phases['8_quantitative']) {
      recommendations.push(
        'All questions assessed. Ready for Phase 8 (Quantitative Summary)'
      );
    }
  }

  // Check for active session
  if (state.phase6) {
    recommendations.push(
      `Active session: ${state.phase6.current_question} by ${state.phase6.assessor}`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Project is up to date');
  }

  return recommendations;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get comprehensive project status for session continuity
 *
 * @param projectPath - Path to project root
 * @returns Complete project status with Q-files, phases, and recommendations
 */
export async function getProjectStatus(
  projectPath: string
): Promise<ProjectStatusResult> {
  // Load state files
  let state: ProjectState;
  let sources: SourcesYaml;

  try {
    state = await loadProjectState(projectPath);
  } catch (error) {
    throw new Error(
      `Not a valid assessment project: project_state.json not found at ${projectPath}`
    );
  }

  try {
    sources = await loadSources(projectPath);
  } catch {
    // sources.yaml might not exist in older projects
    sources = {
      project: { name: state.project_name, created: state.created },
      sources: {},
    };
  }

  // Analyze Q-files
  const qfiles = await listQFiles(projectPath, state.phase6);

  // Calculate statistics
  const questionsComplete = qfiles.filter((q) => q.status === 'complete').length;
  const questionsInProgress = qfiles.filter(
    (q) => q.status === 'in_progress'
  ).length;
  const questionsNotStarted = qfiles.filter(
    (q) => q.status === 'not_started'
  ).length;

  // Summarize phases
  const phases = summarizePhases(state);

  // Generate recommendations
  const recommendations = generateRecommendations(state, qfiles, sources);

  // Build result
  const result: ProjectStatusResult = {
    project_name: state.project_name,
    project_path: projectPath,
    created: state.created,
    last_updated: state.last_updated,

    current_phase: state.current_phase,
    phases,

    qfiles,
    total_questions: qfiles.length,
    questions_complete: questionsComplete,
    questions_in_progress: questionsInProgress,
    questions_not_started: questionsNotStarted,

    sources: {
      rubric: sources.sources?.rubric?.copied_to || `${FOLDERS.PHASE1_ORIGINAL}/rubric.md`,
      exam_questions:
        sources.sources?.exam_questions?.copied_to ||
        `${FOLDERS.PHASE1_ORIGINAL}/exam_questions.pdf`,
      methodology: sources.sources?.methodology?.copied_to || 'methodology/',
    },

    recommendations,
  };

  // Add active session if exists
  if (state.phase6) {
    result.active_session = {
      question_id: state.phase6.current_question,
      assessment_file: state.phase6.assessment_file,
      assessor: state.phase6.assessor,
      started_at: state.phase6.started_at,
    };
  }

  return result;
}

/**
 * Format project status for human-readable output
 */
export function formatProjectStatus(status: ProjectStatusResult): string {
  const lines: string[] = [];

  lines.push(`# Project Status: ${status.project_name}`);
  lines.push('');
  lines.push(`**Path:** ${status.project_path}`);
  lines.push(`**Created:** ${status.created}`);
  lines.push(`**Last updated:** ${status.last_updated}`);
  lines.push(`**Current phase:** ${status.current_phase}`);
  lines.push('');

  // Phases
  lines.push('## Phases');
  for (const phase of status.phases) {
    const icon = phase.status === 'complete' ? '✅' : '⏳';
    lines.push(`- ${icon} **${phase.phase}**: ${phase.details || phase.status}`);
  }
  lines.push('');

  // Q-files
  lines.push('## Q-Files (Phase 6 Assessment)');
  lines.push(
    `Progress: ${status.questions_complete}/${status.total_questions} complete`
  );
  lines.push('');
  lines.push('| Question | Status | Progress | Assessor |');
  lines.push('|----------|--------|----------|----------|');
  for (const q of status.qfiles) {
    const icon =
      q.status === 'complete' ? '✅' : q.status === 'in_progress' ? '🔄' : '⬜';
    const latestCopy = q.assessment_copies[q.assessment_copies.length - 1];
    const assessor = latestCopy?.assessor || '-';
    lines.push(
      `| ${icon} ${q.question_id} | ${q.status} | ${q.assessed_students}/${q.total_students} | ${assessor} |`
    );
  }
  lines.push('');

  // Active session
  if (status.active_session) {
    lines.push('## Active Session');
    lines.push(`- **Question:** ${status.active_session.question_id}`);
    lines.push(`- **Assessor:** ${status.active_session.assessor}`);
    lines.push(`- **File:** ${status.active_session.assessment_file}`);
    lines.push('');
  }

  // Sources
  lines.push('## Source Files');
  lines.push(`- **Rubric:** ${status.sources.rubric}`);
  lines.push(`- **Exam:** ${status.sources.exam_questions}`);
  lines.push(`- **Methodology:** ${status.sources.methodology}`);
  lines.push('');

  // Recommendations
  lines.push('## Recommendations');
  for (const rec of status.recommendations) {
    lines.push(`- 💡 ${rec}`);
  }

  return lines.join('\n');
}
