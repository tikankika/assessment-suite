import { promises as fs } from 'fs';
import { join } from 'path';
import { load, dump } from 'js-yaml';
import { ExamConfig, QuestionConfig } from '../shared/exam_config_reader.js';
import { methodologyLoader } from '../core/methodology_loader.js';
import type { QuestionWithRubric } from '../types/exam.js';
import {
  deriveProjectPath,
  markPhaseInProgress,
  markPhaseComplete,
  markPhaseIncomplete,
  logWorkflowAction,
  safeStateOperation,
} from '../shared/project_state_manager.js';
import { FOLDERS } from '../shared/folder_constants.js';

/**
 * Phase 4B: Rubric Validation Tool
 *
 * Two-phase workflow (like Phase 4A):
 * 1. LOAD mode: Returns rubric_content + exam_questions + methodology
 * 2. SAVE mode: Updates exam_config.yaml with validated rubric data
 *
 * Claude uses AI understanding (not RubricParser directly) to:
 * - Match questions against rubric sections
 * - Extract aspect breakdowns
 * - Auto-resolve conflicts when rubric confirms values
 * - Flag missing rubric IDs
 *
 * @see docs/implementation/phase4b-claude-code-instructions.md
 */

// ============================================================================
// Input/Output Types
// ============================================================================

export interface Phase4bInput {
  project_path: string;
  mode: 'single' | 'preview' | 'batch';
  // Single mode: which question to validate (0-indexed)
  question_index?: number;
  // SAVE mode parameters
  save_results?: boolean;
  validated_questions?: QuestionWithRubric[];
}

export interface Phase4bLoadOutput {
  mode: 'load';
  rubric_content: string;
  exam_questions: QuestionConfig[];
  methodology: string;
  analysis_mode: 'single' | 'preview' | 'batch';
  instructions: string;
  // Single mode state tracking
  current_question_index: number;
  current_question_id: string | null;
  total_questions: number;
  next_question_index: number;
  single_mode_hint: string;
}

export interface Phase4bSaveOutput {
  mode: 'save';
  success: boolean;
  file_updated: string;
  summary: {
    total_questions: number;
    verified: number;
    conflicts_auto_resolved: number;
    teacher_action_required: number;
  };
}

export type Phase4bOutput = Phase4bLoadOutput | Phase4bSaveOutput;

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Phase 4B Rubric Validation Tool
 *
 * TWO-PHASE WORKFLOW:
 * 1. LOAD mode: Returns rubric + questions + methodology → Claude analyzes with AI
 * 2. SAVE mode: Updates exam_config.yaml with validated data
 */
export async function phase4bRubricValidation(
  input: Phase4bInput
): Promise<Phase4bOutput> {
  // SAVE MODE: Update exam_config.yaml
  if (input.save_results) {
    return await saveResults(input);
  }

  // LOAD MODE: Return rubric + questions + methodology
  return await loadRubricAndQuestions(input);
}

// ============================================================================
// LOAD Mode Implementation
// ============================================================================

