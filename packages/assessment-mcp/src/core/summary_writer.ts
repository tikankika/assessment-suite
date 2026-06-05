import { promises as fs } from 'fs';
import { StudentReader } from './student_reader.js';
import { escapeRegex } from '../utils/regex_utils.js';

/**
 * Summary of a single Q-file's assessment status
 */
interface QFileSummary {
  questionNumber: number;
  questionTitle: string;
  maxPoints: number;
  totalStudents: number;
  assessedCount: number;
  students: {
    id: string;
    points: number | null;
    maxPoints: number;
    assessed: boolean;
  }[];
  stats: { mean: number; min: number; max: number } | null;
}

/**
 * SummaryWriter - Generates centralized Assessment Status Summary document
 *
 * This class:
 * 1. Scans all Q-files in a directory
 * 2. Extracts assessment status and scores
 * 3. Generates a markdown summary document
 *
 * @see docs/rfcs/003-assessment-status-summary.md
 */
export class SummaryWriter {
  private studentReader: StudentReader;

  constructor() {
    this.studentReader = new StudentReader();
  }

  /**
   * Extract total points from BEDÖMNING text
   *
   * Supports multiple formats:
   * - "TOTAL: 2.75/3p"
   * - "**TOTALPOÄNG: 11.5/15p**"
   * - "TOTAL: 2.0/3.0p"
   *
   * @param bedömningText - The BEDÖMNING section text
   * @returns Points object or null if not found
   */
  extractPointsFromBedömning(
    bedömningText: string
  ): { points: number; max: number } | null {
    // Pattern 1: TOTAL: X/Yp or TOTAL: X.X/Y.Yp
    const totalMatch = bedömningText.match(
      /TOTAL:\s*([\d.]+)\/([\d.]+)p/i
    );
    if (totalMatch) {
      return {
        points: parseFloat(totalMatch[1]),
        max: parseFloat(totalMatch[2]),
      };
    }

    // Pattern 2: TOTALPOÄNG: X/Yp (Swedish)
    const totalPoängMatch = bedömningText.match(
      /TOTALPOÄNG:\s*([\d.]+)\/([\d.]+)p/i
    );
    if (totalPoängMatch) {
      return {
        points: parseFloat(totalPoängMatch[1]),
        max: parseFloat(totalPoängMatch[2]),
      };
    }

    return null;
  }

  /**
   * Get BEDÖMNING section for a student from Q-file content
   *
   * @param content - Full Q-file content
   * @param studentId - Student ID to find
   * @returns BEDÖMNING text or null
   */
  private extractBedömningForStudent(
    content: string,
    studentId: string
  ): string | null {
    // Find student header (RFC-029 §18.3 P8: escape studentId for safe regex)
    const escapedId = escapeRegex(studentId);
    const studentPattern = new RegExp(
      `## Elev ${escapedId} \\(\\d+ ord\\)([\\s\\S]*?)(?=## Elev|$)`,
      'i'
    );
    const studentMatch = content.match(studentPattern);

    if (!studentMatch) {
      return null;
    }

    const studentSection = studentMatch[1];

    // Find BEDÖMNING section (supports both Swedish and English headers)
    // Simplified pattern: capture from header to next ---
    const bedömningMatch = studentSection.match(
      /### (?:BEDÖMNING|ANALYTIC ASSESSMENT):([\s\S]*?)(?=\n---)/
    );

    if (!bedömningMatch) {
      return null;
    }

    return bedömningMatch[1].trim();
  }

  /**
   * Generate summary for a single Q-file
   *
   * @param qFilePath - Path to Q-file
   * @returns QFileSummary object
   */
  async generateQFileSummary(qFilePath: string): Promise<QFileSummary> {
    // RFC-029 §18.3 P7: Read once, pass content to avoid 4× file reads
    const content = await fs.readFile(qFilePath, 'utf-8');
    const students = await this.studentReader.parseStudents(qFilePath, content);
    const status = await this.studentReader.extractAssessmentStatus(qFilePath, content);
    const questionInfo = await this.studentReader.extractQuestionInfo(qFilePath, content);

    const maxPoints = status?.maxPoints || 0;
    const questionNumber = questionInfo?.number || 0;
    const questionTitle = questionInfo?.title || 'Unknown';

    // Extract points for each student
    const studentData = students.map((student) => {
      let points: number | null = null;

      if (student.assessed) {
        const bedömning = this.extractBedömningForStudent(content, student.id);
        if (bedömning) {
          const extracted = this.extractPointsFromBedömning(bedömning);
          if (extracted) {
            points = extracted.points;
          }
        }
      }

      return {
        id: student.id,
        points,
        maxPoints,
        assessed: student.assessed,
      };
    });

    // Count assessed students (based on BEDÖMNING presence, not point extraction)
    const assessedCount = studentData.filter((s) => s.assessed).length;

    // Calculate statistics only for students where points were extracted
    const studentsWithPoints = studentData.filter((s) => s.assessed && s.points !== null);
    let stats: { mean: number; min: number; max: number } | null = null;

    if (studentsWithPoints.length > 0) {
      const pointValues = studentsWithPoints.map((s) => s.points as number);
      const sum = pointValues.reduce((a, b) => a + b, 0);
      stats = {
        mean: Math.round((sum / studentsWithPoints.length) * 100) / 100,
        min: Math.min(...pointValues),
        max: Math.max(...pointValues),
      };
    }

    return {
      questionNumber,
      questionTitle,
      maxPoints,
      totalStudents: students.length,
      assessedCount,
      students: studentData,
      stats,
    };
  }

