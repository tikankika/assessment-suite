/**
 * AspectAnalyzer - Analyze aspect statistics from assessed Q-files
 *
 * Parses BEDÖMNING sections to calculate:
 * - Per-aspect mean, min, max, distribution
 *
 * Returns raw statistics. Pedagogical interpretation left to methodology/LLM.
 *
 * @see methodology/cross_phase/descriptive_statistics_method.md (cross-phase methodology)
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { AssessmentParser } from '../core/assessment_parser.js';
import { StudentReader } from '../core/student_reader.js';
import { AspectScore } from '../types/assessment.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Statistics for a single aspect across all students
 */
export interface AspectStatistics {
  id: string;                    // e.g., "1a", "6b"
  name: string;                  // Full aspect name from BEDÖMNING
  maxPoints: number;             // Maximum points (extracted from name or score)
  mean: number;                  // Mean score across all students
  min: number;                   // Minimum score
  max: number;                   // Maximum score
  fullMarksCount: number;        // Students who got max points
  distribution: Record<number, number>;  // points -> count
}

/**
 * Complete analysis result for a Q-file
 */
export interface AspectAnalysisResult {
  questionId: string;
  questionTitle: string;
  totalStudents: number;         // Total students in file
  assessedStudents: number;      // Students with BEDÖMNING
  aspects: AspectStatistics[];   // Per-aspect statistics
  recommendations: string[];     // Auto-generated recommendations
  timestamp: string;             // When analysis was run
}

/**
 * Per-student aspect data (intermediate)
 */
interface StudentAspectData {
  studentId: string;
  aspects: Map<string, { points: number; maxPoints: number }>;
}

// ============================================================================
// AspectAnalyzer Class
// ============================================================================

export class AspectAnalyzer {
  private assessmentParser: AssessmentParser;
  private studentReader: StudentReader;

  constructor() {
    this.assessmentParser = new AssessmentParser();
    this.studentReader = new StudentReader();
  }

  /**
   * Main entry point: Analyze all assessed students in a Q-file
   *
   * @param qFilePath - Path to Q-file with BEDÖMNING sections
   * @returns AspectAnalysisResult with statistics and recommendations
   */
  async analyzeQFile(qFilePath: string): Promise<AspectAnalysisResult> {
    console.error('[AspectAnalyzer] analyzeQFile:', qFilePath);

    // Step 1: Get all students
    const students = await this.studentReader.parseStudents(qFilePath);
    const assessedStudents = students.filter(s => s.assessed);
    console.error('[AspectAnalyzer] Total students:', students.length, 'Assessed:', assessedStudents.length);

    if (assessedStudents.length === 0) {
      throw new Error('No assessed students found in Q-file');
    }

    // Step 2: Extract question info
    const questionInfo = await this.studentReader.extractQuestionInfo(qFilePath);
    const filename = path.basename(qFilePath, '.md');
    const questionId = this.extractQuestionIdFromPath(qFilePath) || filename;
    const questionTitle = questionInfo?.title || `Question ${questionId}`;
    console.error('[AspectAnalyzer] Question:', questionId, questionTitle);

    // Step 3: Parse all BEDÖMNING sections and collect aspect data
    const studentAspectData: StudentAspectData[] = [];
    let aspectTemplate: AspectScore[] = [];

    for (const student of assessedStudents) {
      const result = await this.assessmentParser.getAssessment(qFilePath, student.id);
      if (result) {
        // Use first student's aspects as template
        if (aspectTemplate.length === 0) {
          aspectTemplate = result.assessment.aspects;
        }

        const aspectMap = new Map<string, { points: number; maxPoints: number }>();
        for (const aspect of result.assessment.aspects) {
          const aspectId = this.extractAspectId(aspect.name);
          const maxPoints = this.extractMaxPoints(aspect.name) || this.inferMaxPoints(aspect, aspectTemplate);
          aspectMap.set(aspectId, { points: aspect.points, maxPoints });
        }
        studentAspectData.push({ studentId: student.id, aspects: aspectMap });
      }
    }
    console.error('[AspectAnalyzer] Parsed', studentAspectData.length, 'student assessments');

    // Step 4: Calculate statistics per aspect
    const aspectStats = this.calculateStatistics(studentAspectData, aspectTemplate);
    console.error('[AspectAnalyzer] Calculated stats for', aspectStats.length, 'aspects');

    // Step 5: Generate recommendations
    const recommendations = this.generateRecommendations(aspectStats);

    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

    return {
      questionId,
      questionTitle,
      totalStudents: students.length,
      assessedStudents: assessedStudents.length,
      aspects: aspectStats,
      recommendations,
      timestamp,
    };
  }

