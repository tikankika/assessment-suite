import { promises as fs } from 'fs';
import { Student, parseStudentHeader } from '../types/assessment.js';
import { validatePathOrThrow } from './path_validator.js';

/**
 * StudentReader - Parses Q-files to extract student sections
 *
 * Q-file format:
 * ```
 * ## Elev <id> (47 ord)
 *
 * [Student's answer text...]
 *
 * ---
 *
 * ## Elev <id> (0 ord)
 *
 * [Ingen svar]
 * ```
 *
 * @see docs/design/001-assessment-format.md
 */
export class StudentReader {
  /**
   * Regex pattern for student headers
   * Captures: ID (group 1), word count (group 2)
   * Supports numeric, alphanumeric, and underscore-compound student IDs (e.g. <id> or <id>_<id>)
   */
  private readonly STUDENT_PATTERN = /^## Elev ([A-Za-z0-9_]+) \((\d+) ord\)/;

  /**
   * Pattern for assessment section (supports both Swedish and English headers)
   */
  private readonly BEDÖMNING_PATTERN = /^### (?:BEDÖMNING|ANALYTIC ASSESSMENT):/m;

  /**
   * Parse all students from Q-file
   *
   * @param filePath - Path to Q-file
   * @returns Array of Student objects
   */
  async parseStudents(filePath: string, content?: string): Promise<Student[]> {
    // Security: Validate path before file operations
    validatePathOrThrow(filePath);
    const fileContent = content ?? await fs.readFile(filePath, 'utf-8');
    return this.parseStudentsFromContent(fileContent);
  }