async function loadRubricAndQuestions(
  input: Phase4bInput
): Promise<Phase4bLoadOutput> {
  const { project_path, mode } = input;

  // 1. Load rubric file (try multiple locations)
  let rubricContent: string | undefined;
  const rubricPaths = [
    join(project_path, FOLDERS.PHASE2_MARKDOWN, 'rubric.md'),
    join(project_path, FOLDERS.PHASE1_ORIGINAL, 'rubric.md'),
  ];

  for (const rubricPath of rubricPaths) {
    try {
      rubricContent = await fs.readFile(rubricPath, 'utf-8');
      break;
    } catch {
      continue;
    }
  }

  if (!rubricContent) {
    throw new Error(
      `Rubric file not found. Tried: ${rubricPaths.join(', ')}`
    );
  }

  // 2. Load questions from Phase 4A (exam_config.yaml)
  const examConfigPath = join(project_path, 'exam_config.yaml');
  const examConfigContent = await fs.readFile(examConfigPath, 'utf-8');
  const examConfig = load(examConfigContent) as Partial<ExamConfig>;
  const examQuestions = examConfig.questions || [];

  // 3. Load methodology instructions
  const methodology = await methodologyLoader.loadPhase4B();

  // 4. Build instructions based on mode
  let instructions = `MODE: ${mode}\n\n`;

  // Single mode state tracking
  const totalQuestions = examQuestions.length;
  const currentIndex = input.question_index ?? 0;
  const currentQuestion = examQuestions[currentIndex] || null;
  const currentQuestionId = currentQuestion?.id || null;
  const nextIndex = currentIndex + 1;
  let singleModeHint = '';

  if (mode === 'single') {
    if (currentIndex >= totalQuestions) {
      instructions += `All ${totalQuestions} questions validated!\n`;
      instructions += `Call with save_results: true to save, or mode: 'batch' to review all.`;
      singleModeHint = 'All questions validated. Ready to save.';
    } else {
      instructions += `Validate question ${currentIndex + 1}/${totalQuestions}: ${currentQuestionId}\n`;
      instructions += `Find rubric section for this question.\n`;
      instructions += `Extract aspect breakdown.\n`;
      instructions += `Present to teacher for verification.\n`;
      instructions += `Wait for "Yes" before continuing.`;
      singleModeHint = `SINGLE MODE: Validating ${currentQuestionId} (${currentIndex + 1}/${totalQuestions}). ` +
        `After teacher confirms, call again with question_index: ${nextIndex} for next question.`;
    }
  } else if (mode === 'preview') {
    instructions += `Validate FIRST rubric section only.\n`;
    instructions += `Find first question with rubric_id.\n`;
    instructions += `Extract aspect breakdown.\n`;
    instructions += `Present to teacher for verification.\n`;
    instructions += `Wait for "Yes" before continuing.`;
  } else {
    instructions += `Validate ALL rubric sections.\n`;
    instructions += `Extract aspect breakdowns for each question.\n`;
    instructions += `Auto-resolve conflicts when rubric confirms value.\n`;
    instructions += `Flag missing rubric IDs.\n`;
    instructions += `Present summary for teacher approval.`;
  }

  instructions += '\n\nRead the methodology carefully.\n';
  instructions += 'Use AI understanding to match questions to rubric sections.\n';
  instructions += 'Extract aspects with natural language processing.\n';
  instructions += 'Auto-resolve conflicts if rubric confirms a value.';

  return {
    mode: 'load',
    rubric_content: rubricContent,
    exam_questions: examQuestions,
    methodology: methodology,
    analysis_mode: mode,
    instructions: instructions,
    current_question_index: currentIndex,
    current_question_id: currentQuestionId,
    total_questions: totalQuestions,
    next_question_index: nextIndex,
    single_mode_hint: singleModeHint,
  };
}

// ============================================================================
// SAVE Mode Implementation
// ============================================================================

