import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { load } from 'js-yaml';
import { ExamConfig as ExamConfigYaml } from '../shared/exam_config_reader.js';
import { validatePathOrThrow } from '../core/path_validator.js';
import {
  deriveProjectPath,
  markPhaseInProgress,
  markPhaseComplete,
  markPhaseIncomplete,
  logWorkflowAction,
  safeStateOperation,
} from '../shared/project_state_manager.js';
import { FOLDERS } from '../shared/folder_constants.js';

/**
 * Phase 3 Validation: Structural checks on annotated student files.
 *
 * Mechanically validates annotated files in 03_material/student_answers/
 * against originals in 02_markdown/student_answers/. No AI needed — pure
 * structural checks per RFC-034 §4 Step 3.
 *
 * Checks:
 * 1. Marker completeness — all expected q/sub-q markers present
 * 2. Marker placement — each marker on its own line
 * 3. Text preservation — original content unchanged after stripping markers
 * 4. Marker nesting — sub-question markers within question markers
 * 5. No text outside markers — all content within some marker pair
 */

// ============================================================================
// Input/Output Types
// ============================================================================

export interface Phase3ValidateInput {
  project_path: string;
  student_id?: string; // validate single student, or all if omitted
}

interface CheckResult {
  passed: boolean;
  details?: string;
}

interface StudentValidationResult {
  student_id: string;
  status: 'ok' | 'error';
  checks: {
    marker_completeness: CheckResult;
    marker_placement: CheckResult;
    text_preservation: CheckResult;
    marker_nesting: CheckResult;
    no_text_outside_markers: CheckResult;
  };
  marker_count: number;
  expected_marker_count: number;
}