  /**
   * Extract aspect ID from full name
   * "1a GWP-värden (1.0p)" -> "1a"
   * "6a (Riktningar)" -> "6a"
   * "E3a: Description" -> "E3a"
   */
  private extractAspectId(name: string): string {
    // Try various patterns
    const patterns = [
      /^(\d+[a-z]?)/,           // "1a", "6b"
      /^([A-Z]\d+[a-z]?)/,      // "E3a", "Q1b"
      /^([A-Za-z0-9]+)/,        // First alphanumeric group
    ];

    for (const pattern of patterns) {
      const match = name.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return name.slice(0, 10); // Fallback: first 10 chars
  }

  /**
   * Extract max points from aspect name
   * "1a GWP-värden (1.0p)" -> 1.0
   * "6a (Riktningar) (2p)" -> 2.0
   */
  private extractMaxPoints(name: string): number | null {
    const match = name.match(/\((\d+(?:[.,]\d+)?)\s*p\)/);
    if (match) {
      return parseFloat(match[1].replace(',', '.'));
    }
    return null;
  }

  /**
   * Infer max points from aspect template or score
   */
  private inferMaxPoints(aspect: AspectScore, template: AspectScore[]): number {
    // Try to find in template
    const aspectId = this.extractAspectId(aspect.name);
    for (const t of template) {
      if (this.extractAspectId(t.name) === aspectId) {
        const maxFromName = this.extractMaxPoints(t.name);
        if (maxFromName !== null) return maxFromName;
      }
    }
    // Fallback: assume current points is max (if full marks symbol)
    if (aspect.symbol === '✓✓✓') {
      return aspect.points;
    }
    // Default assumption
    return aspect.points > 0 ? Math.ceil(aspect.points) : 1;
  }

  /**
   * Extract question ID from file path
   * "/path/to/Q001_alla_elever.md" -> "Q001"
   */
  private extractQuestionIdFromPath(filePath: string): string | null {
    const filename = path.basename(filePath);
    const match = filename.match(/^(Q\d+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  /**
   * Calculate statistics across all students
   */
  private calculateStatistics(
    data: StudentAspectData[],
    template: AspectScore[]
  ): AspectStatistics[] {
    if (data.length === 0 || template.length === 0) return [];

    const stats: AspectStatistics[] = [];

    for (const aspectTemplate of template) {
      const aspectId = this.extractAspectId(aspectTemplate.name);
      const maxPointsFromTemplate = this.extractMaxPoints(aspectTemplate.name) ||
        this.inferMaxPoints(aspectTemplate, template);

      // Collect all scores for this aspect
      const scores: { studentId: string; points: number; maxPoints: number }[] = [];

      for (const student of data) {
        const aspectData = student.aspects.get(aspectId);
        if (aspectData) {
          scores.push({
            studentId: student.studentId,
            points: aspectData.points,
            maxPoints: aspectData.maxPoints || maxPointsFromTemplate,
          });
        }
      }

      if (scores.length === 0) continue;

      // Calculate max points (use most common or highest)
      const maxPoints = Math.max(...scores.map(s => s.maxPoints), maxPointsFromTemplate);

      // Calculate statistics
      const pointValues = scores.map(s => s.points);
      const mean = pointValues.reduce((a, b) => a + b, 0) / pointValues.length;
      const min = Math.min(...pointValues);
      const max = Math.max(...pointValues);
      const fullMarksCount = scores.filter(s => s.points >= maxPoints).length;

      // Build distribution
      const distribution: Record<number, number> = {};
      for (const score of scores) {
        const pts = score.points;
        distribution[pts] = (distribution[pts] || 0) + 1;
      }

      stats.push({
        id: aspectId,
        name: aspectTemplate.name,
        maxPoints,
        mean: Math.round(mean * 100) / 100,
        min,
        max,
        fullMarksCount,
        distribution,
      });
    }

    return stats;
  }

  /**
   * Generate recommendations based on statistics.
   * Returns raw data — pedagogical interpretation left to methodology/LLM.
   */
  generateRecommendations(_aspects: AspectStatistics[]): string[] {
    return [];
  }

  /**
   * Extract short name from full aspect name
   * "1a GWP-värden (1.0p)" -> "GWP-värden"
   * "6a (Riktningar)" -> "Riktningar"
   */
  private getShortName(name: string): string {
    // Remove aspect ID prefix
    let cleaned = name.replace(/^\d+[a-z]?\s*/i, '');
    // Remove points suffix
    cleaned = cleaned.replace(/\s*\(\d+(?:[.,]\d+)?p\)\s*$/, '');
    // Remove parentheses if that's all that's left
    cleaned = cleaned.replace(/^\((.+)\)$/, '$1');
    return cleaned.trim() || name;
  }

  // ============================================================================
  // Output Formatters
  // ============================================================================

  /**
   * Format output as summary markdown table
   */
  formatSummary(analysis: AspectAnalysisResult): string {
    let output = `## ${analysis.questionId} Aspect Analysis (${analysis.assessedStudents} students)\n\n`;

    output += '| Aspect | Mean | Min | Max | Full marks |\n';
    output += '|--------|------|-----|-----|------------|\n';

    for (const aspect of analysis.aspects) {
      const shortName = this.getShortName(aspect.name);
      const displayName = `${aspect.id} ${shortName}`.slice(0, 25);
      output += `| ${displayName} | ${aspect.mean}p | ${aspect.min}p | ${aspect.max}p | ${aspect.fullMarksCount}/${analysis.assessedStudents} |\n`;
    }

    output += '\n### Recommendations\n';
    for (const rec of analysis.recommendations) {
      output += `- ${rec}\n`;
    }

    output += `\n*Analysis generated: ${analysis.timestamp}*\n`;

    return output;
  }

  /**
   * Format output as detailed markdown
   */
  formatDetailed(analysis: AspectAnalysisResult, includeStudents: boolean = true): string {
    let output = `## ${analysis.questionId} Aspect Analysis\n\n`;
    output += `**Question:** ${analysis.questionTitle}\n`;
    output += `**Students assessed:** ${analysis.assessedStudents}/${analysis.totalStudents}\n`;
    output += `**Generated:** ${analysis.timestamp}\n\n`;

    for (const aspect of analysis.aspects) {
      const shortName = this.getShortName(aspect.name);
      output += `### Aspect ${aspect.id}: ${shortName} (${aspect.maxPoints}p)\n\n`;
      output += `- **Mean:** ${aspect.mean}p\n`;
      output += `- **Range:** ${aspect.min}p - ${aspect.max}p\n`;
      output += `- **Full marks:** ${aspect.fullMarksCount}/${analysis.assessedStudents}\n`;

      // Format distribution
      const distStr = Object.entries(aspect.distribution)
        .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
        .map(([pts, count]) => `${pts}p (${count})`)
        .join(', ');
      output += `- **Distribution:** ${distStr}\n\n`;
    }

    output += '### Recommendations\n\n';
    for (const rec of analysis.recommendations) {
      output += `- ${rec}\n`;
    }

    return output;
  }

  /**
   * Format output as JSON object
   */
  formatJSON(analysis: AspectAnalysisResult): object {
    return {
      question_id: analysis.questionId,
      question_title: analysis.questionTitle,
      total_students: analysis.totalStudents,
      assessed_students: analysis.assessedStudents,
      timestamp: analysis.timestamp,
      aspects: analysis.aspects.map(a => ({
        id: a.id,
        name: a.name,
        max_points: a.maxPoints,
        mean: a.mean,
        min: a.min,
        max: a.max,
        full_marks_count: a.fullMarksCount,
        distribution: a.distribution,
      })),
      recommendations: analysis.recommendations,
    };
  }
}
