import { promises as fs } from 'fs';
import { dump } from 'js-yaml';
import { Question, ExamConfigYAML } from '../types/exam.js';

/**
 * Phase 4A: YAML Generation for exam_config.yaml
 *
 * CRITICAL: Uses CORRECT format from roadmap:
 * - questions: Direct array [...] NOT nested object
 * - exam.date NOT exam.exam_date
 * - NO extraction section (that's from old Pre-Assessment system)
 */

/**
 * Generate exam configuration object from extracted questions
 *
 * @param questions - Array of Question objects from ExamAnalyzer
 * @param projectPath - Optional project path for extracting course info
 * @returns ExamConfigYAML object ready for YAML serialization
 */
export function generateExamConfig(
  questions: Question[],
  projectPath?: string,
  options?: {
    course_code?: string;
    exam_name?: string;
    exam_date?: string;
  }
): ExamConfigYAML {
  const courseCode = options?.course_code || extractCourseCode(projectPath);
  const examDate = options?.exam_date || new Date().toISOString().split('T')[0];
  const examName = options?.exam_name || 'Exam';

  return {
    exam: {
      id: `${courseCode.toLowerCase()}_exam_${examDate.replace(/-/g, '')}`,
      course_code: courseCode,
      exam_name: examName,
      date: examDate,
    },
    // ✅ Direct array, NOT nested object with list/details
    questions: questions.map(q => ({
      // Always use standardized Q00X format (Q001, Q002, etc.)
      // Even if Claude provides Q1, Q2 - normalize to Q001, Q002
      id: normalizeQuestionId(q.id, q.number),
      number: q.number,
      rubric_id: q.rubric_id,
      raw_header: q.raw_header,
      // Handle both question_title and title field names
      question_title: q.question_title || q.title || '',
      // Use teacher-verified points, fallback to max_marks
      points: q.points || q.max_marks,
      question_type: q.question_type,
      ...(q.learning_objectives?.length ? { learning_objectives: q.learning_objectives } : {}),
      // question_text removed - exists in exam_questions_annotated.md
    })),
    // ✅ NO extraction section! (that's from old Pre-Assessment system)
  };
}

/**
 * Save exam configuration to YAML file
 *
 * @param filePath - Path to save exam_config.yaml
 * @param config - ExamConfigYAML object
 */
export async function saveExamConfig(
  filePath: string,
  config: ExamConfigYAML
): Promise<void> {
  const yamlContent = dump(config, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });

  await fs.writeFile(filePath, yamlContent, 'utf-8');
}

/**
 * Load existing exam configuration from YAML file
 *
 * @param filePath - Path to exam_config.yaml
 * @returns ExamConfigYAML object or null if file doesn't exist
 */
export async function loadExamConfig(
  filePath: string
): Promise<ExamConfigYAML | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    // Use js-yaml's load function
    const { load } = await import('js-yaml');
    return load(content) as ExamConfigYAML;
  } catch {
    return null;
  }
}

/**
 * Normalize question ID to Q00X format (Q001, Q002, etc.)
 *
 * Handles various input formats:
 * - Q1, Q2 → Q001, Q002
 * - Q01, Q02 → Q001, Q002
 * - 1, 2 → Q001, Q002
 * - Already Q001 → Q001 (no change)
 *
 * @param id - Input ID (may be null/undefined)
 * @param number - Question number as fallback
 * @returns Normalized ID in Q00X format
 */
function normalizeQuestionId(id: string | undefined, number: number): string {
  // If no ID provided, generate from number
  if (!id) {
    return `Q${String(number).padStart(3, '0')}`;
  }

  // Extract numeric part from ID (Q1 → 1, Q01 → 1, Q001 → 1)
  const match = id.match(/Q?0*(\d+)/i);
  if (match) {
    const num = parseInt(match[1], 10);
    return `Q${String(num).padStart(3, '0')}`;
  }

  // Fallback to number-based generation
  return `Q${String(number).padStart(3, '0')}`;
}

/**
 * Extract course code from project path
 *
 * Looks for an institutional course-code shape in the path's basename:
 * `<LETTERS><DIGITS>[<X>]` — e.g. `/path/to/<COURSE>_project/`.
 *
 * @param projectPath - Project directory path
 * @returns Course code or 'UNKNOWN'
 */
function extractCourseCode(projectPath?: string): string {
  if (!projectPath) {
    return 'UNKNOWN';
  }

  // Try to find course code pattern in path
  const pathParts = projectPath.split('/');

  for (const part of pathParts.reverse()) {
    // Match institutional course-code shape: <LETTERS><DIGITS>[<X>]
    const match = part.match(/^([A-Z]{2,4}\d{2,4}[A-Z]?)(?:_|$)/i);
    if (match) {
      return match[1].toUpperCase();
    }
  }

  return 'UNKNOWN';
}

/**
 * Generate YAML string without saving to file
 *
 * Useful for preview/testing
 *
 * @param config - ExamConfigYAML object
 * @returns YAML string
 */
export function generateYAMLString(config: ExamConfigYAML): string {
  return dump(config, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
}