async function saveResults(input: Phase4bInput): Promise<Phase4bSaveOutput> {
  const { project_path, validated_questions } = input;
  const startTime = performance.now();

  if (!validated_questions || validated_questions.length === 0) {
    throw new Error('SAVE mode requires validated_questions array');
  }

  // Derive project root for state tracking
  const stateProjectPath = await deriveProjectPath(project_path);

  // Mark phase as in_progress
  if (stateProjectPath) {
    await safeStateOperation(
      () => markPhaseInProgress(stateProjectPath, 4, '4b_rubric'),
      'phase4b markPhaseInProgress'
    );
  }

  try {
    // Load existing exam_config.yaml
    const examConfigPath = join(project_path, 'exam_config.yaml');
    const existingContent = await fs.readFile(examConfigPath, 'utf-8');
    const existingData = load(existingContent) as Partial<ExamConfig>;

    // Calculate summary statistics
    let verified = 0;
    let conflicts_resolved = 0;
    let action_required = 0;

    for (const q of validated_questions) {
      if (q.rubric_verified) verified++;
      if (q.conflict_resolution?.auto_resolved) conflicts_resolved++;
      if (q.teacher_action_required) action_required++;
    }

    // Update with validated rubric data
    // Merge with existing questions to preserve fields the agent may not send
    const existingQuestions = existingData.questions || [];
    const existingById = new Map(existingQuestions.map((q) => [q.id, q]));

    const enriched = {
      ...existingData,
      questions: validated_questions.map(q => {
        // Start with existing question data, then overlay agent input
        const existing = existingById.get(q.id) || ({} as Partial<QuestionConfig>);
        const enrichedQ: Record<string, unknown> = {
          ...existing,
          id: q.id,
          number: q.number ?? existing.number,
          rubric_id: q.rubric_id ?? existing.rubric_id,
          raw_header: q.raw_header ?? existing.raw_header,
          question_title: q.question_title ?? existing.question_title,
          points: q.points ?? existing.points,
          question_type: q.question_type ?? existing.question_type,
          rubric_verified: q.rubric_verified,
        };

        // ADR-003 P1: Add section_title at top level for RubricParser
        if (q.rubric_data?.section_title) {
          enrichedQ.section_title = q.rubric_data.section_title;
        }

        // Add rubric data if verified
        if (q.rubric_data) {
          enrichedQ.rubric_data = q.rubric_data;
        }

        // Add conflict resolution if present
        if (q.conflict_resolution) {
          enrichedQ.conflict_resolution = q.conflict_resolution;
        }

        // Add teacher action flags
        if (q.teacher_action_required) {
          enrichedQ.teacher_action_required = q.teacher_action_required;
          if (q.teacher_note) {
            enrichedQ.teacher_note = q.teacher_note;
          }
        }

        return enrichedQ;
      }),
      rubric_validation: {
        validated_at: new Date().toISOString(),
        total_questions: validated_questions.length,
        verified: verified,
        conflicts_auto_resolved: conflicts_resolved,
        teacher_action_required: action_required,
      },
    };

    // Overwrite existing exam_config.yaml (no copies!)
    await fs.writeFile(
      examConfigPath,
      dump(enriched, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
      }),
      'utf-8'
    );

    const durationSeconds = (performance.now() - startTime) / 1000;

    // Update project state on success
    if (stateProjectPath) {
      await safeStateOperation(
        () => markPhaseComplete(stateProjectPath, 4, '4b_rubric', {
          questions_validated: validated_questions.length,
          verified,
          conflicts_auto_resolved: conflicts_resolved,
          teacher_action_required: action_required,
        }),
        'phase4b markPhaseComplete'
      );

      // Log workflow action
      await safeStateOperation(
        () => logWorkflowAction(
          stateProjectPath,
          '4b',
          'phase4b_rubric',
          'rubric_validation_save',
          {
            project_path,
            questions_count: validated_questions.length,
          },
          {
            file_updated: examConfigPath,
            verified,
            conflicts_auto_resolved: conflicts_resolved,
            teacher_action_required: action_required,
            success: true,
          },
          durationSeconds
        ),
        'phase4b logWorkflowAction'
      );
    }

    return {
      mode: 'save',
      success: true,
      file_updated: examConfigPath,
      summary: {
        total_questions: validated_questions.length,
        verified: verified,
        conflicts_auto_resolved: conflicts_resolved,
        teacher_action_required: action_required,
      },
    };
  } catch (error) {
    // Mark phase as incomplete on error
    if (stateProjectPath) {
      await safeStateOperation(
        () => markPhaseIncomplete(stateProjectPath, 4, '4b_rubric', error as Error),
        'phase4b markPhaseIncomplete'
      );
    }
    throw error;
  }
}
