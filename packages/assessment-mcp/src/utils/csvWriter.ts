/**
 * CSV Writer Utilities for Phase 4C v2.0
 *
 * Handles reading/writing answer mappings in CSV format.
 * Supports both batch (overwrite) and append modes.
 */

import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';
import { promises as fs } from 'fs';
import type { AnswerMappingCSVRow } from '../types/csv.js';

/**
 * CSV column order (fixed for consistency)
 */
const CSV_COLUMNS = [
  'student_id',
  'file_path',
  'question_id',
  'start_line',
  'end_line',
  'word_count',
  'skip_extraction',
  'context_before',
  'context_after',
  'status'
] as const;

/**
 * Write answer mappings to CSV file (overwrite mode)
 */
export async function writeAnswerMappingsCSV(
  outputPath: string,
  rows: AnswerMappingCSVRow[]
): Promise<void> {
  const csvContent = stringify(rows, {
    header: true,
    columns: [...CSV_COLUMNS]
  });

  await fs.writeFile(outputPath, csvContent, 'utf-8');
}

/**
 * Append answer mappings to existing CSV file
 * Handles deduplication by student_id + question_id
 */
export async function appendAnswerMappingsCSV(
  csvPath: string,
  newRows: AnswerMappingCSVRow[]
): Promise<number> {
  // Check if file exists
  let existingRows: AnswerMappingCSVRow[] = [];

  try {
    const content = await fs.readFile(csvPath, 'utf-8');
    existingRows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      cast: true
    });
  } catch {
    // File doesn't exist, will create new
  }

  // Remove duplicates (same student_id + question_id)
  const existingKeys = new Set(
    existingRows.map(r => `${r.student_id}:${r.question_id}`)
  );

  const uniqueNewRows = newRows.filter(
    r => !existingKeys.has(`${r.student_id}:${r.question_id}`)
  );

  // Combine and write
  const allRows = [...existingRows, ...uniqueNewRows];
  await writeAnswerMappingsCSV(csvPath, allRows);

  return allRows.length;
}

/**
 * Read existing CSV and return all rows
 */
export async function readAnswerMappingsCSV(
  csvPath: string
): Promise<AnswerMappingCSVRow[]> {
  try {
    const content = await fs.readFile(csvPath, 'utf-8');
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      cast: true
    });
  } catch {
    return []; // File doesn't exist
  }
}

/**
 * Read existing CSV and return row count
 */
export async function getCSVRowCount(csvPath: string): Promise<number> {
  try {
    const content = await fs.readFile(csvPath, 'utf-8');
    const rows = parse(content, {
      columns: true,
      skip_empty_lines: true
    });
    return rows.length;
  } catch {
    return 0; // File doesn't exist
  }
}

/**
 * Helper: Escape newlines for CSV context fields
 * Converts \n to || for safe CSV storage
 */
export function escapeNewlines(text: string): string {
  if (!text) return '';
  return text.replace(/\n/g, '||');
}

/**
 * Helper: Unescape newlines from CSV context fields
 * Converts || back to \n when reading
 */
export function unescapeNewlines(text: string): string {
  if (!text) return '';
  return text.replace(/\|\|/g, '\n');
}

/**
 * Helper: Calculate completion rate from CSV rows
 */
export function calculateCompletionRate(rows: AnswerMappingCSVRow[]): number {
  if (rows.length === 0) return 0;
  const answered = rows.filter(r => r.status === 'answered').length;
  return (answered / rows.length) * 100;
}

/**
 * Get unique student count from CSV rows
 */
export function getUniqueStudentCount(rows: AnswerMappingCSVRow[]): number {
  const uniqueStudents = new Set(rows.map(r => r.student_id));
  return uniqueStudents.size;
}
