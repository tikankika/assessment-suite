import { promises as fs } from 'fs';
import { Rubric, RubricAspect } from '../types/assessment.js';
import { Aspect } from '../types/status.js';
import type { QuestionConfig } from './exam_config_reader.js';
import { escapeRegex } from '../utils/regex_utils.js';

/**
 * RubricParser - Parses bedömningsanvisningar (assessment rubrics)
 *
 * Extracts question-specific rubrics from bedömningsanvisningar files.
 *
 * @see docs/design/001-assessment-format.md
 */
export class RubricParser {
  /**
   * Parse rubric for a specific question from bedömningsanvisningar file
   *
   * @param rubricPath - Path to bedömningsanvisningar file
   * @param questionNumber - Question number to extract (e.g., 6)
   * @returns Rubric object or null if not found
   */
  async parseQuestion(
    rubricPath: string,
    questionNumber: number
  ): Promise<Rubric | null> {
    const content = await fs.readFile(rubricPath, 'utf-8');
    return this.parseQuestionFromContent(content, questionNumber);
  }

  /**
   * Parse rubric from content string
   *
   * @param content - Rubric file content
   * @param questionNumber - Question number to extract
   * @returns Rubric object or null if not found
   */
  parseQuestionFromContent(content: string, questionNumber: number): Rubric | null {
    // Pattern to find question section
    // Handles: "## Fråga 6:", "## Question 6:", "# FRÅGA 6:", etc.
    const questionPattern = new RegExp(
      `^##?\\s*(?:Fråga|FRÅGA|Question|QUESTION)\\s+${questionNumber}[:\\s](.*)$`,
      'm'
    );

    const match = content.match(questionPattern);
    if (!match) {
      return null;
    }

    const questionTitle = match[1].trim();

    // Find the section content (until next question or EOF)
    const startIndex = content.indexOf(match[0]);
    const nextQuestionMatch = content
      .slice(startIndex + match[0].length)
      .match(/^##?\s*(?:Fråga|FRÅGA|Question|QUESTION)\s+\d+/m);

    const endIndex = nextQuestionMatch
      ? startIndex + match[0].length + content.slice(startIndex + match[0].length).indexOf(nextQuestionMatch[0])
      : content.length;

    const sectionContent = content.slice(startIndex, endIndex);

    const maxPoints = this.extractMaxPoints(sectionContent);

    // Extract aspects
    const aspects = this.extractAspects(sectionContent, questionNumber);

    return {
      questionNumber,
      questionTitle,
      maxPoints,
      aspects,
      rawText: sectionContent.trim(),
    };
  }

  /**
   * Extract aspects from rubric section
   *
   * @param content - Section content
   * @param questionNumber - Question number for aspect naming
   * @returns Array of RubricAspect
   */
  /**
   * Extract a question's max points from its section, trying three formats in
   * order: an explicit `**Points:**` line, a `**TOTAL: Xp**` line, then a
   * `(Xp)` marker in the header (first 5 lines, to avoid matching aspect points).
   */
  private extractMaxPoints(sectionContent: string): number {
    let maxPoints = 0;

    // Format 1: **Points:** **Xp** (explicit points line)
    const explicitPointsMatch = sectionContent.match(/\*\*Points:\*\*.*?(\d+(?:[.,]\d+)?)\s*p/i);
    if (explicitPointsMatch) {
      maxPoints = parseFloat(explicitPointsMatch[1].replace(',', '.'));
    }

    // Format 2: **TOTAL: X.Xp** (total at end of section)
    if (maxPoints === 0) {
      const totalMatch = sectionContent.match(/\*\*TOTAL:\s*(\d+(?:[.,]\d+)?)\s*p\*\*/i);
      if (totalMatch) {
        maxPoints = parseFloat(totalMatch[1].replace(',', '.'));
      }
    }

    // Format 3: (Xp) in header line only (avoid matching aspect points)
    if (maxPoints === 0) {
      const headerLines = sectionContent.split('\n').slice(0, 5).join('\n');
      const headerPointsMatch = headerLines.match(/\((\d+(?:[.,]\d+)?)\s*p(?:oäng)?\)/i);
      if (headerPointsMatch) {
        maxPoints = parseFloat(headerPointsMatch[1].replace(',', '.'));
      }
    }

    return maxPoints;
  }

  private extractAspects(content: string, questionNumber: number): RubricAspect[] {
    const aspects: RubricAspect[] = [];

    // Pattern for aspects: "### 6a:", "**6a:**", "6a)", etc.
    const aspectPattern = new RegExp(
      `(?:^###?\\s*|\\*\\*|^)(${questionNumber}[a-z])(?:[:\\)]|\\*\\*)\\s*(.*)`,
      'gim'
    );

    let aspectMatch;
    while ((aspectMatch = aspectPattern.exec(content)) !== null) {
      const aspectName = aspectMatch[1].toLowerCase();
      const description = aspectMatch[2].trim();

      // Try to find max points for this aspect
      const pointsPattern = new RegExp(
        `${aspectName}[^\\d]*(\\d+(?:[.,]\\d+)?)\\s*p`,
        'i'
      );
      const pointsMatch = content.match(pointsPattern);
      const maxPoints = pointsMatch
        ? parseFloat(pointsMatch[1].replace(',', '.'))
        : 0;

      aspects.push({
        name: `${questionNumber}${aspectName.slice(-1)}: ${description.slice(0, 30)}`,
        maxPoints,
        description,
      });
    }

    return aspects;
  }

  /**
   * Validate that rubric matches Q-file question
   *
   * @param rubricPath - Path to rubric file
   * @param qFilePath - Path to Q-file
   * @returns Validation result with warnings/errors
   */
  async validateMatch(
    rubricPath: string,
    qFilePath: string
  ): Promise<{ valid: boolean; warnings: string[]; errors: string[] }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Extract question number from Q-file
      const qContent = await fs.readFile(qFilePath, 'utf-8');
      const qMatch = qContent.match(/^#\s*(?:FRÅGA|QUESTION)\s+(\d+)/m);

      if (!qMatch) {
        errors.push('Could not find question number in Q-file');
        return { valid: false, warnings, errors };
      }

      const questionNumber = parseInt(qMatch[1], 10);

      // Check if rubric has this question
      const rubric = await this.parseQuestion(rubricPath, questionNumber);

      if (!rubric) {
        errors.push(`Question ${questionNumber} not found in rubric file`);
        return { valid: false, warnings, errors };
      }

      // Check if aspects sum to max points
      if (rubric.aspects.length > 0) {
        const aspectSum = rubric.aspects.reduce((sum, a) => sum + a.maxPoints, 0);
        if (Math.abs(aspectSum - rubric.maxPoints) > 0.01) {
          warnings.push(
            `Aspect points (${aspectSum}) don't sum to max points (${rubric.maxPoints})`
          );
        }
      }

      // Check for missing aspects
      if (rubric.aspects.length === 0) {
        warnings.push('No aspects found in rubric');
      }

      return { valid: errors.length === 0, warnings, errors };
    } catch (error) {
      errors.push(`Validation failed: ${error}`);
      return { valid: false, warnings, errors };
    }
  }