interface ExamConfig {
  questions: Array<{
    id: string;
    number: number;
    subquestions?: string[];
  }>;
  answerBoundaries?: Record<string, {
    sub_questions?: Record<string, string>;
    auto_graded?: boolean;
    skip_boundary_detection?: boolean;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

const MARKER_REGEX = /<!-- phase3_q\d{3}[a-z]?_(start|end) -->/;
const MARKER_REGEX_GLOBAL = /<!-- phase3_q\d{3}[a-z]?_(start|end) -->/g;
const LINE_INDEX_PREFIX = /^\d{4,}\s/;
const STUDENT_HEADER_REGEX = /^<!-- student: .+ -->$/;

// ============================================================================
// Main Entry Point
// ============================================================================

export async function phase3Validate(
  input: Phase3ValidateInput
): Promise<object> {
  const { project_path, student_id } = input;
  validatePathOrThrow(project_path);
  const startTime = performance.now();

  // Derive project root for state tracking
  const stateProjectPath = await deriveProjectPath(project_path);

  // Mark phase as in_progress
  if (stateProjectPath) {
    await safeStateOperation(
      () => markPhaseInProgress(stateProjectPath, 3, '3_annotate'),
      'phase3_validate markPhaseInProgress'
    );
  }

  try {
    // Load exam_config.yaml
    const examConfigPath = join(project_path, 'exam_config.yaml');
    const configContent = await fs.readFile(examConfigPath, 'utf-8');
    const rawConfig = load(configContent) as Record<string, unknown>;
    const examConfig = parseExamConfig(rawConfig);

    // Build expected markers from exam config
    const expectedMarkers = buildExpectedMarkers(examConfig);

    // Determine which files to validate
    const annotatedDir = join(project_path, FOLDERS.PHASE3_MATERIAL, 'student_answers');
    const originalDir = join(project_path, FOLDERS.PHASE2_MARKDOWN, 'student_answers');

    let filesToValidate: string[];
    if (student_id) {
      const filename = `${student_id}.md`;
      const filePath = join(annotatedDir, filename);
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`Annotated file not found for student "${student_id}": ${filePath}`);
      }
      filesToValidate = [filename];
    } else {
      try {
        const files = await fs.readdir(annotatedDir);
        filesToValidate = files.filter(f => f.endsWith('.md')).sort();
      } catch {
        throw new Error(`Annotated student answers directory not found: ${annotatedDir}`);
      }
    }

    if (filesToValidate.length === 0) {
      throw new Error(`No annotated student files found in ${annotatedDir}`);
    }

    // Validate each student
    const results: StudentValidationResult[] = [];

    for (const filename of filesToValidate) {
      const sid = basename(filename, '.md');
      const annotatedPath = join(annotatedDir, filename);
      const originalPath = join(originalDir, filename);

      const annotatedContent = await fs.readFile(annotatedPath, 'utf-8');

      let originalContent: string;
      try {
        originalContent = await fs.readFile(originalPath, 'utf-8');
      } catch {
        results.push({
          student_id: sid,
          status: 'error',
          checks: {
            marker_completeness: { passed: false, details: 'Could not run — original file missing' },
            marker_placement: { passed: false, details: 'Could not run — original file missing' },
            text_preservation: { passed: false, details: `Original file not found: ${originalPath}` },
            marker_nesting: { passed: false, details: 'Could not run — original file missing' },
            no_text_outside_markers: { passed: false, details: 'Could not run — original file missing' },
          },
          marker_count: 0,
          expected_marker_count: expectedMarkers.length,
        });
        continue;
      }

      const result = validateStudent(
        sid,
        annotatedContent,
        originalContent,
        expectedMarkers
      );
      results.push(result);
    }

    // Determine overall status
    const allPassed = results.every(r => r.status === 'ok');
    const passedCount = results.filter(r => r.status === 'ok').length;
    const failedCount = results.filter(r => r.status === 'error').length;

    const durationSeconds = (performance.now() - startTime) / 1000;

    // Update project state
    if (stateProjectPath) {
      if (allPassed) {
        await safeStateOperation(
          () => markPhaseComplete(stateProjectPath, 3, '3_annotate', {
            students_validated: results.length,
            all_passed: true,
          }),
          'phase3_validate markPhaseComplete'
        );
      } else {
        await safeStateOperation(
          () => markPhaseIncomplete(
            stateProjectPath,
            3,
            '3_annotate',
            new Error(`${failedCount} of ${results.length} students failed validation`)
          ),
          'phase3_validate markPhaseIncomplete'
        );
      }

      // Log workflow action
      await safeStateOperation(
        () => logWorkflowAction(
          stateProjectPath,
          '3',
          'phase3_validate',
          'validation',
          {
            project_path,
            student_id: student_id || 'all',
            student_count: filesToValidate.length,
          },
          {
            all_passed: allPassed,
            passed: passedCount,
            failed: failedCount,
          },
          durationSeconds
        ),
        'phase3_validate logWorkflowAction'
      );
    }

    return {
      status: allPassed ? 'all_passed' : 'has_errors',
      students_validated: results.length,
      passed: passedCount,
      failed: failedCount,
      results,
    };
  } catch (error) {
    // Mark phase as incomplete on error
    if (stateProjectPath) {
      await safeStateOperation(
        () => markPhaseIncomplete(stateProjectPath, 3, '3_annotate', error as Error),
        'phase3_validate markPhaseIncomplete'
      );
    }
    throw error;
  }
}

// ============================================================================
// Exam Config Parsing
// ============================================================================

function parseExamConfig(raw: Partial<ExamConfigYaml>): ExamConfig {
  const questions = raw.questions || [];
  const boundaries = raw.answer_boundaries?.questions;

  return {
    questions: questions.map((q) => {
      const qId = q.id;

      // Derive subquestions: first try questions[].subquestions (explicit),
      // then fall back to answer_boundaries.questions[Q].sub_questions keys
      let subquestions = q.subquestions;
      if (!subquestions && boundaries?.[qId]?.sub_questions) {
        subquestions = Object.keys(boundaries[qId].sub_questions).sort();
      }

      return {
        id: qId,
        number: q.number,
        subquestions,
      };
    }),
    answerBoundaries: boundaries,
  };
}

// ============================================================================
// Expected Marker Generation
// ============================================================================

/**
 * Build the list of expected marker names from exam config.
 * Each question gets phase3_q{NNN}_start/end.
 * Each sub-question gets phase3_q{NNN}{letter}_start/end.
 *
 * Sub-question labels are derived from answer_boundaries.questions[Q].sub_questions
 * when not explicitly set on the questions[] list.
 * Auto-graded questions (from answer_boundaries) are skipped.
 */
