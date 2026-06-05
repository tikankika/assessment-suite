import { promises as fs } from 'fs';
import { Assessment, formatBedömning } from '../types/assessment.js';
import { debugLog } from './debug.js';

/**
 * Metadata for Phase 6 assessment (machine-readable for Phase 7)
 * Added for reliable Phase 7 parsing of free-text assessments
 */
export interface AssessmentMetadata {
  total_points?: number;
  max_points?: number;
  assessed_by?: string;
}

/**
 * AssessmentWriter - Writes BEDÖMNING sections to Q-files
 *
 * Inserts assessment after student answer, before next student or EOF.
 *
 * BEDÖMNING format:
 * ```markdown
 * ### BEDÖMNING:
 * **<aspect-id> (<aspect-name>):** <symbols> **<P>p** - <short comment>
 * ... (one line per aspect)
 *
 * **TOTALPOÄNG: <sum>/<max>p**
 * **→ Nästa steg:** <forward-looking feedback>
 *
 * ---
 * ```
 *
 * @see docs/design/001-assessment-format.md
 */
export class AssessmentWriter {
  /**
   * Regex pattern for student headers
   * Supports both numeric and alphanumeric student IDs
   */
  private readonly STUDENT_PATTERN = /^## Elev ([A-Za-z0-9_]+) \((\d+) ord\)/;

  /**
   * Write assessment for a student
   *
   * @param filePath - Path to Q-file
   * @param studentId - Student ID to assess
   * @param assessment - Assessment data
   * @returns Line position after write (for status tracking)
   */
  async writeAssessment(
    filePath: string,
    studentId: string,
    assessment: Assessment,
    assessedBy?: string
  ): Promise<{ success: boolean; insertedAtLine: number }> {
    debugLog('[AssessmentWriter.writeAssessment] START');
    debugLog('[AssessmentWriter.writeAssessment] filePath:', filePath);
    debugLog('[AssessmentWriter.writeAssessment] studentId:', studentId);

    try {
      debugLog('[AssessmentWriter.writeAssessment] Reading file...');
      const content = await fs.readFile(filePath, 'utf-8');
      debugLog('[AssessmentWriter.writeAssessment] File read, length:', content.length);
      const lines = content.split('\n');
      debugLog('[AssessmentWriter.writeAssessment] Lines count:', lines.length);

      // Find student section
      debugLog('[AssessmentWriter.writeAssessment] Finding student line...');
      const studentLineIndex = this.findStudentLine(lines, studentId);
      debugLog('[AssessmentWriter.writeAssessment] studentLineIndex:', studentLineIndex);
      if (studentLineIndex === -1) {
        debugLog('[AssessmentWriter.writeAssessment] ERROR: Student not found!');
        debugLog('[AssessmentWriter.writeAssessment] Looking for pattern: ## Elev', studentId);
        // Debug: show first 10 lines that start with "## Elev"
        const studentLines = lines.filter(l => l.startsWith('## Elev')).slice(0, 5);
        debugLog('[AssessmentWriter.writeAssessment] Sample student lines:', studentLines);
        throw new Error(`Student ${studentId} not found in file`);
      }

      // Find where to insert (before next student or EOF)
      debugLog('[AssessmentWriter.writeAssessment] Finding insert position...');
      const insertIndex = this.findInsertPosition(lines, studentLineIndex);
      debugLog('[AssessmentWriter.writeAssessment] insertIndex:', insertIndex);

      // Check if already has assessment (supports both old Swedish and new English headers)
      const sectionContent = lines.slice(studentLineIndex, insertIndex).join('\n');
      if (sectionContent.includes('### BEDÖMNING:') || sectionContent.includes('### ANALYTIC ASSESSMENT:')) {
        debugLog('[AssessmentWriter.writeAssessment] ERROR: Already has assessment');
        throw new Error(`Student ${studentId} already has assessment section`);
      }

      // Format the assessment
      debugLog('[AssessmentWriter.writeAssessment] Formatting BEDÖMNING...');
      const bedömningText = formatBedömning(assessment, studentId, assessedBy);
      debugLog('[AssessmentWriter.writeAssessment] BEDÖMNING text length:', bedömningText.length);

      // Insert BEDÖMNING before the insert position
      // Add newline before if previous line is not empty
      const insertLines = bedömningText.split('\n');

      // Check if we need a blank line before BEDÖMNING
      const prevLineIndex = insertIndex - 1;
      const needsBlankBefore =
        prevLineIndex >= 0 &&
        lines[prevLineIndex].trim() !== '' &&
        lines[prevLineIndex].trim() !== '---';

      if (needsBlankBefore) {
        insertLines.unshift('');
      }

      // Insert the BEDÖMNING
      debugLog('[AssessmentWriter.writeAssessment] Inserting', insertLines.length, 'lines at index', insertIndex);
      lines.splice(insertIndex, 0, ...insertLines);

      // Write back to file
      const newContent = lines.join('\n');
      debugLog('[AssessmentWriter.writeAssessment] Writing file, new length:', newContent.length);
      await fs.writeFile(filePath, newContent, 'utf-8');
      debugLog('[AssessmentWriter.writeAssessment] File written successfully!');

      return {
        success: true,
        insertedAtLine: insertIndex,
      };
    } catch (error) {
      debugLog('[AssessmentWriter.writeAssessment] ERROR:', error);
      throw new Error(`Failed to write assessment for ${studentId}: ${error}`);
    }
  }

