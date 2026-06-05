/**
 * ExamConfigReader - Reads exam_config.yaml for assessment context
 *
 * Uses exam_config.yaml as an INDEX to locate rubric sections,
 * NOT as the source of assessment criteria (that's rubric.md).
 *
 * @see docs/implementation/IMPL-SPEC-assessment-start-rubric-integration.md
 */

import { promises as fs } from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';

export interface AspectConfig {
  id: string;
  name: string;
  points: number;
}

export interface RubricData {
  section_title?: string;
  rubric_points?: number;
  aspects?: AspectConfig[];
  aspect_sum?: number;
}

export interface QuestionConfig {
  id: string; // "Q1"
  number: number; // 1
  question_title: string; // "Global Warming Potential..."
  rubric_id?: string; // "L2A_REMEMBER_02"
  points: number; // 3
  rubric_verified?: boolean;
  rubric_data?: RubricData;
  question_type?: string;
  raw_header?: string;
  subquestions?: string[];
  learning_objectives?: string[];
  max_marks?: number;
  section_title?: string;
  conflict_resolution?: { auto_resolved?: boolean; [key: string]: unknown };
  teacher_action_required?: boolean;
  teacher_note?: string;
}

export interface ExamMetadata {
  id: string;
  course_code: string;
  exam_name: string;
  date?: string;
}

export interface ExamConfig {
  exam: ExamMetadata;
  questions: QuestionConfig[];
  students?: {
    count?: number;
    ids?: string[];
  };
  answer_boundaries?: {
    global?: Record<string, unknown>;
    questions?: Record<string, {
      sub_questions?: Record<string, string>;
      auto_graded?: boolean;
      skip_boundary_detection?: boolean;
      [key: string]: unknown;
    }>;
  };
}

export class ExamConfigReader {
  /**
   * Find exam_config.yaml relative to Q-file path
   * Searches: same directory, parent directory, grandparent directory
   * RFC-018: Q-files are in 05_answers_by_question/ or 06_analytic_assessment/
   */
  async findConfigPath(qFilePath: string): Promise<string | null> {
    const searchDirs = [
      path.dirname(qFilePath), // 05/ or 06/ directory
      path.dirname(path.dirname(qFilePath)), // project root
      path.dirname(path.dirname(path.dirname(qFilePath))), // one more up
    ];

    for (const dir of searchDirs) {
      const configPath = path.join(dir, 'exam_config.yaml');
      try {
        await fs.access(configPath);
        return configPath;
      } catch {
        continue;
      }
    }
    return null;
  }

  /**
   * Load and parse exam_config.yaml
   */
  async load(configPath: string): Promise<ExamConfig> {
    const content = await fs.readFile(configPath, 'utf-8');
    return yaml.load(content) as ExamConfig;
  }

  /**
   * Get question config by ID (e.g., "Q1", "Q2")
   */
  getQuestionById(config: ExamConfig, questionId: string): QuestionConfig | null {
    return config.questions.find((q) => q.id === questionId) || null;
  }

  /**
   * Get question config by number (e.g., 1, 2)
   */
  getQuestionByNumber(
    config: ExamConfig,
    questionNumber: number
  ): QuestionConfig | null {
    return config.questions.find((q) => q.number === questionNumber) || null;
  }

  /**
   * Extract question ID from Q-file path
   * "Q1_alla_elever.md" → "Q1"
   */
  extractQuestionId(qFilePath: string): string | null {
    const filename = path.basename(qFilePath);
    const match = filename.match(/^(Q\d+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  /**
   * Get the project directory from Q-file path
   * RFC-018: Goes up from 05_answers_by_question/ or 06_analytic_assessment/ to project root
   */
  getProjectDir(qFilePath: string): string {
    // RFC-018: Q-file is in 05/ or 06/ directory
    return path.dirname(path.dirname(qFilePath));
  }
}