  /**
   * Convert RubricAspect array to Aspect array (for status)
   */
  toStatusAspects(rubricAspects: RubricAspect[]): Aspect[] {
    return rubricAspects.map(a => ({
      name: a.name,
      max: a.maxPoints,
    }));
  }

  /**
   * Extract relevant section from rubric for a specific question
   * (For providing context to Claude Desktop)
   *
   * @param rubricPath - Path to rubric file
   * @param questionNumber - Question number
   * @returns Formatted rubric section text
   */
  async getRubricSection(
    rubricPath: string,
    questionNumber: number
  ): Promise<string> {
    const rubric = await this.parseQuestion(rubricPath, questionNumber);

    if (!rubric) {
      return `Rubric for question ${questionNumber} not found`;
    }

    return rubric.rawText;
  }

  /**
   * Parse rubric by alphanumeric rubric ID (e.g., "E4", "C1", "A3", "SKELETT")
   *
   * This is the preferred method when Q-files have Rubric-ID in frontmatter.
   * Handles various formats:
   * - "## FRÅGA E4: Title"
   * - "## FRÅGA 6 (E3): Title"
   * - "## FRÅGA: SKELETT OCH LEDER"
   *
   * @param rubricPath - Path to bedömningsanvisningar file
   * @param rubricId - Alphanumeric rubric ID (e.g., "E4", "6", "SKELETT")
   * @returns Rubric object or null if not found
   */
  async parseQuestionByRubricId(
    rubricPath: string,
    rubricId: string
  ): Promise<Rubric | null> {
    const content = await fs.readFile(rubricPath, 'utf-8');
    return this.parseQuestionByRubricIdFromContent(content, rubricId);
  }

