/**
 * Project State Manager - TypeScript equivalent of state_manager.py
 *
 * Manages:
 * - project_state.json: Phase completion tracking
 * - workflow_log.jsonl: Detailed action logging
 * - sources.yaml: File tracking (updates only - creation in Phase 1 Python)
 *
 * Design decisions:
 * - Mirrors Python API for consistency across packages
 * - Graceful degradation: state tracking failures don't break tool execution
 * - Atomic writes to prevent corruption
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

// ============================================================================
// Types
// ============================================================================

export type PhaseStatus = 'pending' | 'in_progress' | 'complete' | 'incomplete';

export interface PhaseInfo {
  status: PhaseStatus;
  timestamp: string;
  files_created?: number;
  error?: {
    type: string;
    message: string;
    timestamp: string;
  };
  [key: string]: unknown; // Allow additional phase-specific data
}

export interface ProjectState {
  version: string;
  project_name: string;
  created: string;
  last_updated: string;
  current_phase: number;
  phases: Record<string, PhaseInfo>;
  phase6?: Phase6Session;  // ADR-005: Session state for Phase 6
}

export interface WorkflowLogEntry {
  timestamp: string;
  phase: number | string; // Can be "2b", "2c", "2d", "4b", "4c", etc.
  tool: string;
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  duration_seconds?: number;
}

export interface SourceEntry {
  original_path?: string;
  original_source?: string;
  type: string;
  copied_to?: string;
  file_count?: number;
  note?: string;
  is_default?: boolean;
}

export interface SourcesYaml {
  project: {
    name: string;
    created: string;
  };
  sources: Record<string, SourceEntry>;
  version?: string;
}

/**
 * Phase 6 Session State (ADR-005)
 * Persists assessment session info across tool calls.
 *
 * Supports two modes:
 * - 'qfile' (default): Traditional Q-file with all students in one file
 * - 'per_student': One file per student (lab reports, PDFs)
 */
export interface Phase6Session {
  current_question: string;      // e.g., "Q003"
  assessment_file: string;       // Q-file mode: path to assessment copy
  original_file: string;         // Q-file mode: original Q-file path
  started_at: string;            // ISO timestamp
  assessor: string;              // Assessor name
  methodology_loaded: boolean;   // Has methodology been loaded?
  rubric_displayed: boolean;     // Has rubric been shown?
  // Per-student mode fields (optional, backward-compatible)
  mode?: 'qfile' | 'per_student';
  student_files_dir?: string;              // Directory with student PDFs/MDs
  assessment_output_dir?: string;          // 06_analytic_assessment/ path
  rubric_path?: string;                    // Rubric file path (shared across students)
  students?: PerStudentEntry[];            // Student list with assessment status
  total_students?: number;                 // Total student count
}

/**
 * Entry for a single student in per-student mode
 */
export interface PerStudentEntry {
  id: string;                    // Derived from filename (e.g., "EA")
  source_file: string;           // Full path to student's PDF/MD
  assessment_file?: string;      // Path to BEDÖMNING file (null if not assessed)
  assessed: boolean;
}

// ============================================================================
// Core Functions (Mirror Python API)
// ============================================================================

/**
 * Get ISO 8601 timestamp with Z suffix (UTC)
 */
export function getTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Atomic write: write to temp file, then rename
 */
async function atomicWriteJson(
  filePath: string,
  data: object
): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  try {
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if rename failed
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Atomic write for YAML files
 */
async function atomicWriteYaml(
  filePath: string,
  data: object
): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  const yamlContent = yamlDump(data, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    quotingType: "'",
  });
  try {
    await fs.writeFile(tempPath, yamlContent, 'utf-8');
    await fs.rename(tempPath, filePath);
  } catch (error) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Load existing project_state.json
 * @throws Error if file not found or invalid JSON
 */
export async function loadProjectState(
  projectPath: string
): Promise<ProjectState> {
  const statePath = join(projectPath, 'project_state.json');

  const content = await fs.readFile(statePath, 'utf-8');
  try {
    return JSON.parse(content) as ProjectState;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `project_state.json at ${statePath} is not valid JSON (corrupted or truncated — ` +
      `restore it from a backup or re-run project setup): ${detail}`
    );
  }
}

/**
 * Save project_state.json with UTF-8 encoding
 * Updates last_updated timestamp automatically
 */
export async function saveProjectState(
  projectPath: string,
  state: ProjectState
): Promise<void> {
  state.last_updated = getTimestamp();
  const statePath = join(projectPath, 'project_state.json');
  await atomicWriteJson(statePath, state);
}

/**
 * Update project state with new phase info
 *
 * @param projectPath - Project root directory
 * @param phase - Phase number (e.g., 4, 6, 7)
 * @param status - Phase status
 * @param phaseName - Custom phase name (e.g., "2b_questions")
 * @param extraData - Additional phase-specific data
 */
export async function updateProjectState(
  projectPath: string,
  phase: number,
  status: PhaseStatus,
  phaseName: string,
  extraData?: Record<string, unknown>
): Promise<void> {
  const state = await loadProjectState(projectPath);
  state.current_phase = phase;

  state.phases[phaseName] = {
    status,
    timestamp: getTimestamp(),
    ...extraData,
  };

  await saveProjectState(projectPath, state);
}

/**
 * Append action to workflow_log.jsonl
 *
 * @param projectPath - Project root directory
 * @param phase - Phase identifier (number or string like "2b")
 * @param tool - Tool name (e.g., "phase2b_questions")
 * @param action - Action description (e.g., "question_detection_save")
 * @param inputData - Input parameters
 * @param outputData - Output results (optional)
 * @param durationSeconds - Execution time in seconds (optional)
 */
