import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { load, dump } from 'js-yaml';
import {
  deriveProjectPath,
  markPhaseInProgress,
  markPhaseComplete,
  markPhaseIncomplete,
  logWorkflowAction,
  safeStateOperation,
} from '../shared/project_state_manager.js';
import { validatePathOrThrow } from '../core/path_validator.js';
import { FOLDERS, LEGACY_FOLDERS } from '../shared/folder_constants.js';

/**
 * Phase 2D: Student Discovery (ADR-006: renumbered from Phase 4E)
 *
 * Discovers and registers student information before Q-file creation.
 * Scans student markdown files OR existing Q-files and extracts:
 * - List of all student IDs
 * - ID format pattern (for validation)
 * - Student count
 *
 * This data is saved to exam_config.yaml for use by Phase 5 and Phase 7.
 *
 * TWO SOURCES:
 * 1. student_files (default): 02_markdown/student_answers/*.md
 * 2. q_files (fallback): 05_answers_by_question/Q*.md or 06_analytic_assessment/Q*.md (RFC-018)
 *
 * @see RFC-001 for full specification
 */

// ============================================================================
// Input/Output Types
// ============================================================================

export interface Phase2dInput {
  project_path: string;
  mode: 'discover' | 'save';
  /** Extract from Q-files instead of student files (for existing projects) */
  from_qfiles?: boolean;
  /** Students data to save (for save mode) */
  students?: StudentsConfig;
}

export interface StudentsConfig {
  count: number;
  id_format: string;
  id_pattern: string;
  id_examples: string[];
  ids: string[];
  source: 'student_files' | 'q_files';
}

// DISCOVER mode output
export interface Phase2dDiscoverOutput {
  mode: 'discover';
  success: boolean;
  students_discovered: number;
  student_ids: string[];
  id_format: string;
  id_pattern: string;
  confidence: number;
  source: 'student_files' | 'q_files';
  instructions: string;
}

// SAVE mode output
export interface Phase2dSaveOutput {
  mode: 'save';
  success: boolean;
  config_path: string;
  summary: {
    students_registered: number;
    id_format: string;
  };
}

export type Phase2dOutput = Phase2dDiscoverOutput | Phase2dSaveOutput;

// ============================================================================
// ID Format Patterns
// ============================================================================

interface FormatPattern {
  pattern: RegExp;
  name: string;
  example: string;
}

const ID_FORMAT_PATTERNS: FormatPattern[] = [
  { pattern: /^\d+_\d+$/, name: 'numeric_underscore', example: '12345_67890' },
  { pattern: /^\d+$/, name: 'numeric_only', example: '12345678' },
  { pattern: /^[A-Za-z]+\d+$/, name: 'alpha_numeric', example: 'Student123' },
  { pattern: /^[A-Za-z]{3}[A-Za-z]{3}\d{4}$/, name: 'name_code', example: 'JohDoe2024' },
  { pattern: /^[A-Za-z0-9_-]+$/, name: 'alphanumeric_mixed', example: 'John_Doe-123' },
];

function detectIdFormat(studentIds: string[]): { pattern: string; name: string; confidence: number } {
  if (studentIds.length === 0) {
    return { pattern: '.*', name: 'unknown', confidence: 0 };
  }

  let bestMatch = { pattern: '.*', name: 'unknown', confidence: 0 };

  for (const { pattern, name } of ID_FORMAT_PATTERNS) {
    const matches = studentIds.filter(id => pattern.test(id)).length;
    const confidence = matches / studentIds.length;

    if (confidence > bestMatch.confidence) {
      bestMatch = { pattern: pattern.source, name, confidence };
    }
  }

  return bestMatch;
}

// ============================================================================
// Student Discovery Functions
// ============================================================================

async function discoverFromStudentFiles(projectPath: string): Promise<string[]> {
  const studentAnswersPath = join(projectPath, FOLDERS.PHASE2_MARKDOWN, 'student_answers');

  const files = await fs.readdir(studentAnswersPath);
  const studentIds = files
    .filter(f => f.endsWith('.md'))
    .map(f => basename(f, '.md'))
    .sort();

  return studentIds;
}

