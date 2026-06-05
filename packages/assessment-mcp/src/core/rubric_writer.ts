import { promises as fs } from 'fs';
import { escapeRegex } from '../utils/regex_utils.js';

/**
 * RubricWriter - Modifies bedömningsanvisningar markdown files
 *
 * Handles safe updates to rubric files while preserving structure.
 * Used by rubric_update tool for dynamic assessment adjustments.
 *
 * @see docs/design/rubric-update.md
 */

export interface AspectLocation {
  /** Start character index in the file content */
  startIndex: number;
  /** End character index (exclusive) */
  endIndex: number;
  /** Line number where aspect starts (1-based) */
  lineNumber: number;
  /** Current max points for this aspect */
  currentMaxPoints: number | null;
  /** Current criteria text */
  currentCriteria: string;
  /** Full aspect header line */
  headerLine: string;
}

export interface RubricUpdateOptions {
  /** New max points (optional) */
  newMaxPoints?: number;
  /** New criteria text (optional) */
  newCriteria?: string;
}

export interface RubricUpdateResult {
  success: boolean;
  previousMaxPoints: number | null;
  previousCriteria: string;
  newMaxPoints: number | null;
  newCriteria: string;
  changelogEntry: string;
}

export class RubricWriter {
  /**
   * Find the location of an aspect in the rubric file
   *
   * @param content - Full rubric file content
   * @param questionId - Question identifier (e.g., "E4", "6")
   * @param aspectName - Aspect name (e.g., "E4a", "6b")
   * @returns AspectLocation or null if not found
   */
  findAspectLocation(
    content: string,
    questionId: string,
    aspectName: string
  ): AspectLocation | null {
    const idUpper = questionId.toUpperCase();
    const aspectUpper = aspectName.toUpperCase();

    // Normalize IDs: strip "Question" or "Q" prefix for numeric matching
    const numericQuestionId = questionId.replace(/^(?:Question|Q)\s*/i, '').trim();
    // Extract aspect number from "ASPECT 1" or just "1"
    const aspectNumber = aspectName.replace(/^ASPECT\s*/i, '').trim();

    // Question patterns: support both Swedish and English formats
    const questionPatterns = [
      // Swedish: ## FRÅGA E3: or ## Fråga E3 (
      new RegExp(`^##?\\s*(?:Fråga|FRÅGA)\\s+${escapeRegex(idUpper)}[:\\s(]`, 'mi'),
      // English: # Question 7: or ## Question 7:
      new RegExp(`^#{1,3}\\s*Question\\s+${escapeRegex(numericQuestionId)}[:\\s]`, 'mi'),
      // Legacy: Original mixed pattern
      new RegExp(`^##?\\s*(?:Question|QUESTION)\\s+${escapeRegex(idUpper)}[:\\s(]`, 'mi'),
    ];

    // Try each question pattern
    let questionMatch: RegExpMatchArray | null = null;
    for (const pattern of questionPatterns) {
      questionMatch = content.match(pattern);
      if (questionMatch) break;
    }

    if (!questionMatch) {
      return null;
    }

    const questionStart = content.indexOf(questionMatch[0]);

    // Find next question to determine section end
    // Support both Swedish (## FRÅGA) and English (# Question) formats
    const nextQuestionMatch = content
      .slice(questionStart + questionMatch[0].length)
      .match(/^#{1,3}\s*(?:Fråga|FRÅGA|Question|QUESTION)\s+/m);

    const sectionEnd = nextQuestionMatch
      ? questionStart + questionMatch[0].length +
        content.slice(questionStart + questionMatch[0].length).indexOf(nextQuestionMatch[0])
      : content.length;

    const sectionContent = content.slice(questionStart, sectionEnd);

    // Find the aspect within this section
    // Patterns: "### E4a:", "**E4a:**", "ASPEKT E4a:", "**ASPECT 1:**", etc.
    const aspectPatterns = [
      // Exact aspect match (e.g., "### E4a:")
      new RegExp(`^(###?\\s*${escapeRegex(aspectUpper)}[:\\s].*)$`, 'mi'),
      // Bold aspect (e.g., "**E4a:**")
      new RegExp(`^(\\*\\*${escapeRegex(aspectUpper)}:\\*\\*.*)$`, 'mi'),
      // ASPEKT prefix (e.g., "### ASPEKT E4:")
      new RegExp(`^(###?\\s*ASPEKT\\s+${escapeRegex(aspectUpper)}[:\\s].*)$`, 'mi'),
      // Just ASPEKT (e.g., "ASPEKT E4:")
      new RegExp(`^(ASPEKT\\s+${escapeRegex(aspectUpper)}[:\\s].*)$`, 'mi'),
      // English ASPECT format: **ASPECT 1: Description (0.75p)**
      new RegExp(`^(\\*\\*ASPECT\\s+${escapeRegex(aspectNumber)}[:\\s].*)$`, 'mi'),
      // Bold ASPECT with number only (e.g., **1: ...**)
      new RegExp(`^(\\*\\*${escapeRegex(aspectNumber)}[:\\s].*)$`, 'mi'),
    ];

    let aspectMatch: RegExpMatchArray | null = null;
    for (const pattern of aspectPatterns) {
      aspectMatch = sectionContent.match(pattern);
      if (aspectMatch) break;
    }

    if (!aspectMatch) {
      return null;
    }

    const aspectHeader = aspectMatch[1];
    const aspectStartInSection = sectionContent.indexOf(aspectHeader);
    const aspectStart = questionStart + aspectStartInSection;

    // Find where this aspect ends (next aspect or section end)
    const afterAspect = sectionContent.slice(aspectStartInSection + aspectHeader.length);
    const nextAspectPatterns = [
      /^###?\s*[A-Za-z0-9]+[a-z]:/m,
      /^\*\*[A-Za-z0-9]+[a-z]:\*\*/m,
      /^ASPEKT\s+/m,
      // English ASPECT format: **ASPECT 2: or **ASPECT 3:
      /^\*\*ASPECT\s+\d+:/m,
    ];

    let nextAspectIndex = afterAspect.length;
    for (const pattern of nextAspectPatterns) {
      const match = afterAspect.match(pattern);
      if (match && afterAspect.indexOf(match[0]) < nextAspectIndex) {
        nextAspectIndex = afterAspect.indexOf(match[0]);
      }
    }

    const aspectEnd = aspectStart + aspectHeader.length + nextAspectIndex;

    // Extract current max points from header
    const pointsMatch = aspectHeader.match(/\((\d+(?:[.,]\d+)?)\s*p(?:oäng)?\)/i);
    const currentMaxPoints = pointsMatch
      ? parseFloat(pointsMatch[1].replace(',', '.'))
      : null;

    // Extract criteria text (everything after header until next aspect)
    const criteriaContent = sectionContent
      .slice(aspectStartInSection + aspectHeader.length, aspectStartInSection + aspectHeader.length + nextAspectIndex)
      .trim();

    // Calculate line number
    const lineNumber = content.slice(0, aspectStart).split('\n').length;

    return {
      startIndex: aspectStart,
      endIndex: aspectEnd,
      lineNumber,
      currentMaxPoints,
      currentCriteria: criteriaContent,
      headerLine: aspectHeader,
    };
  }

  /**
   * Update an aspect in the rubric file
   *
   * @param rubricPath - Path to rubric file
   * @param questionId - Question identifier
   * @param aspectName - Aspect name
   * @param options - Update options (newMaxPoints, newCriteria)
   * @param reason - Reason for the change (required for audit)
   * @returns RubricUpdateResult
   */
  async updateAspect(
    rubricPath: string,
    questionId: string,
    aspectName: string,
    options: RubricUpdateOptions,
    reason: string
  ): Promise<RubricUpdateResult> {
    // Create backup before modifying
    const backupPath = `${rubricPath}.bak`;
    await fs.copyFile(rubricPath, backupPath);

    const content = await fs.readFile(rubricPath, 'utf-8');

    const location = this.findAspectLocation(content, questionId, aspectName);
    if (!location) {
      throw new Error(
        `Aspect '${aspectName}' not found in question '${questionId}'. ` +
        `Check that both the question and aspect exist in the rubric.`
      );
    }

    const previousMaxPoints = location.currentMaxPoints;
    const previousCriteria = location.currentCriteria;

    let newContent = content;
    let newMaxPoints = previousMaxPoints;
    let newCriteria = previousCriteria;

    // Update max points in header if requested
    if (options.newMaxPoints !== undefined) {
      const oldHeader = location.headerLine;
      let newHeader: string;

      if (location.currentMaxPoints !== null) {
        // Replace existing points
        newHeader = oldHeader.replace(
          /\((\d+(?:[.,]\d+)?)\s*p(?:oäng)?\)/i,
          `(${options.newMaxPoints}p)`
        );
      } else {
        // Add points to end of header line
        newHeader = oldHeader.trimEnd() + ` (${options.newMaxPoints}p)`;
      }

      newContent = newContent.replace(oldHeader, newHeader);
      newMaxPoints = options.newMaxPoints;
    }

    // Update criteria if requested
    if (options.newCriteria !== undefined) {
      // Find the criteria section (after header, before next aspect)
      const criteriaStart = location.startIndex + location.headerLine.length;
      const criteriaEnd = location.endIndex;

      // Replace criteria while preserving structure
      const beforeCriteria = newContent.slice(0, criteriaStart);
      const afterCriteria = newContent.slice(criteriaEnd);

      newContent = beforeCriteria + '\n' + options.newCriteria + '\n\n' + afterCriteria;
      newCriteria = options.newCriteria;
    }

    // Add changelog comment at end of question section
    const timestamp = new Date().toISOString();
    const changelogEntry = this.formatChangelogEntry(
      timestamp,
      questionId,
      aspectName,
      previousMaxPoints,
      newMaxPoints,
      reason
    );

    // Append changelog as HTML comment (invisible in rendered markdown)
    newContent = this.appendChangelog(newContent, questionId, changelogEntry);

    // Write updated content
    await fs.writeFile(rubricPath, newContent, 'utf-8');

    return {
      success: true,
      previousMaxPoints,
      previousCriteria,
      newMaxPoints,
      newCriteria,
      changelogEntry,
    };
  }

  /**
   * Format a changelog entry
   */
  private formatChangelogEntry(
    timestamp: string,
    questionId: string,
    aspectName: string,
    previousPoints: number | null,
    newPoints: number | null,
    reason: string
  ): string {
    const pointsChange =
      previousPoints !== newPoints
        ? `max_points: ${previousPoints ?? 'null'} → ${newPoints ?? 'null'}`
        : 'criteria updated';

    return (
      `<!-- RUBRIC-CHANGE: ${timestamp}\n` +
      `  Question: ${questionId}\n` +
      `  Aspect: ${aspectName}\n` +
      `  Change: ${pointsChange}\n` +
      `  Reason: "${reason}"\n` +
      `-->`
    );
  }

  /**
   * Append changelog entry to end of question section
   */
  private appendChangelog(
    content: string,
    questionId: string,
    changelogEntry: string
  ): string {
    const idUpper = questionId.toUpperCase();
    const numericId = questionId.replace(/^(?:Question|Q)\s*/i, '').trim();

    // Find the question section (support both Swedish and English formats)
    const questionPatterns = [
      new RegExp(`^##?\\s*(?:Fråga|FRÅGA)\\s+${escapeRegex(idUpper)}[:\\s(]`, 'mi'),
      new RegExp(`^#{1,3}\\s*Question\\s+${escapeRegex(numericId)}[:\\s]`, 'mi'),
      new RegExp(`^##?\\s*(?:Question|QUESTION)\\s+${escapeRegex(idUpper)}[:\\s(]`, 'mi'),
    ];

    let questionMatch: RegExpMatchArray | null = null;
    for (const pattern of questionPatterns) {
      questionMatch = content.match(pattern);
      if (questionMatch) break;
    }

    if (!questionMatch) {
      // If question not found, append at end
      return content + '\n\n' + changelogEntry;
    }

    const questionStart = content.indexOf(questionMatch[0]);

    // Find next question to determine section end
    const nextQuestionMatch = content
      .slice(questionStart + questionMatch[0].length)
      .match(/^#{1,3}\s*(?:Fråga|FRÅGA|Question|QUESTION)\s+/m);

    if (nextQuestionMatch) {
      // Insert before next question
      const insertIndex = questionStart + questionMatch[0].length +
        content.slice(questionStart + questionMatch[0].length).indexOf(nextQuestionMatch[0]);

      return (
        content.slice(0, insertIndex) +
        '\n' + changelogEntry + '\n\n' +
        content.slice(insertIndex)
      );
    } else {
      // Last question - append at end
      return content + '\n\n' + changelogEntry;
    }
  }


  /**
   * Check if a rubric file exists and is writable
   */
  async canWrite(rubricPath: string): Promise<boolean> {
    try {
      await fs.access(rubricPath, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
}