function buildExpectedMarkers(config: ExamConfig): string[] {
  const markers: string[] = [];

  for (const question of config.questions) {
    const qNum = String(question.number).padStart(3, '0');

    // Skip auto-graded questions
    const boundary = config.answerBoundaries?.[question.id];
    if (boundary?.auto_graded || boundary?.skip_boundary_detection) {
      continue;
    }

    // Question-level markers
    markers.push(`<!-- phase3_q${qNum}_start -->`);
    markers.push(`<!-- phase3_q${qNum}_end -->`);

    // Sub-question markers
    if (question.subquestions && question.subquestions.length > 0) {
      for (const sub of question.subquestions) {
        markers.push(`<!-- phase3_q${qNum}${sub}_start -->`);
        markers.push(`<!-- phase3_q${qNum}${sub}_end -->`);
      }
    }
  }

  return markers;
}

// ============================================================================
// Student Validation
// ============================================================================

function validateStudent(
  studentId: string,
  annotatedContent: string,
  originalContent: string,
  expectedMarkers: string[]
): StudentValidationResult {
  const annotatedLines = annotatedContent.split('\n');

  // Run all checks
  const markerCompleteness = checkMarkerCompleteness(annotatedContent, expectedMarkers);
  const markerPlacement = checkMarkerPlacement(annotatedLines);
  const textPreservation = checkTextPreservation(annotatedContent, originalContent);
  const markerNesting = checkMarkerNesting(annotatedLines);
  const noTextOutside = checkNoTextOutsideMarkers(annotatedLines);

  // Count actual markers
  const actualMarkers = annotatedContent.match(MARKER_REGEX_GLOBAL) || [];

  const allPassed =
    markerCompleteness.passed &&
    markerPlacement.passed &&
    textPreservation.passed &&
    markerNesting.passed &&
    noTextOutside.passed;

  return {
    student_id: studentId,
    status: allPassed ? 'ok' : 'error',
    checks: {
      marker_completeness: markerCompleteness,
      marker_placement: markerPlacement,
      text_preservation: textPreservation,
      marker_nesting: markerNesting,
      no_text_outside_markers: noTextOutside,
    },
    marker_count: actualMarkers.length,
    expected_marker_count: expectedMarkers.length,
  };
}

// ============================================================================
// Check 1: Marker Completeness
// ============================================================================

function checkMarkerCompleteness(
  content: string,
  expectedMarkers: string[]
): CheckResult {
  const missing: string[] = [];

  for (const marker of expectedMarkers) {
    if (!content.includes(marker)) {
      missing.push(marker);
    }
  }

  if (missing.length === 0) {
    return { passed: true };
  }

  return {
    passed: false,
    details: `Missing ${missing.length} marker(s): ${missing.join(', ')}`,
  };
}

// ============================================================================
// Check 2: Marker Placement
// ============================================================================

/**
 * Each marker must be on its own line. After stripping the line index prefix,
 * the trimmed line should match ONLY the marker regex.
 */
function checkMarkerPlacement(lines: string[]): CheckResult {
  const badLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Strip line index prefix
    const stripped = line.replace(LINE_INDEX_PREFIX, '').trim();

    if (MARKER_REGEX.test(stripped)) {
      // The entire stripped line should be just the marker
      if (!stripped.match(/^<!-- phase3_q\d{3}[a-z]?_(start|end) -->$/)) {
        badLines.push(`Line ${i + 1}: marker mixed with other content: "${stripped}"`);
      }
    }
  }

  if (badLines.length === 0) {
    return { passed: true };
  }

  return {
    passed: false,
    details: `${badLines.length} marker(s) not on their own line: ${badLines.join('; ')}`,
  };
}

// ============================================================================
// Check 3: Text Preservation
// ============================================================================

/**
 * Strip all marker lines AND line index prefixes from annotated file,
 * strip line index prefixes from original, compare. Also strip the
 * <!-- student: {id} --> header and leading blank lines from the
 * annotated file (phase3_prepare adds header + blank line).
 */