async function discoverFromQFiles(projectPath: string): Promise<string[]> {
  // RFC-018: Try 05/ first, then 06/, then legacy 03/
  const possiblePaths = [
    join(projectPath, FOLDERS.PHASE5_ANSWERS),
    join(projectPath, FOLDERS.PHASE6_ASSESSMENT),
    join(projectPath, LEGACY_FOLDERS.ANSWERS_OLD),  // Legacy fallback (pre-RFC-018)
  ];

  let qFilesPath: string | null = null;
  let qFiles: string[] = [];

  for (const path of possiblePaths) {
    try {
      const files = await fs.readdir(path);
      const foundQFiles = files.filter(f => f.startsWith('Q') && f.endsWith('.md'));
      if (foundQFiles.length > 0) {
        qFilesPath = path;
        qFiles = foundQFiles;
        break;
      }
    } catch {
      // Directory doesn't exist, continue
    }
  }

  if (!qFilesPath || qFiles.length === 0) {
    throw new Error(`No Q-files found in ${FOLDERS.PHASE5_ANSWERS}/, ${FOLDERS.PHASE6_ASSESSMENT}/, or ${LEGACY_FOLDERS.ANSWERS_OLD}/`);
  }

  const studentIds = new Set<string>();

  // Parse student headers from Q-files
  // Pattern: "## Elev {id} ({n} ord)"
  // Support various ID formats including underscores, hyphens, etc.
  const studentHeaderRegex = /^## Elev ([^\s(]+) \(\d+ ord\)/gm;

  for (const qFile of qFiles) {
    const content = await fs.readFile(join(qFilesPath, qFile), 'utf-8');
    let match;

    while ((match = studentHeaderRegex.exec(content)) !== null) {
      studentIds.add(match[1]);
    }
  }

  return Array.from(studentIds).sort();
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function phase2dStudents(input: Phase2dInput): Promise<Phase2dOutput> {
  const { project_path, mode, from_qfiles = false } = input;
  validatePathOrThrow(project_path);

  if (mode === 'save') {
    return handleSaveMode(input);
  }

  return handleDiscoverMode(project_path, from_qfiles);
}

// ============================================================================
// DISCOVER Mode
// ============================================================================

async function handleDiscoverMode(
  projectPath: string,
  fromQFiles: boolean
): Promise<Phase2dDiscoverOutput> {
  // Discover students
  let studentIds: string[];
  let source: 'student_files' | 'q_files';

  if (fromQFiles) {
    studentIds = await discoverFromQFiles(projectPath);
    source = 'q_files';
  } else {
    try {
      studentIds = await discoverFromStudentFiles(projectPath);
      source = 'student_files';
    } catch {
      // Fallback to Q-files if student files not found
      studentIds = await discoverFromQFiles(projectPath);
      source = 'q_files';
    }
  }

  if (studentIds.length === 0) {
    throw new Error('No students found');
  }

  // Detect ID format
  const { pattern, name, confidence } = detectIdFormat(studentIds);

  // Build instructions
  const instructions = buildInstructions(studentIds, name, pattern, source);

  return {
    mode: 'discover',
    success: true,
    students_discovered: studentIds.length,
    student_ids: studentIds,
    id_format: name,
    id_pattern: pattern,
    confidence,
    source,
    instructions,
  };
}

function buildInstructions(
  studentIds: string[],
  idFormat: string,
  idPattern: string,
  source: string
): string {
  const exampleList = studentIds.slice(0, 5).map(id => `- ${id}`).join('\n');
  const moreCount = studentIds.length > 5 ? studentIds.length - 5 : 0;

  return `
## Phase 4E: Student Discovery - COMPLETE

**Studenter hittade:** ${studentIds.length}
**Källa:** ${source === 'student_files' ? `${FOLDERS.PHASE2_MARKDOWN}/student_answers/` : `${FOLDERS.PHASE5_ANSWERS}/ (eller ${FOLDERS.PHASE6_ASSESSMENT}/)`}
**ID-format:** ${idFormat}
**Mönster:** ${idPattern}

### Exempel på student-ID:n:
${exampleList}
${moreCount > 0 ? `... och ${moreCount} till` : ''}

### Nästa steg:

Spara student-metadata till exam_config.yaml genom att köra igen med mode="save".
`.trim();
}

// ============================================================================
// SAVE Mode
// ============================================================================

async function handleSaveMode(input: Phase2dInput): Promise<Phase2dSaveOutput> {
  const { project_path, students } = input;
  const startTime = performance.now();

  if (!students) {
    throw new Error('students is required for SAVE mode');
  }

  // Derive project root for state tracking
  const stateProjectPath = await deriveProjectPath(project_path);

  // Mark phase as in_progress
  if (stateProjectPath) {
    await safeStateOperation(
      () => markPhaseInProgress(stateProjectPath, 2, '2d_students'),
      'phase2d markPhaseInProgress'
    );
  }

  try {
    // Load existing exam_config.yaml
    const configPath = join(project_path, 'exam_config.yaml');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = load(configContent) as Record<string, unknown>;

    // Add students section
    config.students = students;

    // Write updated config
    await fs.writeFile(
      configPath,
      dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      }),
      'utf-8'
    );

    const durationSeconds = (performance.now() - startTime) / 1000;

    // Update project state on success
    if (stateProjectPath) {
      await safeStateOperation(
        () => markPhaseComplete(stateProjectPath, 2, '2d_students', {
          students_registered: students.count,
          id_format: students.id_format,
        }),
        'phase2d markPhaseComplete'
      );

      // Log workflow action
      await safeStateOperation(
        () => logWorkflowAction(
          stateProjectPath,
          '2d',
          'phase2d_students',
          'student_discovery_save',
          {
            project_path,
            from_qfiles: students.source === 'q_files',
          },
          {
            config_path: configPath,
            students_registered: students.count,
            id_format: students.id_format,
            id_pattern: students.id_pattern,
            success: true,
          },
          durationSeconds
        ),
        'phase2d logWorkflowAction'
      );
    }

    return {
      mode: 'save',
      success: true,
      config_path: configPath,
      summary: {
        students_registered: students.count,
        id_format: students.id_format,
      },
    };
  } catch (error) {
    // Mark phase as incomplete on error
    if (stateProjectPath) {
      await safeStateOperation(
        () => markPhaseIncomplete(stateProjectPath, 2, '2d_students', error as Error),
        'phase2d markPhaseIncomplete'
      );
    }
    throw error;
  }
}

// ============================================================================
// Convenience: Auto-discover and save in one call
// ============================================================================

export async function phase2dStudentsAuto(
  projectPath: string,
  fromQFiles: boolean = false
): Promise<Phase2dSaveOutput> {
  // First discover
  const discoverResult = await handleDiscoverMode(projectPath, fromQFiles);

  // Then save
  return handleSaveMode({
    project_path: projectPath,
    mode: 'save',
    students: {
      count: discoverResult.students_discovered,
      id_format: discoverResult.id_format,
      id_pattern: discoverResult.id_pattern,
      id_examples: discoverResult.student_ids.slice(0, 5),
      ids: discoverResult.student_ids,
      source: discoverResult.source,
    },
  });
}