  /**
   * Parse students from content string
   *
   * @param content - File content
   * @returns Array of Student objects
   */
  parseStudentsFromContent(content: string): Student[] {
    const students: Student[] = [];
    const lines = content.split('\n');

    let currentStudent: Partial<Student> | null = null;
    let answerLines: string[] = [];
    let lineIndex = 0;

    // Skip YAML frontmatter if present
    if (lines[0] === '---') {
      let frontmatterEnd = lines.indexOf('---', 1);
      if (frontmatterEnd > 0) {
        lineIndex = frontmatterEnd + 1;
      }
    }

    // BUGFIX 2026-01-19: Pre-scan for all BEDÖMNING sections anywhere in the file
    // BEDÖMNINGs may be at the bottom of the file, not within each student's section
    const assessedStudentIds = new Set<string>();
    const bedömningHeaderPattern = /^### (?:BEDÖMNING|ANALYTIC ASSESSMENT):\s*(\S+)/;
    for (const line of lines) {
      const match = line.match(bedömningHeaderPattern);
      if (match) {
        assessedStudentIds.add(match[1]);
      }
    }

    for (let i = lineIndex; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = line.match(this.STUDENT_PATTERN);

      if (headerMatch) {
        // Save previous student if exists
        if (currentStudent && currentStudent.id) {
          const answerText = answerLines.join('\n').trim();
          // BUGFIX: Check pre-scanned set instead of just within section
          const assessed = assessedStudentIds.has(currentStudent.id) ||
                          this.BEDÖMNING_PATTERN.test(answerText);

          // Remove assessment section from answer if present (supports both Swedish and English headers)
          const cleanAnswer = answerText
            .replace(/### (?:BEDÖMNING|ANALYTIC ASSESSMENT):[\s\S]*?(?=^---$|$)/m, '')
            .trim();

          students.push({
            id: currentStudent.id,
            index: students.length,
            wordCount: currentStudent.wordCount || 0,
            answer: cleanAnswer,
            assessed,
          });
        }

        // Start new student
        currentStudent = {
          id: headerMatch[1],
          wordCount: parseInt(headerMatch[2], 10),
        };
        answerLines = [];
      } else if (currentStudent) {
        // Collect answer lines (but not the header line itself)
        answerLines.push(line);
      }
    }

    // Don't forget the last student
    if (currentStudent && currentStudent.id) {
      const answerText = answerLines.join('\n').trim();
      // BUGFIX: Check pre-scanned set instead of just within section
      const assessed = assessedStudentIds.has(currentStudent.id) ||
                      this.BEDÖMNING_PATTERN.test(answerText);

      const cleanAnswer = answerText
        .replace(/### (?:BEDÖMNING|ANALYTIC ASSESSMENT):[\s\S]*?(?=^---$|$)/m, '')
        .trim();

      students.push({
        id: currentStudent.id,
        index: students.length,
        wordCount: currentStudent.wordCount || 0,
        answer: cleanAnswer,
        assessed,
      });
    }

    return students;
  }

  /**
   * Find a specific student by ID
   *
   * @param filePath - Path to Q-file
   * @param studentId - Student ID to find
   * @returns Student or null if not found
   */
  async findStudent(filePath: string, studentId: string): Promise<Student | null> {
    const students = await this.parseStudents(filePath);
    return students.find(s => s.id === studentId) || null;
  }

  /**
   * Get the next unassessed student
   *
   * @param filePath - Path to Q-file
   * @returns Next unassessed Student or null if all assessed
   */
  async getNextUnassessed(filePath: string): Promise<Student | null> {
    const students = await this.parseStudents(filePath);
    return students.find(s => !s.assessed) || null;
  }

  /**
   * Get next unassessed student after a specific index
   *
   * @param filePath - Path to Q-file
   * @param afterIndex - Start searching after this index
   * @returns Next unassessed Student or null
   */
  async getNextUnassessedAfter(
    filePath: string,
    afterIndex: number
  ): Promise<Student | null> {
    const students = await this.parseStudents(filePath);
    return students.find(s => s.index > afterIndex && !s.assessed) || null;
  }

  /**
   * Count total students in file
   *
   * @param filePath - Path to Q-file
   * @returns Total number of students
   */
  async countStudents(filePath: string): Promise<number> {
    const students = await this.parseStudents(filePath);
    return students.length;
  }

  /**
   * Count assessed students
   *
   * @param filePath - Path to Q-file
   * @returns Number of assessed students
   */
  async countAssessed(filePath: string): Promise<number> {
    const students = await this.parseStudents(filePath);
    return students.filter(s => s.assessed).length;
  }

  /**
   * Get all student IDs
   *
   * @param filePath - Path to Q-file
   * @returns Array of student IDs
   */
  async getStudentIds(filePath: string): Promise<string[]> {
    const students = await this.parseStudents(filePath);
    return students.map(s => s.id);
  }

  /**
   * Check if file exists
   *
   * @param filePath - Path to check
   * @returns true if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract question info from Q-file header or filename
   *
   * Supports two formats:
   * 1. Header in file: "# FRÅGA <N>: <TITLE> (<P>p)"
   * 2. Filename fallback: "Q<N>_alla_elever.md" -> Question <N>
   *
   * @param filePath - Path to Q-file
   * @returns Question number and title, or null if not found
   */
  async extractQuestionInfo(
    filePath: string,
    content?: string,
  ): Promise<{ number: number; title: string } | null> {
    // Security: Validate path before file operations
    validatePathOrThrow(filePath);
    content = content ?? await fs.readFile(filePath, 'utf-8');

    // Try header pattern first: "# FRÅGA <N>: <TITLE> (<P>p)"
    const headerMatch = content.match(/^# (?:FRÅGA|QUESTION)\s+(\d+):\s*(.+?)(?:\s*\(\d+p\))?$/m);

    if (headerMatch) {
      return {
        number: parseInt(headerMatch[1], 10),
        title: headerMatch[2].trim(),
      };
    }

    // Fallback: Extract from filename (Q6_alla_elever.md -> 6)
    const filename = filePath.split('/').pop() || filePath;
    const filenameMatch = filename.match(/Q(\d+)/i);

    if (filenameMatch) {
      return {
        number: parseInt(filenameMatch[1], 10),
        title: `Fråga ${filenameMatch[1]}`,  // Default title from number
      };
    }

    return null;
  }

  /**
   * Extract YAML frontmatter from Q-file content
   *
   * @param content - Q-file content
   * @returns Frontmatter as key-value object, or null if not found
   */
  private extractFrontmatter(content: string): Record<string, string | null> | null {
    const lines = content.split('\n');

    // Check for YAML frontmatter
    if (lines[0] !== '---') {
      return null;
    }

    const frontmatterEnd = lines.indexOf('---', 1);
    if (frontmatterEnd < 0) {
      return null;
    }

    const frontmatterLines = lines.slice(1, frontmatterEnd);
    const result: Record<string, string | null> = {};

    for (const line of frontmatterLines) {
      // Skip ASSESSMENT-STATUS: header line
      if (line.trim() === 'ASSESSMENT-STATUS:') {
        continue;
      }

      // Parse key-value pairs (handles both "key: value" and "key: \"value\"")
      const match = line.match(/^\s*([A-Za-z-]+):\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Handle quoted values
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }

        // Handle null values
        if (value === 'null' || value === '') {
          result[key] = null;
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Extract Rubric-ID from Q-file frontmatter
   *
   * The Rubric-ID maps the Q-file to the corresponding section
   * in bedömningsanvisningar (e.g., Q7 -> "E4" means FRÅGA E4).
   *
   * @param filePath - Path to Q-file
   * @returns Rubric ID string (e.g., "E4", "6", "SKELETT") or null if not found
   */
  async extractRubricId(filePath: string): Promise<string | null> {
    // Security: Validate path before file operations
    validatePathOrThrow(filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    const frontmatter = this.extractFrontmatter(content);

    if (!frontmatter) {
      return null;
    }

    return frontmatter['Rubric-ID'] || null;
  }

  /**
   * Extract full ASSESSMENT-STATUS metadata from Q-file
   *
   * @param filePath - Path to Q-file
   * @returns Assessment status object or null
   */
  async extractAssessmentStatus(filePath: string, content?: string): Promise<{
    file: string | null;
    question: string | null;
    rubricId: string | null;
    maxPoints: number;
    totalStudents: number;
    rubricFile: string | null;
  } | null> {
    // Security: Validate path before file operations
    validatePathOrThrow(filePath);
    const fileContent = content ?? await fs.readFile(filePath, 'utf-8');
    const frontmatter = this.extractFrontmatter(fileContent);

    if (!frontmatter) {
      return null;
    }

    return {
      file: frontmatter['File'] || null,
      question: frontmatter['Question'] || null,
      rubricId: frontmatter['Rubric-ID'] || null,
      maxPoints: frontmatter['Max-points']
        ? parseInt(frontmatter['Max-points'], 10)
        : 0,
      totalStudents: frontmatter['Total-students']
        ? parseInt(frontmatter['Total-students'], 10)
        : 0,
      rubricFile: frontmatter['Rubric-file'] || null,
    };
  }

  /**
   * List all Q-files in the same directory as the given Q-file
   *
   * Useful for navigation between questions.
   *
   * @param qFilePath - Path to any Q-file in the directory
   * @returns Array of Q-file paths sorted by question number
   */
  async listQFilesInDirectory(qFilePath: string): Promise<string[]> {
    // Security: Validate path before file operations
    validatePathOrThrow(qFilePath);
    const dir = qFilePath.substring(0, qFilePath.lastIndexOf('/'));

    try {
      const files = await fs.readdir(dir);

      // Filter for Q-files and sort by question number
      const qFiles = files
        .filter(f => f.match(/^Q\d+_.*\.md$/i))
        .sort((a, b) => {
          const numA = parseInt(a.match(/Q(\d+)/i)?.[1] || '0', 10);
          const numB = parseInt(b.match(/Q(\d+)/i)?.[1] || '0', 10);
          return numA - numB;
        })
        .map(f => `${dir}/${f}`);

      return qFiles;
    } catch {
      return [];
    }
  }

  /**
   * Get the next Q-file after the given one
   *
   * @param currentQFilePath - Path to current Q-file
   * @returns Path to next Q-file, or null if this is the last one
   */
  async getNextQFile(currentQFilePath: string): Promise<string | null> {
    const qFiles = await this.listQFilesInDirectory(currentQFilePath);
    const currentIndex = qFiles.indexOf(currentQFilePath);

    if (currentIndex < 0 || currentIndex >= qFiles.length - 1) {
      return null;
    }

    return qFiles[currentIndex + 1];
  }
}
