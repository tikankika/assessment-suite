/**
 * Assessment_MPC - Assessment Types
 *
 * Defines interfaces for students, assessments, and scoring.
 *
 * @see docs/design/001-assessment-format.md
 */

/**
 * Quality symbol for an aspect score.
 * Valid symbols are defined in methodology, not in code.
 */
export type QualitySymbol = string;

/**
 * Score for a single aspect in the assessment
 */
export interface AspectScore {
  name: string;           // e.g., "6a (Riktningar)"
  symbol: QualitySymbol;  // Quality indicator
  points: number;         // Points awarded (e.g., 2.0)
  comment: string;        // Brief explanation (e.g., "Båda gaserna rätt")
}

/**
 * Complete assessment for a student
 */
export interface Assessment {
  aspects: AspectScore[];   // All aspect scores
  totalPoints: number;      // Sum of aspect points
  maxPoints: number;        // Maximum possible points
  nextStep: string;         // Forward-looking feedback ("Nästa steg")
  comment?: string;         // Optional general comment
}

/**
 * Student data parsed from Q-file
 */
export interface Student {
  id: string;              // Student ID (e.g., "<id>")
  index: number;           // 0-based position in file
  wordCount: number;       // Word count from header (N ord)
  answer: string;          // Complete student answer text
  assessed: boolean;       // Has BEDÖMNING section
}

/**
 * Result of reading next student
 */
export interface StudentReadResult {
  student: Student | null;    // Next unassessed student (null if all done)
  rubricSection: string;      // Relevant rubric section for this question
  progress: string;           // "3/16 (18.75%)"
  remaining: number;          // Students left to assess
}

/**
 * Result of writing an assessment
 */
export interface AssessmentWriteResult {
  success: boolean;
  studentId: string;
  progress: string;
  nextStudent: Student | null;  // Next unassessed student
  tip?: string;  // Optional hint when question is complete (all students assessed)
}

/**
 * Session info returned by assessment_start
 */
export interface SessionInfo {
  file: string;
  question: string;
  maxPoints: number;
  totalStudents: number;
  aspects: Array<{ name: string; max: number }>;
}

/**
 * Result of assessment_start
 *
 * ADR-003: methodology now returns document list instead of full content.
 * Use phase6_methodology to load documents progressively.
 * Use phase6_rubric to load rubric section after methodology.
 */
export interface AssessmentStartResult {
  sessionInfo: SessionInfo;
  rubricSection: string;         // Full rubric section for this question
  methodology: string;           // DEPRECATED: Minimal fallback only
  methodology_documents: string[]; // List of loaded methodology doc names
  methodology_content: Array<{ name: string; content: string }>; // Auto-loaded methodology docs
  project_path: string;          // For workflow state management
  question_id: string;           // For rubric loading
  rubric_path: string;           // For rubric loading
  assessment_file?: string;      // Path to assessment copy file
  next_action: string;           // Explicit instruction for Claude
  firstStudent: Student | null;  // First student (null if resuming)
  validationWarnings: string[];  // Any warnings during validation
  resumed: boolean;              // Whether resuming existing session
}

/**
 * Rubric (bedömningsanvisningar) for a question
 */
export interface Rubric {
  questionNumber: number;
  questionTitle: string;
  maxPoints: number;
  aspects: RubricAspect[];  // Aspect definitions
  rawText: string;          // Original rubric text
}

/**
 * Single aspect in a rubric
 */
export interface RubricAspect {
  name: string;
  maxPoints: number;
  description: string;   // What this aspect measures
  levels?: RubricLevel[]; // Optional: scoring levels
}

/**
 * Scoring level within an aspect
 */
export interface RubricLevel {
  symbol: QualitySymbol;
  points: number;
  criteria: string;  // What earns this level
}

/**
 * Format an assessment as BEDÖMNING markdown section
 *
 * RFC-021 v2 format with START/END markers for reliable Phase 7 parsing:
 * <!-- PHASE6_ASSESSMENT_START student_id="{studentId}" -->
 * ### BEDÖMNING: {studentId}
 * ...
 * <!-- PHASE6_ASSESSMENT ... format_version: 2 -->
 * <!-- PHASE6_ASSESSMENT_END -->
 *
 * The studentId in markers allows Phase 7 to reliably extract assessments.
 */
export function formatBedömning(
  assessment: Assessment,
  studentId: string,
  assessedBy: string = 'unknown'
): string {
  // Unescape newlines in multi-line fields (Claude Desktop sends escaped \n in JSON)
  const unescapeNewlines = (str: string) => str.replace(/\\n/g, '\n');

  const aspectLines = assessment.aspects.map(a =>
    `**${a.name}:** ${a.symbol} **${a.points}p** - ${unescapeNewlines(a.comment)}`
  ).join('\n');

  const commentLine = assessment.comment
    ? `**Kommentar:** ${unescapeNewlines(assessment.comment)}\n`
    : '';

  const assessedAt = new Date().toISOString();

  return `<!-- PHASE6_ASSESSMENT_START student_id="${studentId}" -->
### BEDÖMNING: ${studentId}

${aspectLines}

**TOTALPOÄNG: ${assessment.totalPoints}/${assessment.maxPoints}p**
${commentLine}**→ Nästa steg:** ${unescapeNewlines(assessment.nextStep)}

<!-- PHASE6_ASSESSMENT
student_id: ${studentId}
total_points: ${assessment.totalPoints}
max_points: ${assessment.maxPoints}
assessed_by: ${assessedBy}
assessed_at: ${assessedAt}
format_version: 2
-->
<!-- PHASE6_ASSESSMENT_END -->

---
`;
}

/**
 * Parse student header to extract ID and word count
 * Pattern: "## Elev <id> (47 ord)"
 */
export function parseStudentHeader(header: string): { id: string; wordCount: number } | null {
  const match = header.match(/^## Elev (\d+) \((\d+) ord\)/);
  if (!match) return null;
  return {
    id: match[1],
    wordCount: parseInt(match[2], 10),
  };
}