  /**
   * Generate the full summary document content
   *
   * @param anyQFilePath - Path to any Q-file in the directory
   * @returns Markdown content for summary document
   */
  async generateSummaryDocument(anyQFilePath: string): Promise<string> {
    const qFiles = await this.studentReader.listQFilesInDirectory(anyQFilePath);

    if (qFiles.length === 0) {
      throw new Error('No Q-files found in directory');
    }

    // Get rubric info from first file
    const firstStatus = await this.studentReader.extractAssessmentStatus(qFiles[0]);
    const rubricFile = firstStatus?.rubricFile
      ? firstStatus.rubricFile.split('/').pop()
      : 'Unknown';

    // Generate summaries for all Q-files
    const summaries: QFileSummary[] = [];
    for (const qFile of qFiles) {
      const summary = await this.generateQFileSummary(qFile);
      summaries.push(summary);
    }

    // Sort by question number
    summaries.sort((a, b) => a.questionNumber - b.questionNumber);

    // Build markdown document
    const lines: string[] = [];
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    lines.push('# Assessment Status Summary');
    lines.push('');
    lines.push(`**Rubric:** ${rubricFile}`);
    lines.push(`**Last updated:** ${timestamp}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Per-question sections
    for (const summary of summaries) {
      const progress = `${summary.assessedCount}/${summary.totalStudents}`;
      const percentage = summary.totalStudents > 0
        ? ((summary.assessedCount / summary.totalStudents) * 100).toFixed(2)
        : '0.00';

      lines.push(
        `## Q${summary.questionNumber}: ${summary.questionTitle.toUpperCase()} (${summary.maxPoints}p) - ${progress} (${percentage}%)`
      );
      lines.push('');

      if (summary.assessedCount === 0) {
        lines.push('No assessments yet.');
      } else {
        lines.push('| Student | Points | Status |');
        lines.push('|---------|--------|--------|');

        for (const student of summary.students) {
          const pointsStr = student.assessed && student.points !== null
            ? `${student.points}/${summary.maxPoints}`
            : '-';
          const statusStr = student.assessed ? '✓' : 'Pending';
          lines.push(`| ${student.id} | ${pointsStr} | ${statusStr} |`);
        }

        lines.push('');
        if (summary.stats) {
          lines.push(
            `**Stats:** Mean: ${summary.stats.mean}p | Min: ${summary.stats.min}p | Max: ${summary.stats.max}p`
          );
        }
      }

      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Overall progress section
    lines.push('## Overall Progress');
    lines.push('');
    lines.push('| Question | Progress | Mean | Min | Max |');
    lines.push('|----------|----------|------|-----|-----|');

    let totalAssessed = 0;
    let totalStudents = 0;

    for (const summary of summaries) {
      const progress = `${summary.assessedCount}/${summary.totalStudents}`;
      const percentage = summary.totalStudents > 0
        ? Math.round((summary.assessedCount / summary.totalStudents) * 100)
        : 0;

      const meanStr = summary.stats ? `${summary.stats.mean}p` : '-';
      const minStr = summary.stats ? `${summary.stats.min}p` : '-';
      const maxStr = summary.stats ? `${summary.stats.max}p` : '-';

      lines.push(
        `| Q${summary.questionNumber} | ${progress} (${percentage}%) | ${meanStr} | ${minStr} | ${maxStr} |`
      );

      totalAssessed += summary.assessedCount;
      totalStudents += summary.totalStudents;
    }

    lines.push('');
    const totalPercentage = totalStudents > 0
      ? ((totalAssessed / totalStudents) * 100).toFixed(1)
      : '0.0';
    lines.push(
      `**Total:** ${totalAssessed}/${totalStudents} assessments (${totalPercentage}%)`
    );
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Write the summary document to file
   *
   * @param anyQFilePath - Path to any Q-file in the directory
   */
  async writeSummary(anyQFilePath: string): Promise<void> {
    const dir = anyQFilePath.substring(0, anyQFilePath.lastIndexOf('/'));
    const summaryPath = `${dir}/Assessment_Status_Summary.md`;

    const content = await this.generateSummaryDocument(anyQFilePath);
    await fs.writeFile(summaryPath, content, 'utf-8');

    console.error(`[SummaryWriter] Summary written to: ${summaryPath}`);
  }
}
