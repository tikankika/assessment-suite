import { promises as fs } from 'fs';
import { Assessment, AspectScore, QualitySymbol } from '../types/assessment.js';

/**
 * AssessmentParser - Parses BEDÖMNING sections from Q-files
 *
 * Extracts structured assessment data from markdown format:
 * ```markdown
 * ### BEDÖMNING:
 * **AspectName:** Symbol **Xp** - Comment
 * ...
 * **TOTALPOÄNG: X/Yp**
 * **Kommentar:** ... (optional)
 * **→ Nästa steg:** ...
 * ---
 * ```
 */
export class AssessmentParser {
  private readonly STUDENT_HEADER_PATTERN = /^## Elev [A-Za-z0-9_]+ \(\d+ ord\)/;

  /**
   * Extract raw BEDÖMNING section for a student
   *
   * @param filePath - Path to Q-file
   * @param studentId - Student ID
   * @returns Raw BEDÖMNING markdown or null if not found
   */
  async extractRawBedömning(filePath: string, studentId: string): Promise<string | null> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.extractRawBedömningFromContent(content, studentId);
  }

  /**
   * Extract raw BEDÖMNING from content string
   */
  extractRawBedömningFromContent(content: string, studentId: string): string | null {
    const lines = content.split('\n');

    // Find student header
    const studentPattern = new RegExp(`^## Elev ${studentId} \\(\\d+ ord\\)`);
    let studentLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (studentPattern.test(lines[i])) {
        studentLineIndex = i;
        break;
      }
    }

    if (studentLineIndex === -1) {
      return null;
    }

    // Find next student or end of file
    let nextStudentIndex = lines.length;
    for (let i = studentLineIndex + 1; i < lines.length; i++) {
      if (this.STUDENT_HEADER_PATTERN.test(lines[i])) {
        nextStudentIndex = i;
        break;
      }
    }

    // Find assessment section within student's section (supports both Swedish and English headers)
    let bedömningStart = -1;
    let bedömningEnd = -1;

    for (let i = studentLineIndex + 1; i < nextStudentIndex; i++) {
      // The writer appends the student id to the header (`### BEDÖMNING: <id>`),
      // so match by prefix rather than exact equality (which only matched the
      // bare header used in hand-written fixtures).
      const headerTrimmed = lines[i].trim();
      if (headerTrimmed.startsWith('### BEDÖMNING:') || headerTrimmed.startsWith('### ANALYTIC ASSESSMENT:')) {
        bedömningStart = i;
      }
      if (bedömningStart !== -1 && lines[i].trim() === '---') {
        bedömningEnd = i;
        break;
      }
    }

    if (bedömningStart === -1) {
      return null;
    }

    if (bedömningEnd === -1) {
      bedömningEnd = nextStudentIndex;
    }

    return lines.slice(bedömningStart, bedömningEnd + 1).join('\n');
  }

  /**
   * Parse BEDÖMNING markdown into structured Assessment object
   *
   * @param rawBedömning - Raw BEDÖMNING markdown
   * @returns Parsed Assessment or null if parsing fails
   */
  parseBedömning(rawBedömning: string): Assessment | null {
    const lines = rawBedömning.split('\n');

    const aspects: AspectScore[] = [];
    let totalPoints = 0;
    let maxPoints = 0;
    let nextStep = '';
    let comment: string | undefined;

    // Regex patterns
    // Aspect: **Name:** Symbol **Xp** - Comment
    const aspectPattern = /^\*\*(.+?):\*\*\s*(✓✓✓|✓✓|✓|⚠|✗|-)\s*\*\*(\d+(?:[.,]\d+)?)\s*p\*\*\s*-\s*(.+)$/;

    // Total: **TOTALPOÄNG: X/Yp** or **TOTAL: X/Yp**
    const totalPattern = /^\*\*(?:TOTALPOÄNG|TOTAL):\s*(\d+(?:[.,]\d+)?)\/(\d+(?:[.,]\d+)?)\s*p\*\*$/;

    // Comment: **Kommentar:** ... or **Comment:** ...
    const commentPattern = /^\*\*(?:Kommentar|Comment):\*\*\s*(.+)$/;

    // Next step: **→ Nästa steg:** ... or **→ Next step:** ...
    const nextStepPattern = /^\*\*→\s*(?:Nästa steg|Next step):\*\*\s*(.+)$/;

    for (const line of lines) {
      const trimmed = line.trim();

      // Try aspect match
      const aspectMatch = trimmed.match(aspectPattern);
      if (aspectMatch) {
        aspects.push({
          name: aspectMatch[1],
          symbol: aspectMatch[2] as QualitySymbol,
          points: parseFloat(aspectMatch[3].replace(',', '.')),
          comment: aspectMatch[4],
        });
        continue;
      }

      // Try total match
      const totalMatch = trimmed.match(totalPattern);
      if (totalMatch) {
        totalPoints = parseFloat(totalMatch[1].replace(',', '.'));
        maxPoints = parseFloat(totalMatch[2].replace(',', '.'));
        continue;
      }

      // Try comment match
      const commentMatch = trimmed.match(commentPattern);
      if (commentMatch) {
        comment = commentMatch[1];
        continue;
      }

      // Try next step match
      const nextStepMatch = trimmed.match(nextStepPattern);
      if (nextStepMatch) {
        nextStep = nextStepMatch[1];
        continue;
      }
    }

    // Validate we got minimum required data
    if (aspects.length === 0 || !nextStep) {
      return null;
    }

    return {
      aspects,
      totalPoints,
      maxPoints,
      nextStep,
      comment,
    };
  }

  /**
   * Get full assessment for a student
   *
   * @param filePath - Path to Q-file
   * @param studentId - Student ID
   * @returns Parsed Assessment and raw text, or null if not assessed
   */
  async getAssessment(
    filePath: string,
    studentId: string
  ): Promise<{ assessment: Assessment; rawBedömning: string } | null> {
    const rawBedömning = await this.extractRawBedömning(filePath, studentId);
    if (!rawBedömning) {
      return null;
    }

    const assessment = this.parseBedömning(rawBedömning);
    if (!assessment) {
      return null;
    }

    return { assessment, rawBedömning };
  }
}
