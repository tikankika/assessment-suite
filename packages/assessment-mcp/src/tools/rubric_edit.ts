import { promises as fs } from 'fs';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { RubricWriter } from '../core/rubric_writer.js';
import { RubricParser } from '../shared/rubric_parser.js';
import { StudentReader } from '../core/student_reader.js';
import { validatePathOrThrow } from '../core/path_validator.js';
import {
  logWorkflowAction,
  deriveProjectPath,
  safeStateOperation,
} from '../shared/project_state_manager.js';

/**
 * rubric_edit - Update rubric aspects with exam_config sync
 *
 * Cross-phase tool (used in Phase 4B and Phase 6).
 *
 * Features:
 * - Updates max points for an aspect
 * - Updates criteria text
 * - Syncs changes to exam_config.yaml
 * - Creates backup before modification
 * - Logs changes for audit trail
 * - Warns about students already assessed with old criteria
 *
 * @param args.rubric_path - Path to bedömningsanvisningar file
 * @param args.question_id - Question identifier (e.g., "E4", "6")
 * @param args.updates.aspect_name - Which aspect to update (e.g., "E4b")
 * @param args.updates.new_max_points - Optional: New max points
 * @param args.updates.new_criteria - Optional: New criteria text
 * @param args.reason - Required: Why the change is being made (audit trail)
 * @param args.q_file_path - Optional: Path to Q-file to check affected students
 */

export interface RubricEditInput {
  rubric_path: string;
  exam_config_path?: string;  // Path to exam_config.yaml for sync
  question_id: string;
  updates: {
    aspect_name: string;
    new_max_points?: number;
    new_criteria?: string;
  };
  reason: string;
  q_file_path?: string;
  sync_config?: boolean;  // Default: true - sync changes to exam_config.yaml
}

export interface RubricEditOutput {
  success: boolean;
  rubric_path: string;
  question_id: string;
  updated_aspect: string;
  previous: {
    max_points: number | null;
    criteria: string;
  };
  new: {
    max_points: number | null;
    criteria: string;
  };
  affected_students: {
    already_assessed: string[];
    remaining: string[];
  };
  warning: string | null;
  changelog_entry: string;
  config_synced: boolean;  // Whether exam_config.yaml was updated
}

// ============================================================================
// Helper: Sync exam_config.yaml with rubric changes
// ============================================================================

interface ExamConfig {
  questions: Array<{
    id: string;
    rubric_data?: {
      aspects?: Array<{
        id: string;
        points: number;
      }>;
      aspect_sum?: number;
    };
  }>;
}

async function syncExamConfig(
  configPath: string,
  questionId: string,
  aspectId: string,
  newPoints: number
): Promise<boolean> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = yamlLoad(content) as ExamConfig;

    // Find question by id (Q001, Q002, etc.)
    const question = config.questions?.find(q => q.id === questionId);
    if (!question?.rubric_data?.aspects) {
      return false;
    }

    // Find and update aspect
    const aspect = question.rubric_data.aspects.find(a => a.id === aspectId);
    if (!aspect) {
      return false;
    }

    aspect.points = newPoints;

    // Recalculate aspect_sum
    question.rubric_data.aspect_sum = question.rubric_data.aspects.reduce(
      (sum, a) => sum + a.points,
      0
    );

    // Write back with same formatting
    const yamlContent = yamlDump(config, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      quotingType: "'",
    });
    await fs.writeFile(configPath, yamlContent, 'utf-8');

    return true;
  } catch {
    return false;
  }
}

export async function rubricEdit(args: RubricEditInput): Promise<RubricEditOutput> {
  const {
    rubric_path,
    exam_config_path,
    question_id,
    updates,
    reason,
    q_file_path,
    sync_config = true,  // Default to syncing
  } = args;

  // Validate required fields
  if (!rubric_path) {
    throw new Error('rubric_path is required');
  }
  if (!question_id) {
    throw new Error('question_id is required');
  }
  if (!updates || !updates.aspect_name) {
    throw new Error('updates.aspect_name is required');
  }
  if (!reason || reason.trim().length === 0) {
    throw new Error('reason is required for audit trail');
  }
  if (updates.new_max_points === undefined && updates.new_criteria === undefined) {
    throw new Error('At least one of new_max_points or new_criteria must be provided');
  }

  // Security: Validate all paths before any file operations
  validatePathOrThrow(rubric_path);
  if (exam_config_path) {
    validatePathOrThrow(exam_config_path);
  }
  if (q_file_path) {
    validatePathOrThrow(q_file_path);
  }

  const rubricWriter = new RubricWriter();
  const rubricParser = new RubricParser();
  const studentReader = new StudentReader();

  // Check if rubric file is writable
  if (!(await rubricWriter.canWrite(rubric_path))) {
    throw new Error(`Cannot write to rubric file: ${rubric_path}`);
  }

  // Verify question exists in rubric
  const rubric = await rubricParser.parseQuestionByRubricId(rubric_path, question_id);
  if (!rubric) {
    throw new Error(`Question '${question_id}' not found in rubric file: ${rubric_path}`);
  }

  // Perform the update
  const result = await rubricWriter.updateAspect(
    rubric_path,
    question_id,
    updates.aspect_name,
    {
      newMaxPoints: updates.new_max_points,
      newCriteria: updates.new_criteria,
    },
    reason
  );

  // Get affected students if Q-file provided
  let alreadyAssessed: string[] = [];
  let remaining: string[] = [];

  if (q_file_path) {
    try {
      const students = await studentReader.parseStudents(q_file_path);
      alreadyAssessed = students.filter(s => s.assessed).map(s => s.id);
      remaining = students.filter(s => !s.assessed).map(s => s.id);
    } catch (error) {
      // Q-file parsing failed - continue without student info
      console.error('Could not parse Q-file for student info:', error);
    }
  }

  // Build warning message
  let warning: string | null = null;
  if (alreadyAssessed.length > 0) {
    const pointsInfo = updates.new_max_points !== undefined
      ? ` (max ${result.previousMaxPoints}p → ${result.newMaxPoints}p)`
      : '';
    warning = `${alreadyAssessed.length} elever bedömda med gamla kriterier${pointsInfo}. ` +
      `Överväg att ombedöma för konsistens.`;
  }

  // Sync exam_config.yaml if requested and points changed
  let configSynced = false;
  if (sync_config && exam_config_path && updates.new_max_points !== undefined) {
    configSynced = await syncExamConfig(
      exam_config_path,
      question_id,
      updates.aspect_name,
      updates.new_max_points
    );
  }

  // Log to workflow_log.jsonl
  const projectPath = await deriveProjectPath(rubric_path);
  if (projectPath) {
    await safeStateOperation(async () => {
      await logWorkflowAction(
        projectPath,
        '4b',
        'phase4b_rubric_edit',
        'rubric_aspect_update',
        {
          rubric_path,
          question_id,
          aspect_name: updates.aspect_name,
        },
        {
          success: true,
          previous_points: result.previousMaxPoints,
          new_points: result.newMaxPoints,
          config_synced: configSynced,
          affected_students: alreadyAssessed.length,
        }
      );
    }, 'phase4b_rubric_edit logging');
  }

  return {
    success: true,
    rubric_path,
    question_id,
    updated_aspect: updates.aspect_name,
    previous: {
      max_points: result.previousMaxPoints,
      criteria: result.previousCriteria,
    },
    new: {
      max_points: result.newMaxPoints,
      criteria: result.newCriteria,
    },
    affected_students: {
      already_assessed: alreadyAssessed,
      remaining,
    },
    warning,
    changelog_entry: result.changelogEntry,
    config_synced: configSynced,
  };
}
