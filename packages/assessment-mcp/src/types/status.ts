/**
 * Assessment_MPC - Status Types
 *
 * Defines interfaces for ASSESSMENT-STATUS YAML frontmatter tracking.
 * Based on MPC_RTA patterns but adapted for student assessment.
 *
 * @see docs/design/001-assessment-format.md
 */

/**
 * Aspect definition from rubric
 */
export interface Aspect {
  name: string;   // e.g., "6a: Riktningar"
  max: number;    // Maximum points for this aspect
}

/**
 * Main Status interface for tracking assessment progress.
 * Internal representation used by the application.
 */
export interface AssessmentStatus {
  file: string;                       // Q-file being assessed
  question: string;                   // Question title/name
  maxPoints: number;                  // Maximum points for question
  aspects: Aspect[];                  // Assessment aspects from rubric
  totalStudents: number;              // Total students in file
  lastAssessedStudent: string | null; // ID of last assessed student
  lastAssessedIndex: number;          // 0-based index of last assessed (-1 if none)
  progress: string;                   // "3/16 (18.75%)" format
  date: string;                       // ISO date (YYYY-MM-DD)
  rubricFile: string | null;          // Path to bedömningsanvisningar
}

/**
 * Raw status for YAML frontmatter parsing.
 * Matches the YAML structure in the file exactly.
 */
export interface RawAssessmentStatus {
  'ASSESSMENT-STATUS': {
    File: string;
    Question: string;
    'Max-points': number;
    Aspects?: Array<{
      name: string;
      max: number;
    }>;
    'Total-students': number;
    'Last-assessed-student': string | null;
    'Last-assessed-index': number;
    Progress: string;
    Date: string;
    'Rubric-file'?: string | null;
  };
}

/**
 * Default values for new assessment sessions
 */
export const DEFAULT_STATUS: Partial<AssessmentStatus> = {
  lastAssessedStudent: null,
  lastAssessedIndex: -1,
  aspects: [],
  rubricFile: null,
};

/**
 * Convert raw YAML status to internal representation
 */
export function parseRawStatus(raw: RawAssessmentStatus): AssessmentStatus {
  const status = raw['ASSESSMENT-STATUS'];
  return {
    file: status.File,
    question: status.Question,
    maxPoints: status['Max-points'],
    aspects: status.Aspects || [],
    totalStudents: status['Total-students'],
    lastAssessedStudent: status['Last-assessed-student'],
    lastAssessedIndex: status['Last-assessed-index'],
    progress: status.Progress,
    date: status.Date,
    rubricFile: status['Rubric-file'] || null,
  };
}

/**
 * Convert internal status to YAML frontmatter string
 */
export function serializeStatus(status: AssessmentStatus): string {
  const aspectsYaml = status.aspects.length > 0
    ? `  Aspects:\n${status.aspects.map(a =>
        `    - name: "${a.name}"\n      max: ${a.max}`
      ).join('\n')}\n`
    : '';

  return `---
ASSESSMENT-STATUS:
  File: "${status.file}"
  Question: "${status.question}"
  Max-points: ${status.maxPoints}
${aspectsYaml}  Total-students: ${status.totalStudents}
  Last-assessed-student: ${status.lastAssessedStudent ? `"${status.lastAssessedStudent}"` : 'null'}
  Last-assessed-index: ${status.lastAssessedIndex}
  Progress: "${status.progress}"
  Date: "${status.date}"
  Rubric-file: ${status.rubricFile ? `"${status.rubricFile}"` : 'null'}
---
`;
}

/**
 * Calculate progress string from counts
 */
export function calculateProgress(assessed: number, total: number): string {
  const percentage = total > 0 ? ((assessed / total) * 100).toFixed(2) : '0';
  return `${assessed}/${total} (${percentage}%)`;
}
