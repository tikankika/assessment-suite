/**
 * Project Repair Types (RFC-015)
 *
 * Types for the project_repair tool that fixes path portability issues
 * by converting absolute paths to relative paths.
 */

/**
 * A single path change made during repair
 */
export interface PathChange {
  file: string; // e.g., "project_state.json"
  field: string; // e.g., "phase6.assessment_file"
  old_value: string; // Absolute path
  new_value: string; // Relative path
  verified: boolean; // File exists at new relative path
}

/**
 * Result of the project_repair tool
 */
export interface ProjectRepairResult {
  status: 'repaired' | 'already_portable' | 'error';
  project_path: string;
  changes: PathChange[];
  warnings: string[];
  summary: {
    files_scanned: number;
    absolute_paths_found: number;
    paths_converted: number;
    files_updated: string[];
  };
}

/**
 * Input parameters for project_repair tool
 */
export interface ProjectRepairInput {
  project_path: string;
  dry_run?: boolean; // If true, report changes without applying them
}

/**
 * Detected absolute path in a file
 */
export interface DetectedAbsolutePath {
  file: string;
  field: string;
  value: string;
  suggested_relative: string | null; // null if cannot determine
}