  /**
   * Parse rubric by ID from content string
   *
   * @param content - Rubric file content
   * @param rubricId - Alphanumeric rubric ID
   * @returns Rubric object or null if not found
   */
  parseQuestionByRubricIdFromContent(content: string, rubricId: string): Rubric | null {
    const idUpper = rubricId.toUpperCase();

    // Pattern 1: Standard format "## FRÅGA E4:" or "## FRÅGA 6 (E3):"
    const standardPattern = new RegExp(
      `^##?\\s*(?:Fråga|FRÅGA|Question|QUESTION)\\s+${escapeRegex(idUpper)}(?:\\s*\\([A-Za-z0-9]+\\))?[:\\s]+(.*)$`,
      'mi'
    );

    let match = content.match(standardPattern);

    // Pattern 2: Title-as-ID format "## FRÅGA: SKELETT OCH LEDER"
    if (!match && idUpper.length > 2) {
      const titlePattern = new RegExp(
        `^##?\\s*(?:Fråga|FRÅGA|Question|QUESTION):\\s*(${escapeRegex(idUpper)}[^(]*)(?:\\(.*\\))?\\s*$`,
        'mi'
      );
      match = content.match(titlePattern);
    }

    if (!match) {
      return null;
    }

    const questionTitle = match[1].trim();

    // Find the section content (until next question or EOF)
    const startIndex = content.indexOf(match[0]);

    // Look for next question header (any format)
    const nextQuestionMatch = content
      .slice(startIndex + match[0].length)
      .match(/^##?\s*(?:Fråga|FRÅGA|Question|QUESTION)[\s:]+/m);

    const endIndex = nextQuestionMatch
      ? startIndex + match[0].length + content.slice(startIndex + match[0].length).indexOf(nextQuestionMatch[0])
      : content.length;

    const sectionContent = content.slice(startIndex, endIndex);

    const maxPoints = this.extractMaxPoints(sectionContent);

    // Extract aspects using the rubric ID
    const aspects = this.extractAspectsByRubricId(sectionContent, rubricId);

    return {
      questionNumber: this.extractNumberFromId(rubricId),
      questionTitle,
      maxPoints,
      aspects,
      rawText: sectionContent.trim(),
    };
  }

  /**
   * Extract aspects using rubric ID prefix (handles E4a, C1b, etc.)
   */
  private extractAspectsByRubricId(content: string, rubricId: string): RubricAspect[] {
    const aspects: RubricAspect[] = [];
    const idUpper = rubricId.toUpperCase();

    // Try patterns like "ASPEKT E4a:", "E4a:", "**E4a**", etc.
    // Also try patterns like "ASPEKT 6a:", "ASPEKT SKEL1:", etc.
    const patterns = [
      new RegExp(`(?:^###?\\s*|\\*\\*|ASPEKT\\s+)(${escapeRegex(idUpper)}[a-z])(?:[:\\)]|\\*\\*)\\s*(.*)`, 'gim'),
      new RegExp(`(?:^###?\\s*|\\*\\*|ASPEKT\\s+)(${escapeRegex(idUpper)}\\d+)(?:[:\\)]|\\*\\*)\\s*(.*)`, 'gim'),
    ];

    for (const aspectPattern of patterns) {
      let aspectMatch;
      while ((aspectMatch = aspectPattern.exec(content)) !== null) {
        const aspectName = aspectMatch[1].toUpperCase();
        const description = aspectMatch[2].trim();

        // Avoid duplicates
        if (aspects.some(a => a.name.startsWith(aspectName))) {
          continue;
        }

        // Try to find max points for this aspect
        const pointsPattern = new RegExp(
          `${escapeRegex(aspectName)}[^\\d]*(\\d+(?:[.,]\\d+)?)\\s*p`,
          'i'
        );
        const pointsMatch = content.match(pointsPattern);
        const maxPoints = pointsMatch
          ? parseFloat(pointsMatch[1].replace(',', '.'))
          : 0;

        aspects.push({
          name: `${aspectName}: ${description.slice(0, 40)}`,
          maxPoints,
          description,
        });
      }
    }

    return aspects;
  }

  /**
   * Extract numeric part from rubric ID for backwards compatibility
   */
  private extractNumberFromId(rubricId: string): number {
    const numMatch = rubricId.match(/\d+/);
    return numMatch ? parseInt(numMatch[0], 10) : 0;
  }


  /**
   * Get rubric section by alphanumeric rubric ID
   *
   * @param rubricPath - Path to rubric file
   * @param rubricId - Alphanumeric rubric ID (e.g., "E4", "C1")
   * @returns Formatted rubric section text
   */
  async getRubricSectionByRubricId(
    rubricPath: string,
    rubricId: string
  ): Promise<string> {
    const rubric = await this.parseQuestionByRubricId(rubricPath, rubricId);

    if (!rubric) {
      return `Rubric for ID '${rubricId}' not found in file`;
    }

    return rubric.rawText;
  }

  /**
   * Extract FULL rubric section for a question using exam_config mapping
   *
   * Uses exam_config.yaml as an INDEX to locate the correct section in rubric.md.
   * Tries multiple strategies to find the section.
   *
   * @param rubricPath - Path to rubric.md
   * @param questionConfig - Question config from exam_config.yaml
   * @returns Full rubric section text (everything relevant for this question)
   */
  async extractFullSection(
    rubricPath: string,
    questionConfig: QuestionConfig
  ): Promise<string> {
    const content = await fs.readFile(rubricPath, 'utf-8');

    // Strategy 1: Find by section_title from rubric_data
    if (questionConfig.rubric_data?.section_title) {
      const section = this.extractSectionByTitle(
        content,
        questionConfig.rubric_data.section_title
      );
      if (section) {
        console.error(
          `[rubric_parser] Found section by section_title: ${questionConfig.rubric_data.section_title}`
        );
        return section;
      }
    }

    // Strategy 2: Find by question_title
    if (questionConfig.question_title) {
      const section = this.extractSectionByTitle(content, questionConfig.question_title);
      if (section) {
        console.error(
          `[rubric_parser] Found section by question_title: ${questionConfig.question_title}`
        );
        return section;
      }
    }

    // Strategy 3: Find by question number
    const numberSection = this.extractSectionByNumber(content, questionConfig.number);
    if (numberSection) {
      console.error(
        `[rubric_parser] Found section by question number: ${questionConfig.number}`
      );
      return numberSection;
    }

    // Strategy 4: Find by rubric_id (Identifier line)
    if (questionConfig.rubric_id) {
      const section = this.extractSectionByIdentifier(content, questionConfig.rubric_id);
      if (section) {
        console.error(
          `[rubric_parser] Found section by rubric_id: ${questionConfig.rubric_id}`
        );
        return section;
      }
    }

    console.error(
      `[rubric_parser] Could not find rubric section for ${questionConfig.id}`
    );
    return `[Rubric section for ${questionConfig.id} not found in rubric.md]`;
  }

  /**
   * Extract section by title pattern (matches against question headers)
   */
  private extractSectionByTitle(content: string, title: string): string | null {
    // Try to find header containing the title
    const escapedTitle = escapeRegex(title);
    const titlePattern = new RegExp(
      `^#+ (?:Question|Fråga)\\s+\\d+[:\\s]+.*${escapedTitle}.*$`,
      'mi'
    );

    const match = content.match(titlePattern);
    if (!match) {
      // Try simpler pattern - just look for title anywhere in header
      const simplePattern = new RegExp(
        `^#+ .*${escapedTitle}.*$`,
        'mi'
      );
      const simpleMatch = content.match(simplePattern);
      if (!simpleMatch) return null;
      return this.extractSectionFromMatch(content, simpleMatch[0]);
    }

    return this.extractSectionFromMatch(content, match[0]);
  }

  /**
   * Extract section by question number
   */
  private extractSectionByNumber(content: string, questionNumber: number): string | null {
    const numberPattern = new RegExp(
      `^#+ (?:Question|Fråga)\\s+${questionNumber}[:\\s]`,
      'mi'
    );

    const match = content.match(numberPattern);
    if (!match) return null;

    return this.extractSectionFromMatch(content, match[0]);
  }

  /**
   * Extract section by finding **Identifier:** line and going back to header
   */
  private extractSectionByIdentifier(content: string, rubricId: string): string | null {
    const idPattern = new RegExp(
      `\\*\\*Identifier:\\*\\*\\s*${escapeRegex(rubricId)}`,
      'mi'
    );

    const match = content.match(idPattern);
    if (!match) return null;

    // Find the section header above this identifier
    const matchIndex = content.indexOf(match[0]);
    const beforeId = content.slice(0, matchIndex);

    // Find the last question header before this identifier
    const headerMatches = beforeId.match(/^#+ (?:Question|Fråga)\s+\d+[:\s].+$/gim);
    if (!headerMatches) return null;

    const lastHeader = headerMatches[headerMatches.length - 1];
    return this.extractSectionFromMatch(content, lastHeader);
  }

  /**
   * Extract section from a matched header to the next section header
   */
  private extractSectionFromMatch(content: string, headerMatch: string): string {
    const startIndex = content.indexOf(headerMatch);
    if (startIndex === -1) return headerMatch;

    // Find next question header
    const remaining = content.slice(startIndex);
    const afterHeader = remaining.slice(headerMatch.length);

    // Look for next # Question N: or # Fråga N:
    const nextMatch = afterHeader.match(/^#+ (?:Question|Fråga)\s+\d+[:\s]/mi);

    if (nextMatch) {
      const endIndex = afterHeader.indexOf(nextMatch[0]);
      return remaining.slice(0, headerMatch.length + endIndex).trim();
    }

    // No next section, return everything from header to end
    return remaining.trim();
  }
}