  /**
   * Write free-text assessment for a student (no structured validation)
   *
   * RFC-021: Uses v2 format with START/END markers for reliable Phase 7 parsing.
   *
   * @param filePath - Path to Q-file
   * @param studentId - Student ID to assess
   * @param bedömningText - Free-form assessment text from Claude Desktop
   * @param metadata - Optional structured metadata for Phase 7 parsing
   * @returns Line position after write (for status tracking)
   */
  async writeFreetextAssessment(
    filePath: string,
    studentId: string,
    bedömningText: string,
    metadata?: AssessmentMetadata
  ): Promise<{ success: boolean; insertedAtLine: number }> {
    debugLog('[AssessmentWriter.writeFreetextAssessment] START');
    debugLog('[AssessmentWriter.writeFreetextAssessment] filePath:', filePath);
    debugLog('[AssessmentWriter.writeFreetextAssessment] studentId:', studentId);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Find student section
      const studentLineIndex = this.findStudentLine(lines, studentId);
      if (studentLineIndex === -1) {
        throw new Error(`Student ${studentId} not found in file`);
      }

      // Find where to insert (before next student or EOF)
      const insertIndex = this.findInsertPosition(lines, studentLineIndex);

      // Check if already has assessment (v1 or v2 format)
      const sectionContent = lines.slice(studentLineIndex, insertIndex).join('\n');
      if (
        sectionContent.includes('### BEDÖMNING:') ||
        sectionContent.includes('### ANALYTIC ASSESSMENT:') ||
        sectionContent.includes('PHASE6_ASSESSMENT_START')
      ) {
        throw new Error(`Student ${studentId} already has assessment section`);
      }

      // RFC-021: Build v2 format with START/END markers
      const trimmedText = bedömningText.trim();

      // Strip header if already present (we'll add our own)
      let bodyText = trimmedText;
      if (trimmedText.startsWith('### BEDÖMNING')) {
        // Remove existing header line
        const headerEnd = trimmedText.indexOf('\n');
        if (headerEnd !== -1) {
          bodyText = trimmedText.slice(headerEnd + 1).trim();
        }
      }

      // Build metadata values
      const totalPoints = metadata?.total_points ?? null;
      const maxPoints = metadata?.max_points ?? null;
      const assessedBy = metadata?.assessed_by ?? 'unknown';
      const assessedAt = new Date().toISOString();

      // RFC-021 v2 format
      const formattedText = `<!-- PHASE6_ASSESSMENT_START student_id="${studentId}" -->
### BEDÖMNING: ${studentId}

${bodyText}

<!-- PHASE6_ASSESSMENT
student_id: ${studentId}
total_points: ${totalPoints}
max_points: ${maxPoints}
assessed_by: ${assessedBy}
assessed_at: ${assessedAt}
format_version: 2
-->
<!-- PHASE6_ASSESSMENT_END -->

---`;

      const insertLines = formattedText.split('\n');

      // Check if we need a blank line before BEDÖMNING
      const prevLineIndex = insertIndex - 1;
      const needsBlankBefore =
        prevLineIndex >= 0 &&
        lines[prevLineIndex].trim() !== '' &&
        lines[prevLineIndex].trim() !== '---';

      if (needsBlankBefore) {
        insertLines.unshift('');
      }

      // Insert the BEDÖMNING
      debugLog('[AssessmentWriter.writeFreetextAssessment] Inserting', insertLines.length, 'lines at index', insertIndex);
      lines.splice(insertIndex, 0, ...insertLines);

      // Write back to file
      await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
      debugLog('[AssessmentWriter.writeFreetextAssessment] File written successfully!');

      return {
        success: true,
        insertedAtLine: insertIndex,
      };
    } catch (error) {
      debugLog('[AssessmentWriter.writeFreetextAssessment] ERROR:', error);
      throw new Error(`Failed to write freetext assessment for ${studentId}: ${error}`);
    }
  }

  /**
   * Find the line index where a student section starts
   *
   * @param lines - File content as array of lines
   * @param studentId - Student ID to find
   * @returns Line index or -1 if not found
   */
  private findStudentLine(lines: string[], studentId: string): number {
    const pattern = new RegExp(`^## Elev ${studentId} \\(\\d+ ord\\)`);

    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Find where to insert BEDÖMNING
   *
   * Priority order:
   * 1. PHASE5_STUDENT_END marker (new format) - insert BEFORE it
   * 2. </details> tags - insert AFTER last one
   * 3. Next student header or separator (legacy fallback)
   *
   * @param lines - File content as array of lines
   * @param studentLineIndex - Line where student header is
   * @returns Line index to insert before
   */
  private findInsertPosition(lines: string[], studentLineIndex: number): number {
    // Find where student section ends (next student header or EOF)
    let sectionEndIndex = lines.length;
    for (let i = studentLineIndex + 1; i < lines.length; i++) {
      if (this.STUDENT_PATTERN.test(lines[i])) {
        sectionEndIndex = i;
        break;
      }
    }

    // PRIORITY 1: Look for PHASE5_STUDENT_END marker (new format from Phase 5)
    // Insert BEFORE this marker so BEDÖMNING is inside the student section
    for (let i = studentLineIndex + 1; i < sectionEndIndex; i++) {
      if (lines[i].includes('PHASE5_STUDENT_END')) {
        // Insert before the END marker, but after PHASE5_ANSWER if present
        // Look backwards for PHASE5_ANSWER to insert after it
        for (let j = i - 1; j > studentLineIndex; j--) {
          if (lines[j].includes('PHASE5_ANSWER')) {
            // Find the closing --> of the PHASE5_ANSWER comment
            for (let k = j; k < i; k++) {
              if (lines[k].includes('-->')) {
                return k + 1; // Insert after the closing -->
              }
            }
          }
        }
        return i; // Insert before PHASE5_STUDENT_END
      }
    }

    // PRIORITY 2: Find the last </details> tag in the student's section
    // BEDÖMNING must be placed AFTER all </details> tags
    let lastDetailsCloseIndex = -1;
    for (let i = studentLineIndex + 1; i < sectionEndIndex; i++) {
      if (lines[i].trim() === '</details>') {
        lastDetailsCloseIndex = i;
      }
    }

    // If we found a </details> tag, insert after it (with a blank line)
    if (lastDetailsCloseIndex !== -1) {
      // Skip any blank lines immediately after </details>
      let insertPos = lastDetailsCloseIndex + 1;
      while (insertPos < sectionEndIndex && lines[insertPos].trim() === '') {
        insertPos++;
      }
      return insertPos;
    }

    // PRIORITY 3: Legacy fallback - use original logic
    // Insert before next student or at end
    if (sectionEndIndex < lines.length) {
      // Insert before the separator line (---) if it exists
      if (sectionEndIndex > 0 && lines[sectionEndIndex - 1].trim() === '---') {
        return sectionEndIndex - 1;
      }
      return sectionEndIndex;
    }

    // No next student found - this is the last student
    // Look for separator (---) after student's content and insert BEFORE it
    for (let i = studentLineIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        return i; // Insert before the separator
      }
    }

    // No separator found, insert at end (but skip trailing empty lines)
    let endIndex = lines.length;
    while (endIndex > studentLineIndex && lines[endIndex - 1].trim() === '') {
      endIndex--;
    }

    return endIndex;
  }

  /**
   * Check if a student already has a BEDÖMNING section
   *
   * BUGFIX 2026-01-08: Search entire student section, not just up to insert position.
   * This ensures we detect BEDÖMNING even if it was previously misplaced.
   *
   * @param filePath - Path to Q-file
   * @param studentId - Student ID to check
   * @returns true if student has BEDÖMNING
   */
  async hasAssessment(filePath: string, studentId: string): Promise<boolean> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    const studentLineIndex = this.findStudentLine(lines, studentId);
    if (studentLineIndex === -1) {
      return false;
    }

    // BUGFIX: Search entire section, not just up to insert position
    const sectionEndIndex = this.findSectionEnd(lines, studentLineIndex);
    const sectionContent = lines.slice(studentLineIndex, sectionEndIndex).join('\n');

    return sectionContent.includes('### BEDÖMNING:') || sectionContent.includes('### ANALYTIC ASSESSMENT:');
  }

  /**
   * Remove BEDÖMNING section from a student (for re-assessment)
   *
   * BUGFIX 2026-01-08: Search entire student section, not just up to insert position.
   * This ensures we find BEDÖMNING even if it was previously misplaced (e.g., after </details>).
   *
   * @param filePath - Path to Q-file
   * @param studentId - Student ID
   * @returns true if removed, false if not found
   */
  async removeAssessment(filePath: string, studentId: string): Promise<boolean> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    const studentLineIndex = this.findStudentLine(lines, studentId);
    if (studentLineIndex === -1) {
      return false;
    }

    // BUGFIX: Find actual section end (next student or EOF), not insert position
    // This ensures we search the entire student section for misplaced BEDÖMNING
    const sectionEndIndex = this.findSectionEnd(lines, studentLineIndex);

    // Find BEDÖMNING section within student's ENTIRE section
    // RFC-025: Support BOTH formats:
    // 1. Legacy: ### BEDÖMNING: ... ---
    // 2. v2: <!-- PHASE6_ASSESSMENT_START ... --> ... <!-- PHASE6_ASSESSMENT_END --> ... ---
    let bedömningStart = -1;
    let bedömningEnd = -1;

    for (let i = studentLineIndex + 1; i < sectionEndIndex; i++) {
      const trimmedLine = lines[i].trim();

      // Check for v2 format START marker (higher priority)
      if (trimmedLine.includes('PHASE6_ASSESSMENT_START') && trimmedLine.includes(studentId)) {
        bedömningStart = i;
      }
      // Check for legacy format headers
      else if (bedömningStart === -1 && (trimmedLine === '### BEDÖMNING:' || trimmedLine === '### ANALYTIC ASSESSMENT:')) {
        bedömningStart = i;
      }

      // Find end marker (--- separator)
      if (bedömningStart !== -1 && trimmedLine === '---') {
        bedömningEnd = i + 1; // Include the separator
        break;
      }
    }

    if (bedömningStart === -1) {
      return false; // No BEDÖMNING to remove
    }

    if (bedömningEnd === -1) {
      bedömningEnd = sectionEndIndex;
    }

    // Remove the BEDÖMNING lines
    lines.splice(bedömningStart, bedömningEnd - bedömningStart);

    // Write back
    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');

    return true;
  }

  /**
   * Find where a student's section ends (next student header or EOF)
   *
   * Unlike findInsertPosition(), this always returns the actual section boundary,
   * not a position adjusted for <details> tags.
   *
   * @param lines - File content as array of lines
   * @param studentLineIndex - Line where student header is
   * @returns Line index where section ends
   */
  private findSectionEnd(lines: string[], studentLineIndex: number): number {
    for (let i = studentLineIndex + 1; i < lines.length; i++) {
      if (this.STUDENT_PATTERN.test(lines[i])) {
        return i;
      }
    }
    return lines.length;
  }
}
