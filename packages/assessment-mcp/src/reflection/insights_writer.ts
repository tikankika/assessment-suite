/**
 * InsightsWriter - Appends teacher insights to Teacher_Insights.md
 *
 * Philosophy: Claude Desktop generates insights dynamically during assessment.
 * This class simply saves them - it does NOT generate insights.
 *
 * @see methodology/cross_phase/meta_reflection_method.md for the cross-phase methodology
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { load } from 'js-yaml';

export interface InsightEntry {
  type: 'pattern' | 'pedagogical' | 'critical' | 'summary';  // NO "trend" - that's automated data!
  content: string;
  timestamp: string;
  /**
   * @deprecated Per cross_phase/meta_reflection_method.md § 4.3, per-student data does not
   * belong in Teacher_Insights.md. The field is kept for backwards
   * compatibility with older callers but is ignored by formatEntry().
   * Use Phase 9 (per-student profile) for student-specific observations.
   */
  relatedStudents?: string[];
  relatedQuestions?: string[];
}

export class InsightsWriter {
  private readonly FILENAME = 'Teacher_Insights.md';

  /**
   * Get insights file path (same folder as Q-files)
   */
  getInsightsPath(assessmentPath: string): string {
    const dir = path.dirname(assessmentPath);
    return path.join(dir, this.FILENAME);
  }

  /**
   * Format insight type to Swedish header
   */
  typeToHeader(type: string): string {
    const headers: Record<string, string> = {
      pattern: 'Mönster & Missförstånd',
      pedagogical: 'Pedagogiska Insikter',
      critical: 'Kritiska Observationer',
      summary: 'Sammanfattningar',
      // NO "trend" - student progression is automated data in Assessment_Status_Summary.md!
    };
    return headers[type] || type;
  }

  /**
   * Append insight to file (creates file if it doesn't exist)
   */
  async appendInsight(
    assessmentPath: string,
    insight: InsightEntry
  ): Promise<string> {
    const filePath = this.getInsightsPath(assessmentPath);
    const exists = await this.fileExists(filePath);

    try {
      if (!exists) {
        await this.createNewFile(filePath, assessmentPath);
      }

      const entry = this.formatEntry(insight);
      await fs.appendFile(filePath, entry, 'utf-8');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to write insight to ${filePath}: ${msg}`);
    }

    return filePath;
  }

  /**
   * Format a single insight entry for the markdown file
   *
   * Note: relatedStudents is intentionally NOT emitted, per Phase 7
   * methodology § 4.1 anti-patterns. Per-student data belongs in
   * Phase 9 (per-student profile), not in aggregate Teacher_Insights.md.
   */
  private formatEntry(insight: InsightEntry): string {
    const relations: string[] = [];
    // relatedStudents is deprecated and ignored — see InsightEntry doc-comment
    if (insight.relatedQuestions?.length) {
      relations.push(`Frågor: ${insight.relatedQuestions.join(', ')}`);
    }
    const relationsLine = relations.length
      ? `\n*${relations.join(' | ')}*\n`
      : '';

    return `
### ${insight.timestamp} - ${this.typeToHeader(insight.type)}
${relationsLine}
${insight.content}

---
`;
  }

  /**
   * Try to read exam_config.yaml from project root for metadata context.
   */
  private async readExamConfig(assessmentPath: string): Promise<Record<string, any> | null> {
    // Walk up from Q-file dir to find exam_config.yaml (max 5 levels)
    let dir = path.dirname(assessmentPath);
    for (let i = 0; i < 5; i++) {
      const configPath = path.join(dir, 'exam_config.yaml');
      try {
        const raw = await fs.readFile(configPath, 'utf-8');
        return load(raw) as Record<string, any>;
      } catch {
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
    return null;
  }

  /**
   * Create new insights file with YAML frontmatter (metadata convention v1.0)
   */
  private async createNewFile(
    filePath: string,
    assessmentPath: string
  ): Promise<void> {
    const now = new Date();
    const created = now.toISOString();
    const date = created.split('T')[0];

    // Try to get course context from exam_config
    const config = await this.readExamConfig(assessmentPath);
    const exam = config?.exam || {};
    const questions = config?.questions || [];
    const questionIds = questions.map((q: any) => q.id).filter(Boolean);

    const lines: string[] = [];
    lines.push('---');
    lines.push('type: teacher_insight');
    lines.push(`created: ${created}`);
    lines.push(`date: ${date}`);
    if (exam.course_code && exam.course_code !== 'UNKNOWN') lines.push(`course_code: ${exam.course_code}`);
    if (exam.id && !exam.id.startsWith('unknown_')) lines.push(`course_instance: ${exam.id}`);
    lines.push('status: active');
    lines.push('metadata_version: "1.0"');
    const examTag = exam.exam_name && exam.exam_name !== 'Exam'
      ? ', ' + exam.exam_name.toLowerCase().replace(/\s+/g, '-')
      : '';
    lines.push(`tags: [assessment, teacher-insight${examTag}]`);
    if (questionIds.length > 0) lines.push(`questions_analyzed: [${questionIds.join(', ')}]`);
    lines.push('provenance:');
    lines.push('  tool: reflect_insights');
    lines.push('  ai_assisted: true');
    lines.push('---');
    lines.push('');
    lines.push('# Teacher Insights');
    lines.push('');
    lines.push(`**Assessment folder:** ${path.dirname(assessmentPath)}`);
    lines.push(`**Created:** ${date}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
