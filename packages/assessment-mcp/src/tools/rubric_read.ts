import { promises as fs } from 'fs';
import { validatePathOrThrow } from '../core/path_validator.js';
import { escapeRegex } from '../utils/regex_utils.js';

/**
 * rubric_read - Read rubric/bedömningsanvisningar file
 *
 * Gives Claude Desktop direct access to the full rubric file.
 * No parsing - Claude interprets the format.
 *
 * @param args.rubric_path - Path to bedömningsanvisningar file
 * @param args.question_id - Optional: filter to specific question section
 * @returns Full rubric content or specific question section
 */
export async function rubricRead(args: {
  rubric_path: string;
  question_id?: string;
}): Promise<{
  content: string;
  path: string;
  questionSection?: string;
}> {
  const { rubric_path, question_id } = args;

  console.error('[rubric_read] START');
  console.error('[rubric_read] rubric_path:', rubric_path);
  console.error('[rubric_read] question_id:', question_id || '(full file)');

  // Security: Validate path before any file operations
  validatePathOrThrow(rubric_path);

  // Read the full file
  const content = await fs.readFile(rubric_path, 'utf-8');
  console.error('[rubric_read] File read, length:', content.length);

  // If no question_id, return full content
  if (!question_id) {
    console.error('[rubric_read] Returning full content');
    return {
      content,
      path: rubric_path,
    };
  }

  // Try to extract specific question section
  const questionSection = extractQuestionSection(content, question_id);

  if (questionSection) {
    console.error('[rubric_read] Found question section, length:', questionSection.length);
    return {
      content,
      path: rubric_path,
      questionSection,
    };
  }

  console.error('[rubric_read] Question section not found, returning full content');
  return {
    content,
    path: rubric_path,
  };
}

/**
 * Extract a specific question section from rubric content
 *
 * Tries multiple patterns:
 * - "# Question 1:" / "## Question 1:"
 * - "# Fråga 1:" / "## Fråga 1:"
 * - "# FRÅGA 1:" / "## FRÅGA 1:"
 */
function extractQuestionSection(content: string, questionId: string): string | null {
  // Build pattern to find question header
  // Supports: "Question 1", "Fråga 1", "FRÅGA 1", "Q1", etc.
  const escaped = escapeRegex(questionId);
  const patterns = [
    new RegExp(`^#{1,2}\\s*Question\\s+${escaped}[:\\s].*$`, 'mi'),
    new RegExp(`^#{1,2}\\s*Fråga\\s+${escaped}[:\\s].*$`, 'mi'),
    new RegExp(`^#{1,2}\\s*FRÅGA\\s+${escaped}[:\\s].*$`, 'mi'),
    new RegExp(`^#{1,2}\\s*Q${escaped}[:\\s].*$`, 'mi'),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const startIndex = content.indexOf(match[0]);

      // Find next question header (same level or higher)
      const remaining = content.slice(startIndex + match[0].length);
      const nextMatch = remaining.match(/^#{1,2}\s*(?:Question|Fråga|FRÅGA|Q)\s*\d+/m);

      const endIndex = nextMatch
        ? startIndex + match[0].length + remaining.indexOf(nextMatch[0])
        : content.length;

      return content.slice(startIndex, endIndex).trim();
    }
  }

  return null;
}