function checkTextPreservation(
  annotatedContent: string,
  originalContent: string
): CheckResult {
  const annotatedLines = annotatedContent.split('\n');
  const originalLines = originalContent.split('\n');

  // Strip annotated: remove marker lines, student header, and line index prefixes
  const strippedAnnotatedLines = annotatedLines
    .filter(line => {
      const noPrefix = line.replace(LINE_INDEX_PREFIX, '').trim();
      // Skip marker lines
      if (MARKER_REGEX.test(noPrefix)) return false;
      // Skip student header
      if (STUDENT_HEADER_REGEX.test(noPrefix)) return false;
      return true;
    })
    .map(line => line.replace(LINE_INDEX_PREFIX, ''));

  // Strip leading blank lines (from phase3_prepare's header + \n\n)
  while (strippedAnnotatedLines.length > 0 && strippedAnnotatedLines[0].trim() === '') {
    strippedAnnotatedLines.shift();
  }

  const strippedAnnotated = strippedAnnotatedLines.join('\n');

  // Strip original: the original file (02_markdown) has NO line index
  // prefixes — do NOT apply LINE_INDEX_PREFIX stripping here, or text
  // starting with 4+ digits (e.g. "1991 med 25 öre...") gets mangled.
  const strippedOriginalLines = [...originalLines];

  while (strippedOriginalLines.length > 0 && strippedOriginalLines[0].trim() === '') {
    strippedOriginalLines.shift();
  }

  const strippedOriginal = strippedOriginalLines.join('\n');

  if (strippedAnnotated === strippedOriginal) {
    return { passed: true };
  }

  // Find first difference for diagnostics
  const annotatedClean = strippedAnnotated.split('\n');
  const originalClean = strippedOriginal.split('\n');

  for (let i = 0; i < Math.max(annotatedClean.length, originalClean.length); i++) {
    const aLine = annotatedClean[i] ?? '<missing>';
    const oLine = originalClean[i] ?? '<missing>';
    if (aLine !== oLine) {
      return {
        passed: false,
        details: `Text differs at line ${i + 1}. ` +
          `Original: "${oLine.substring(0, 80)}" | ` +
          `Annotated: "${aLine.substring(0, 80)}"`,
      };
    }
  }

  return {
    passed: false,
    details: 'Content differs (line count mismatch)',
  };
}

// ============================================================================
// Check 4: Marker Nesting
// ============================================================================

/**
 * Sub-question markers must be within question markers.
 * E.g., phase3_q001a_start must come after phase3_q001_start
 * and before phase3_q001_end.
 */
function checkMarkerNesting(lines: string[]): CheckResult {
  // Build a list of markers in order with their line numbers
  const markerSequence: Array<{ marker: string; line: number; qNum: string; sub: string; type: 'start' | 'end' }> = [];

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].replace(LINE_INDEX_PREFIX, '').trim();
    const match = stripped.match(/^<!-- phase3_q(\d{3})([a-z]?)_(start|end) -->$/);
    if (match) {
      markerSequence.push({
        marker: stripped,
        line: i + 1,
        qNum: match[1],
        sub: match[2],
        type: match[3] as 'start' | 'end',
      });
    }
  }

  const errors: string[] = [];

  // Track open question ranges
  const questionRanges: Record<string, { startLine: number; endLine: number | null }> = {};

  // First pass: find question-level start/end
  for (const m of markerSequence) {
    if (m.sub === '') {
      // Question-level marker
      if (m.type === 'start') {
        questionRanges[m.qNum] = { startLine: m.line, endLine: null };
      } else {
        if (questionRanges[m.qNum]) {
          questionRanges[m.qNum].endLine = m.line;
        }
      }
    }
  }

  // Second pass: check sub-question markers are within parent question range
  for (const m of markerSequence) {
    if (m.sub !== '') {
      const parentRange = questionRanges[m.qNum];
      if (!parentRange) {
        errors.push(
          `Line ${m.line}: sub-question marker ${m.marker} has no parent question q${m.qNum}`
        );
        continue;
      }
      if (m.line <= parentRange.startLine) {
        errors.push(
          `Line ${m.line}: ${m.marker} appears before parent q${m.qNum}_start (line ${parentRange.startLine})`
        );
      }
      if (parentRange.endLine !== null && m.line >= parentRange.endLine) {
        errors.push(
          `Line ${m.line}: ${m.marker} appears after parent q${m.qNum}_end (line ${parentRange.endLine})`
        );
      }
    }
  }

  if (errors.length === 0) {
    return { passed: true };
  }

  return {
    passed: false,
    details: errors.join('; '),
  };
}

