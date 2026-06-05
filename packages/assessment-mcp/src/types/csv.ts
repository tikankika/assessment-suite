/**
 * CSV types for Phase 4C v2.0
 *
 * Defines the structure for CSV-based answer mappings output.
 * CSV format is more compact (~50% smaller) and avoids MCP parameter limits.
 */

/**
 * CSV row for student answer mapping
 * One row per student answer (student × question)
 */
export interface AnswerMappingCSVRow {
  student_id: string;
  file_path: string;
  question_id: string;
  start_line: number;
  end_line: number;
  word_count: number;
  skip_extraction: 0 | 1;  // 0 = extract, 1 = skip
  context_before: string;   // || used as newline delimiter
  context_after: string;    // || used as newline delimiter
  status: string;           // "answered", "unanswered", etc
}

/**
 * Metadata for CSV mappings
 */
export interface MappingMetadata {
  version: string;
  created: string;
  project_path: string;
  stats: {
    total_students: number;
    total_answers: number;
    completion_rate: number;
  };
  data_format: {
    type: 'csv';
    file: string;
    delimiter: string;
    newline_marker: string;
    encoding: string;
  };
}

/**
 * Reference in exam_config.yaml
 */
export interface StudentMappingsReference {
  type: 'csv';
  file: string;
  metadata_file: string;
  created: string;
  total_students: number;
}
