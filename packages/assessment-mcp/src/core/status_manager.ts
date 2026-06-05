import { promises as fs } from 'fs';
import {
  AssessmentStatus,
  RawAssessmentStatus,
  Aspect,
  serializeStatus,
  calculateProgress,
} from '../types/status.js';
import { escapeRegex } from '../utils/regex_utils.js';

/**
 * StatusManager - Manages ASSESSMENT-STATUS frontmatter in Q-files
 *
 * Responsibilities:
 * - Create STATUS YAML frontmatter
 * - Read STATUS from file
 * - Update STATUS after assessment writes
 * - Calculate progress
 *
 * STATUS format:
 * ---
 * ASSESSMENT-STATUS:
 *   File: "<qfile-name>"
 *   Question: "<question-title>"
 *   Max-points: <N>
 *   Aspects:
 *     - name: "<aspect-name>"
 *       max: <N>
 *   Total-students: <N>
 *   Last-assessed-student: "<id>"
 *   Last-assessed-index: <N>
 *   Progress: "<assessed>/<total> (<percent>%)"
 *   Date: "<YYYY-MM-DD>"
 *   Rubric-file: "<rubric-file-name>"
 * ---
 *
 * @see docs/design/001-assessment-format.md
 */
export class StatusManager {
  /**
   * Create STATUS frontmatter in Q-file
   *
   * @param filePath - Path to Q-file
   * @param question - Question title
   * @param maxPoints - Maximum points for question
   * @param totalStudents - Total students in file
   * @param aspects - Assessment aspects (optional)
   * @param rubricFile - Path to rubric file (optional)
   */
  async create(
    filePath: string,
    question: string,
    maxPoints: number,
    totalStudents: number,
    aspects: Aspect[] = [],
    rubricFile: string | null = null
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Check if STATUS already exists
      if (content.startsWith('---') && content.includes('ASSESSMENT-STATUS:')) {
        throw new Error('ASSESSMENT-STATUS already exists in file');
      }

      const fileName = filePath.split('/').pop() || 'unknown.md';
      const today = new Date().toISOString().split('T')[0];

      const status: AssessmentStatus = {
        file: fileName,
        question,
        maxPoints,
        aspects,
        totalStudents,
        lastAssessedStudent: null,
        lastAssessedIndex: -1,
        progress: calculateProgress(0, totalStudents),
        date: today,
        rubricFile,
      };

      const yamlFrontmatter = serializeStatus(status);
      const newContent = `${yamlFrontmatter}\n${content}`;

      await fs.writeFile(filePath, newContent, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to create STATUS in ${filePath}: ${error}`);
    }
  }

  /**
   * Read STATUS from file
   *
   * @param filePath - Path to Q-file
   * @returns Parsed AssessmentStatus object
   */
  async read(filePath: string): Promise<AssessmentStatus> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      if (!content.startsWith('---')) {
        throw new Error('No STATUS frontmatter found in file');
      }

      return this.parseStatus(content);
    } catch (error) {
      throw new Error(`Failed to read STATUS from ${filePath}: ${error}`);
    }
  }

  /**
   * Update STATUS after assessing a student
   *
   * @param filePath - Path to Q-file
   * @param studentId - ID of assessed student
   * @param studentIndex - 0-based index of assessed student
   * @param totalStudents - Total students in file
   */
  async update(
    filePath: string,
    studentId: string,
    studentIndex: number,
    totalStudents: number
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const status = this.parseStatus(content);

      // Count students that actually have an assessment in the file (the current
      // student's BEDÖMNING is already written by the time this runs). Deriving
      // the count from the positional index assumed strictly front-to-back
      // assessment and reported the wrong progress when students were assessed
      // out of order. Pattern mirrors StudentReader's "assessed" detection.
      const assessedCount = (content.match(/^### (?:BEDÖMNING|ANALYTIC ASSESSMENT):\s*\S+/gm) || []).length;

      // Update fields
      status.lastAssessedStudent = studentId;
      status.lastAssessedIndex = studentIndex;
      status.progress = calculateProgress(assessedCount, totalStudents);
      status.date = new Date().toISOString().split('T')[0];

      // Replace old STATUS with new
      const newYaml = serializeStatus(status);
      const contentWithoutStatus = this.removeStatusFromContent(content).replace(/^\n+/, '');
      const newContent = `${newYaml}\n${contentWithoutStatus}`;

      await fs.writeFile(filePath, newContent, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to update STATUS in ${filePath}: ${error}`);
    }
  }

  /**
   * Check if file has ASSESSMENT-STATUS frontmatter
   */
  async hasStatus(filePath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.startsWith('---') && content.includes('ASSESSMENT-STATUS:');
    } catch {
      return false;
    }
  }

  /**
   * Parse STATUS from file content
   * @private
   */
  private parseStatus(content: string): AssessmentStatus {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      throw new Error('Invalid STATUS frontmatter format');
    }

    const yamlContent = match[1];
    const lines = yamlContent.split('\n');

    const status: AssessmentStatus = {
      file: '',
      question: '',
      maxPoints: 0,
      aspects: [],
      totalStudents: 0,
      lastAssessedStudent: null,
      lastAssessedIndex: -1,
      progress: '0/0 (0%)',
      date: '',
      rubricFile: null,
    };

    let inStatus = false;
    let inAspects = false;
    let currentAspect: Partial<Aspect> | null = null;

    for (const line of lines) {
      if (line.trim() === 'ASSESSMENT-STATUS:') {
        inStatus = true;
        continue;
      }

      if (!inStatus) continue;

      // Check for Aspects array
      if (line.trim() === 'Aspects:') {
        inAspects = true;
        continue;
      }

      // Parse aspect items
      if (inAspects && line.trim().startsWith('- name:')) {
        if (currentAspect && currentAspect.name) {
          status.aspects.push(currentAspect as Aspect);
        }
        currentAspect = {
          name: this.extractValue(line, 'name'),
          max: 0,
        };
        continue;
      }

      if (inAspects && line.trim().startsWith('max:') && currentAspect) {
        currentAspect.max = parseFloat(this.extractValue(line, 'max'));
        continue;
      }

      // End of aspects section (next non-indented field)
      if (inAspects && line.match(/^  [A-Z]/)) {
        if (currentAspect && currentAspect.name) {
          status.aspects.push(currentAspect as Aspect);
        }
        currentAspect = null;
        inAspects = false;
      }

      // Parse other fields
      if (line.includes(':') && !inAspects) {
        const [key, ...valueParts] = line.split(':');
        const trimmedKey = key.trim();
        let value = valueParts.join(':').trim();

        // Remove quotes
        value = value.replace(/^["']|["']$/g, '');

        switch (trimmedKey) {
          case 'File':
            status.file = value;
            break;
          case 'Question':
            status.question = value;
            break;
          case 'Max-points':
            status.maxPoints = parseFloat(value);
            break;
          case 'Total-students':
            status.totalStudents = parseInt(value, 10);
            break;
          case 'Last-assessed-student':
            status.lastAssessedStudent = value === 'null' ? null : value;
            break;
          case 'Last-assessed-index':
            status.lastAssessedIndex = parseInt(value, 10);
            break;
          case 'Progress':
            status.progress = value;
            break;
          case 'Date':
            status.date = value;
            break;
          case 'Rubric-file':
            status.rubricFile = value === 'null' ? null : value;
            break;
        }
      }
    }

    // Don't forget the last aspect
    if (currentAspect && currentAspect.name) {
      status.aspects.push(currentAspect as Aspect);
    }

    return status;
  }

  /**
   * Extract value from YAML line like "- name: value" or "  max: 2"
   * @private
   */
  private extractValue(line: string, key: string): string {
    // RFC-029 §18.3 P8: escape key for safe regex interpolation
    const match = line.match(new RegExp(`${escapeRegex(key)}:\\s*["']?([^"']+)["']?`));
    return match ? match[1].trim() : '';
  }

  /**
   * Remove STATUS frontmatter from content
   * @private
   */
  private removeStatusFromContent(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n/, '');
  }
}