// ============================================================================
// Check 5: No Text Outside Markers
// ============================================================================

/**
 * All non-blank lines (after stripping line indices) that aren't markers
 * or the student header should fall within some question marker pair.
 *
 * Exceptions (allowed outside markers):
 * - Preamble: text before the first question-level start marker
 * - Inter-question gaps: text between a question-level end marker
 *   and the next question-level start marker (exam metadata like
 *   "Besvarad.", page numbers, separators)
 * - Epilogue: text after the last question-level end marker
 *
 * Only text that should be INSIDE a question block but isn't is flagged
 * (e.g., a forgotten sub-answer annotation).
 */
function checkNoTextOutsideMarkers(lines: string[]): CheckResult {
  // Find question-level marker positions (not sub-question markers)
  const questionMarkers: Array<{ line: number; type: 'start' | 'end' }> = [];

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].replace(LINE_INDEX_PREFIX, '').trim();
    // Only question-level markers (q001_start, not q001a_start)
    const match = stripped.match(/^<!-- phase3_q\d{3}_(start|end) -->$/);
    if (match) {
      questionMarkers.push({ line: i, type: match[1] as 'start' | 'end' });
    }
  }

  if (questionMarkers.length === 0) {
    return { passed: true, details: 'No markers found — nothing to check' };
  }

  // Build set of lines that are inside a question marker pair (any depth)
  const insideQuestion = new Set<number>();

  // Also build full marker map for all markers (including sub-question)
  const allMarkerMap = new Map<number, 'start' | 'end'>();
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].replace(LINE_INDEX_PREFIX, '').trim();
    const match = stripped.match(/^<!-- phase3_q\d{3}[a-z]?_(start|end) -->$/);
    if (match) {
      allMarkerMap.set(i, match[1] as 'start' | 'end');
    }
  }

  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const mType = allMarkerMap.get(i);
    if (mType === 'start') {
      depth++;
    }
    if (depth > 0) {
      insideQuestion.add(i);
    }
    if (mType === 'end') {
      depth--;
    }
  }

  // Build "allowed zones" — preamble, inter-question gaps, epilogue
  const allowedOutside = new Set<number>();

  // Preamble: everything before first question start
  const firstStart = questionMarkers[0].line;
  for (let i = 0; i < firstStart; i++) {
    allowedOutside.add(i);
  }

  // Inter-question gaps and epilogue: between question end and next question start
  for (let m = 0; m < questionMarkers.length; m++) {
    if (questionMarkers[m].type === 'end') {
      // Find next question start
      const nextStart = questionMarkers.find(
        (qm, idx) => idx > m && qm.type === 'start'
      );
      const gapEnd = nextStart ? nextStart.line : lines.length;

      for (let i = questionMarkers[m].line + 1; i < gapEnd; i++) {
        allowedOutside.add(i);
      }
    }
  }

  const outsideLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    // Allowed zones (preamble, gaps, epilogue)
    if (allowedOutside.has(i)) continue;

    const stripped = lines[i].replace(LINE_INDEX_PREFIX, '').trim();

    // Skip blank lines
    if (stripped === '') continue;

    // Skip marker lines
    if (/^<!-- phase3_q\d{3}[a-z]?_(start|end) -->$/.test(stripped)) continue;

    // Skip student header
    if (STUDENT_HEADER_REGEX.test(stripped)) continue;

    // Check if inside a marker pair
    if (!insideQuestion.has(i)) {
      outsideLines.push(`Line ${i + 1}: "${stripped.substring(0, 60)}"`);
    }
  }

  if (outsideLines.length === 0) {
    return { passed: true };
  }

  return {
    passed: false,
    details: `${outsideLines.length} line(s) outside markers: ${outsideLines.slice(0, 5).join('; ')}` +
      (outsideLines.length > 5 ? ` ... and ${outsideLines.length - 5} more` : ''),
  };
}