export async function logWorkflowAction(
  projectPath: string,
  phase: number | string,
  tool: string,
  action: string,
  inputData: Record<string, unknown>,
  outputData?: Record<string, unknown>,
  durationSeconds?: number
): Promise<void> {
  const logPath = join(projectPath, 'workflow_log.jsonl');

  const logEntry: WorkflowLogEntry = {
    timestamp: getTimestamp(),
    phase,
    tool,
    action,
    input: inputData,
    output: outputData || {},
  };

  if (durationSeconds !== undefined) {
    logEntry.duration_seconds = durationSeconds;
  }

  // Append to JSONL file (one JSON per line)
  const line = JSON.stringify(logEntry) + '\n';
  await fs.appendFile(logPath, line, 'utf-8');
}

/**
 * Load sources.yaml
 */
export async function loadSources(projectPath: string): Promise<SourcesYaml> {
  const sourcesPath = join(projectPath, 'sources.yaml');

  const content = await fs.readFile(sourcesPath, 'utf-8');
  return yamlLoad(content) as SourcesYaml;
}

/**
 * Update sources.yaml with new file entry
 *
 * @param projectPath - Project root directory
 * @param sourceKey - Key in sources section (e.g., "exam_config")
 * @param sourceEntry - Source entry data
 */
export async function updateSources(
  projectPath: string,
  sourceKey: string,
  sourceEntry: SourceEntry
): Promise<void> {
  const sourcesPath = join(projectPath, 'sources.yaml');

  const sources = await loadSources(projectPath);
  sources.sources[sourceKey] = sourceEntry;

  await atomicWriteYaml(sourcesPath, sources);
}

/**
 * Check if project_state.json exists at path
 */
export async function hasProjectState(projectPath: string): Promise<boolean> {
  return fileExists(join(projectPath, 'project_state.json'));
}

// ============================================================================
// Convenience Functions for Common Patterns
// ============================================================================

/**
 * Mark phase as in_progress (call at start of tool execution)
 */
export async function markPhaseInProgress(
  projectPath: string,
  phase: number,
  phaseName: string
): Promise<void> {
  await updateProjectState(projectPath, phase, 'in_progress', phaseName);
}

/**
 * Mark phase as complete (call on successful completion)
 */
export async function markPhaseComplete(
  projectPath: string,
  phase: number,
  phaseName: string,
  extraData?: Record<string, unknown>
): Promise<void> {
  await updateProjectState(projectPath, phase, 'complete', phaseName, extraData);
}

/**
 * Mark phase as incomplete with error (call on failure)
 */
export async function markPhaseIncomplete(
  projectPath: string,
  phase: number,
  phaseName: string,
  error: Error
): Promise<void> {
  await updateProjectState(projectPath, phase, 'incomplete', phaseName, {
    error: {
      type: error.name || 'Error',
      message: error.message,
      timestamp: getTimestamp(),
    },
  });
}

// ============================================================================
// Helper: Derive project path from file path
// ============================================================================

/**
 * Derive project root from a file path (e.g., Q-file or exam_config.yaml)
 * Traverses up to find project_state.json (max 5 levels)
 *
 * @param filePath - Any file path within the project
 * @returns Project root path or null if not found
 */
export async function deriveProjectPath(
  filePath: string
): Promise<string | null> {
  let current = filePath;

  // If filePath is a file, start from its directory
  try {
    const stats = await fs.stat(filePath);
    if (stats.isFile()) {
      current = dirname(filePath);
    }
  } catch {
    // Path doesn't exist, try treating as directory
    current = dirname(filePath);
  }

  // Walk up to find project_state.json (max 5 levels)
  for (let i = 0; i < 5; i++) {
    const statePath = join(current, 'project_state.json');
    if (await fileExists(statePath)) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break; // Root reached
    current = parent;
  }

  return null; // Not a managed project
}

// ============================================================================
// Safe Wrapper for State Operations
// ============================================================================

/**
 * Safely execute state operation with graceful degradation
 * Logs errors but doesn't throw, allowing tool execution to continue
 *
 * @param operation - Async operation to execute
 * @param context - Context for error logging
 */
export async function safeStateOperation(
  operation: () => Promise<void>,
  context: string
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[project_state_manager] ${context}: ${message}`);
    // Don't rethrow - graceful degradation
  }
}

// ============================================================================
// Phase 6 Session State (ADR-005)
// ============================================================================

/**
 * Get Phase 6 session state from project_state.json
 * Returns undefined if no session exists or file not found
 */
export async function getPhase6Session(
  projectPath: string
): Promise<Phase6Session | undefined> {
  try {
    const state = await loadProjectState(projectPath);
    return state.phase6;
  } catch {
    return undefined;
  }
}

/**
 * Update Phase 6 session state (partial update)
 * Creates session if it doesn't exist (with defaults for required fields)
 */
export async function updatePhase6Session(
  projectPath: string,
  updates: Partial<Phase6Session>
): Promise<void> {
  const state = await loadProjectState(projectPath);

  // Initialize session if needed
  if (!state.phase6) {
    state.phase6 = {
      current_question: '',
      assessment_file: '',
      original_file: '',
      started_at: getTimestamp(),
      assessor: 'unknown',
      methodology_loaded: false,
      rubric_displayed: false,
    };
  }

  // Apply partial updates
  state.phase6 = { ...state.phase6, ...updates };

  await saveProjectState(projectPath, state);
}

/**
 * Clear Phase 6 session state (call when session ends)
 */
export async function clearPhase6Session(
  projectPath: string
): Promise<void> {
  const state = await loadProjectState(projectPath);
  delete state.phase6;
  await saveProjectState(projectPath, state);
}
