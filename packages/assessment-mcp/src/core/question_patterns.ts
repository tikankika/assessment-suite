/**
 * Phase 4A: Question Detection Patterns
 *
 * Pattern matchers for extracting question information from exam content.
 * Supports multiple exam-question formats; identifiers are named by what the
 * format IS, not by which course exemplified it (see code-as-plumber rule).
 */

export interface PatternMatch {
  lineNumber: number;
  rubricId: string | null;
  title: string;
  points: number | null;
  rawHeader: string;
  pattern: string;  // Which pattern matched
}

interface QuestionPattern {
  name: string;
  regex: RegExp;
  extract: (match: RegExpMatchArray, lineNumber: number, rawLine: string) => PatternMatch;
}

/**
 * Question patterns in priority order.
 * First match wins.
 */
export const QUESTION_PATTERNS: QuestionPattern[] = [
  // Pattern 1: numbered + inline rubric ID, with hash and points
  //   "<N> ### <RUBRIC>. <title> (<P> poäng)"
  {
    name: 'numbered_rubric_with_points',
    regex: /^(\d+)\s+###\s+([A-Z]\d+)\.\s+(.+?)\s*\((\d+)\s*poäng\)/i,
    extract: (match, lineNumber, rawLine) => ({
      lineNumber,
      rubricId: match[2],
      title: match[3].trim(),
      points: parseInt(match[4], 10),
      rawHeader: rawLine,
      pattern: 'numbered_rubric_with_points',
    }),
  },
  // Pattern 2: numbered + inline rubric ID, without hash, with points
  //   "<N> <RUBRIC>. <title> (<P> poäng)"
  {
    name: 'numbered_rubric_no_hash',
    regex: /^(\d+)\s+([A-Z]\d+)\.\s+(.+?)\s*\((\d+)\s*poäng\)/i,
    extract: (match, lineNumber, rawLine) => ({
      lineNumber,
      rubricId: match[2],
      title: match[3].trim(),
      points: parseInt(match[4], 10),
      rawHeader: rawLine,
      pattern: 'numbered_rubric_no_hash',
    }),
  },
  // Pattern 3: numbered + inline rubric ID, with hash, without points
  //   "<N> ### <RUBRIC>. <title>"
  {
    name: 'numbered_rubric_no_points',
    regex: /^(\d+)\s+###\s+([A-Z]\d+)\.\s+(.+)/i,
    extract: (match, lineNumber, rawLine) => ({
      lineNumber,
      rubricId: match[2],
      title: match[3].trim(),
      points: null,
      rawHeader: rawLine,
      pattern: 'numbered_rubric_no_points',
    }),
  },
  // Pattern 4: generic fallback — number then title, no rubric ID
  //   "<N>. <title>"  or  "<N> <title>"
  {
    name: 'generic',
    regex: /^(\d+)[.\s]+(.+)/i,
    extract: (match, lineNumber, rawLine) => ({
      lineNumber,
      rubricId: null,
      title: match[2].trim(),
      points: null,
      rawHeader: rawLine,
      pattern: 'generic',
    }),
  },
];

/**
 * Detects a question header in a line of text.
 * Returns the first matching pattern or null.
 */
export function detectQuestionHeader(line: string, lineNumber: number): PatternMatch | null {
  const trimmedLine = line.trim();

  for (const pattern of QUESTION_PATTERNS) {
    const match = trimmedLine.match(pattern.regex);
    if (match) {
      return pattern.extract(match, lineNumber, trimmedLine);
    }
  }

  return null;
}

/**
 * Detects the exam format based on content analysis.
 * Looks for characteristic patterns of known formats.
 *
 * Format identifiers are named by structure, not by the course
 * that first exemplified them:
 *   - NUMBERED_RUBRIC: numbered question + inline rubric ID (with or without `###`)
 *   - NUMBERED_PLAIN:  numbered question without inline rubric ID
 *   - UNKNOWN:         neither pattern dominates
 */
export function detectExamFormat(content: string): 'NUMBERED_RUBRIC' | 'NUMBERED_PLAIN' | 'UNKNOWN' {
  const lines = content.split('\n');

  let numberedRubricMarkers = 0;

  for (const line of lines) {
    // Check for the numbered_rubric characteristic: "### <RUBRIC>" (e.g. "### E3.")
    if (/###\s+[A-Z]\d+\./.test(line)) {
      numberedRubricMarkers++;
    }
    // Also count inline rubric IDs without the hash (e.g. "8 E7.")
    if (/^[\d\s]*[A-Z]\d+\./.test(line.trim())) {
      numberedRubricMarkers++;
    }
  }

  // If we found several markers, the content is likely the numbered_rubric format.
  if (numberedRubricMarkers >= 3) {
    return 'NUMBERED_RUBRIC';
  }

  // TODO: Add NUMBERED_PLAIN detection logic when needed.

  return 'UNKNOWN';
}

/**
 * Extracts "Maximum marks: N" from text.
 * Used to verify/supplement points from header.
 */
export function extractMaxMarks(text: string): number | null {
  const match = text.match(/Maximum\s+marks?:\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extracts question type from text.
 * Looks for patterns like "Type: Essay" or "Text area".
 */
export function extractQuestionType(text: string): string {
  // Check for explicit type declaration
  const typeMatch = text.match(/Type:\s*(\w+(?:\s+\w+)?)/i);
  if (typeMatch) {
    return typeMatch[1];
  }

  // Infer from content
  if (/essay/i.test(text)) return 'Essay';
  if (/text\s*area/i.test(text)) return 'Text area';
  if (/multiple\s*choice/i.test(text)) return 'Multiple choice';
  if (/short\s*answer/i.test(text)) return 'Short answer';

  return 'Unknown';
}
