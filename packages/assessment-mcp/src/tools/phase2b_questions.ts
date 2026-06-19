import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { validatePathOrThrow } from '../core/path_validator.js';
import { methodologyLoader } from '../core/methodology_loader.js';
import { generateExamConfig, saveExamConfig } from '../shared/yaml_generator.js';
import { Question } from '../types/exam.js';
import { dump } from 'js-yaml';
import {
  deriveProjectPath,
  markPhaseInProgress,
  markPhaseComplete,
  markPhaseIncomplete,
  logWorkflowAction,
  updateSources,
  safeStateOperation,
} from '../shared/project_state_manager.js';
import { FOLDERS } from '../shared/folder_constants.js';

/**
 * Phase 2B: Question Detection Tool (ADR-006: renumbered from Phase 4A)
 *
 * Methodology-based approach (NOT regex parsing):
 * - LOAD mode: Returns exam content + methodology instructions
 * - SAVE mode: Writes verified questions to files
 *
 * Claude uses AI understanding to analyze questions.
 * Teacher verifies each finding.
 *
 * @see docs/implementation/phase2b-tool-specification.md
 */

// ============================================================================
// Input/Output Types
// ============================================================================

export interface Phase2bInput {
  exam_path: string;
  mode: 'single' | 'pattern' | 'batch';
  question_number?: number;
  // SAVE mode parameters
  save_results?: boolean;
  project_path?: string;
  questions?: Question[];
  detected_pattern?: DetectedPattern;
  // Exam metadata (optional, avoids UNKNOWN defaults)
  course_code?: string;
  exam_name?: string;
  exam_date?: string;
}

export interface DetectedPattern {
  description: string;
  regex?: string;
  confidence: 'high' | 'medium' | 'low';
}

// LOAD mode output
export interface Phase2bLoadOutput {
  mode: 'load';
  exam_content: string;
  methodology: string;
  analysis_mode: 'single' | 'pattern' | 'batch';
  instructions: string;
  // Single mode state tracking
  current_question: number;
  next_question: number;
  single_mode_hint: string;
}

// SAVE mode output
export interface Phase2bSaveOutput {
  mode: 'save';
  success: boolean;
  files_created: string[];
  summary: {
    total_questions: number;
    annotated_file: string;
    config_file: string;
    pattern_file?: string;
  };
}

export type Phase2bOutput = Phase2bLoadOutput | Phase2bSaveOutput;

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Phase 4A Question Detection Tool
 *
 * TWO-PHASE WORKFLOW:
 * 1. LOAD mode: Returns exam_content + methodology → Claude analyzes with AI
 * 2. SAVE mode: Writes verified questions to files
 *
 * PREREQUISITE: Phase 2 (PDF→Markdown) must be complete
 */
export async function phase2bQuestionDetection(
  input: Phase2bInput
): Promise<Phase2bOutput> {
  // Security: validate user-provided paths
  validatePathOrThrow(input.exam_path);
  if (input.project_path) validatePathOrThrow(input.project_path);

  // PREREQUISITE CHECK: Phase 2 must be complete
  await verifyPhase2Complete(input.exam_path, input.project_path);

  // SAVE MODE: Write files after verification
  if (input.save_results) {
    return await saveResults(input);
  }

  // LOAD MODE: Return exam content + methodology
  return await loadExamAndMethodology(input);
}

/**
 * Verify Phase 2 (PDF→Markdown) is complete before allowing Phase 4A
 *
 * Checks:
 * 1. 02_markdown folder exists
 * 2. Contains at least one .md file (exam or student answers)
 *
 * @throws Error if Phase 2 not complete
 */
async function verifyPhase2Complete(
  exam_path: string,
  project_path?: string
): Promise<void> {
  // Derive project root from exam_path or use provided project_path
  let projectRoot: string;

  if (project_path) {
    projectRoot = project_path;
  } else {
    // exam_path is usually in 02_markdown/ - go up to project root
    const examDir = dirname(exam_path);
    if (examDir.endsWith(FOLDERS.PHASE2_MARKDOWN)) {
      projectRoot = dirname(examDir);
    } else if (examDir.endsWith(FOLDERS.PHASE1_ORIGINAL)) {
      projectRoot = dirname(examDir);
    } else {
      // Assume exam_path is directly in project root
      projectRoot = examDir;
    }
  }

  const markdownDir = join(projectRoot, FOLDERS.PHASE2_MARKDOWN);

  // Check if 02_markdown folder exists
  try {
    const stats = await fs.stat(markdownDir);
    if (!stats.isDirectory()) {
      throw new Error(
        `🚫 PHASE 2 REQUIRED FIRST!\n\n` +
        `${FOLDERS.PHASE2_MARKDOWN}/ exists but is not a directory.\n\n` +
        `Run convert_documents (Phase 2A) before phase2b_questions:\n` +
        `  input_dir: ${join(projectRoot, FOLDERS.PHASE1_ORIGINAL)}\n` +
        `  output_dir: ${markdownDir}`
      );
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `🚫 PHASE 2 REQUIRED FIRST!\n\n` +
        `${FOLDERS.PHASE2_MARKDOWN}/ folder does not exist.\n` +
        `PDF files have not been converted to markdown.\n\n` +
        `Run convert_documents (Phase 2A) before phase2b_questions:\n` +
        `  input_dir: ${join(projectRoot, FOLDERS.PHASE1_ORIGINAL)}\n` +
        `  output_dir: ${markdownDir}`
      );
    }
    throw error;
  }

  // Check if folder contains any .md files
  const files = await fs.readdir(markdownDir);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  if (mdFiles.length === 0) {
    throw new Error(
      `🚫 PHASE 2 REQUIRED FIRST!\n\n` +
      `${FOLDERS.PHASE2_MARKDOWN}/ folder exists but is empty.\n` +
      `No markdown files found - PDF conversion not complete.\n\n` +
      `Run convert_documents (Phase 2A) before phase2b_questions:\n` +
      `  input_dir: ${join(projectRoot, FOLDERS.PHASE1_ORIGINAL)}\n` +
      `  output_dir: ${markdownDir}`
    );
  }

  // Phase 2 is complete - continue
}

// ============================================================================
// LOAD Mode Implementation
// ============================================================================

async function loadExamAndMethodology(
  input: Phase2bInput
): Promise<Phase2bLoadOutput> {

  // 1. Read exam file
  const examContent = await fs.readFile(input.exam_path, 'utf-8');

  // 2. Load methodology (instructions for Claude)
  const methodology = await methodologyLoader.loadPhase2B();

  // 3. Build instructions based on mode
  let instructions = `MODE: ${input.mode}\n\n`;

  switch (input.mode) {
    case 'single':
      instructions += `Find question #${input.question_number || 1}.\n`;
      instructions += 'Present to teacher for verification.\n';
      instructions += 'Wait for "Yes" before continuing.';
      break;
    case 'pattern':
      instructions += 'Analyze verified questions for common pattern.\n';
      instructions += 'Report pattern to teacher.\n';
      instructions += 'Ask permission to batch process.';
      break;
    case 'batch':
      instructions += 'Process all remaining questions.\n';
      instructions += 'Flag issues (conflicts, missing IDs).\n';
      instructions += 'Present summary for teacher approval.';
      break;
  }

  instructions += '\n\nRead the methodology carefully.\n';
  instructions += 'Use AI understanding to identify questions.\n';
  instructions += 'Skip Table of Contents (Page 1-2).\n';
  instructions += 'Find real questions on Page 7+.';

  // Single mode state tracking
  const currentQuestion = input.question_number || 1;
  const nextQuestion = currentQuestion + 1;
  let singleModeHint = '';

  if (input.mode === 'single') {
    singleModeHint = `SINGLE MODE: Analyzing question ${currentQuestion}. ` +
      `After teacher confirms, call again with question_number: ${nextQuestion} for next question. ` +
      `Use ID format Q00${currentQuestion} (e.g., Q001, Q002, Q003...). ` +
      `When all questions found, switch to mode: 'batch' or save_results: true.`;
  }

  return {
    mode: 'load',
    exam_content: examContent,
    methodology: methodology,
    analysis_mode: input.mode,
    instructions: instructions,
    current_question: currentQuestion,
    next_question: nextQuestion,
    single_mode_hint: singleModeHint,
  };
}

// ============================================================================
// SAVE Mode Implementation
// ============================================================================

async function saveResults(input: Phase2bInput): Promise<Phase2bSaveOutput> {
  const { questions, detected_pattern, project_path, exam_path, course_code, exam_name, exam_date } = input;
  const startTime = performance.now();

  if (!questions || questions.length === 0) {
    throw new Error('SAVE mode requires questions array');
  }

  if (!project_path) {
    throw new Error('SAVE mode requires project_path');
  }

  // Derive project root for state tracking
  const stateProjectPath = await deriveProjectPath(project_path);

  // Mark phase as in_progress
  if (stateProjectPath) {
    await safeStateOperation(
      () => markPhaseInProgress(stateProjectPath, 2, '2b_questions'),
      'phase2b markPhaseInProgress'
    );
  }

  const filesCreated: string[] = [];

  try {
    // Ensure questions have warnings array (required by Question type)
    const typedQuestions: Question[] = questions.map(q => ({
      ...q,
      warnings: q.warnings || [],
    }));

    // 1. Write exam_config.yaml (uses existing yaml_generator)
    const examConfig = generateExamConfig(typedQuestions, project_path, {
      course_code,
      exam_name,
      exam_date,
    });
    const configPath = join(project_path, 'exam_config.yaml');
    await saveExamConfig(configPath, examConfig);
    filesCreated.push(configPath);

    // 1b. Update CLAUDE.md with exam_config data (RFC-040)
    const claudeMdPath = join(project_path, 'CLAUDE.md');
    try {
      let claudeContent = await fs.readFile(claudeMdPath, 'utf-8');
      const questionIds = typedQuestions.map(q => q.id || `Q${String(q.number).padStart(3, '0')}`);
      const qList = questionIds.join(', ');
      // Replace specific placeholder patterns
      claudeContent = claudeContent.replace('- Course: UPDATE_ME', `- Course: ${examConfig.exam.course_code}`);
      claudeContent = claudeContent.replace('UPDATE_ME questions (UPDATE_ME)', `${typedQuestions.length} questions (${qList})`);
      await fs.writeFile(claudeMdPath, claudeContent, 'utf-8');
      console.error('[phase2b] Updated CLAUDE.md with exam config data');
    } catch {
      // CLAUDE.md doesn't exist yet — that's fine
    }

    // 2. Write annotated markdown (YAML front matter per question)
    const annotatedPath = await writeAnnotatedMarkdown({
      questions: typedQuestions,
      original_exam_path: exam_path,
      output_path: join(project_path, FOLDERS.PHASE2_MARKDOWN, 'exam_questions_annotated.md'),
    });
    filesCreated.push(annotatedPath);

    // 3. Write pattern file (for reuse) - optional
    let patternPath: string | undefined;
    if (detected_pattern) {
      patternPath = await writePatternFile({
        detected_pattern,
        exam_info: examConfig.exam,
        output_path: join(
          project_path,
          'patterns',
          generatePatternFilename(examConfig.exam)
        ),
      });
      filesCreated.push(patternPath);
    }

    const durationSeconds = (performance.now() - startTime) / 1000;

    // Update project state on success
    if (stateProjectPath) {
      await safeStateOperation(
        () => markPhaseComplete(stateProjectPath, 2, '2b_questions', {
          questions_detected: typedQuestions.length,
          files_created: filesCreated.length,
        }),
        'phase2b markPhaseComplete'
      );

      // Update sources.yaml with new files
      await safeStateOperation(
        () => updateSources(stateProjectPath, 'exam_config', {
          type: 'yaml',
          copied_to: 'exam_config.yaml',
          note: 'Question detection results - Phase 2B',
        }),
        'phase2b updateSources exam_config'
      );

      await safeStateOperation(
        () => updateSources(stateProjectPath, 'exam_questions_annotated', {
          type: 'markdown',
          copied_to: `${FOLDERS.PHASE2_MARKDOWN}/exam_questions_annotated.md`,
          note: 'Annotated exam questions - Phase 2B',
        }),
        'phase2b updateSources annotated'
      );

      // Log workflow action
      await safeStateOperation(
        () => logWorkflowAction(
          stateProjectPath,
          '2b',
          'phase2b_questions',
          'question_detection_save',
          {
            exam_path,
            questions_count: typedQuestions.length,
            has_pattern: !!detected_pattern,
          },
          {
            files_created: filesCreated,
            success: true,
          },
          durationSeconds
        ),
        'phase2b logWorkflowAction'
      );
    }

    return {
      mode: 'save',
      success: true,
      files_created: filesCreated,
      summary: {
        total_questions: typedQuestions.length,
        annotated_file: annotatedPath,
        config_file: configPath,
        pattern_file: patternPath,
      },
    };
  } catch (error) {
    // Mark phase as incomplete on error
    if (stateProjectPath) {
      await safeStateOperation(
        () => markPhaseIncomplete(stateProjectPath, 2, '2b_questions', error as Error),
        'phase2b markPhaseIncomplete'
      );
    }
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Write annotated markdown with YAML front matter per question
 */
async function writeAnnotatedMarkdown(options: {
  questions: Question[];
  original_exam_path: string;
  output_path: string;
}): Promise<string> {
  const { questions, original_exam_path, output_path } = options;

  let content = '# Annotated Exam Questions\n\n';
  content += `<!-- Generated by phase2b_question_detection -->\n`;
  content += `<!-- Source: ${original_exam_path} -->\n`;
  content += `<!-- Generated: ${new Date().toISOString()} -->\n\n`;

  for (const question of questions) {
    content += `---\n`;
    content += `id: ${question.id}\n`;
    content += `rubric_id: ${question.rubric_id ?? 'null'}\n`;
    content += `points: ${question.points || question.max_marks}\n`;
    content += `title: ${question.question_title}\n`;
    content += `type: ${question.question_type}\n`;
    content += `---\n\n`;
    content += `## ${question.raw_header}\n\n`;
    content += `${question.question_text}\n\n`;
    content += `Maximum marks: ${question.max_marks}\n\n`;
    content += `---\n\n`;
  }

  // Ensure directory exists
  await fs.mkdir(dirname(output_path), { recursive: true });
  await fs.writeFile(output_path, content, 'utf-8');

  return output_path;
}

/**
 * Write pattern file for reuse in future exams
 */
async function writePatternFile(options: {
  detected_pattern: DetectedPattern;
  exam_info: { course_code: string; exam_name: string; date: string };
  output_path: string;
}): Promise<string> {
  const { detected_pattern, exam_info, output_path } = options;

  const patternData = {
    exam_pattern: {
      course_code: exam_info.course_code,
      exam_name: exam_info.exam_name,
      date: exam_info.date,
    },
    pattern: {
      description: detected_pattern.description,
      regex: detected_pattern.regex || null,
      confidence: detected_pattern.confidence,
    },
    validation: [
      'Rubric IDs follow format: Letter + Number (E3, E4, C1, A3)',
      'Points typically 5p for text area, 10-15p for essays',
      'All questions on Page 7+',
      'max_marks is authoritative for point conflicts',
    ],
  };

  const yamlContent = dump(patternData, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });

  // Ensure directory exists
  await fs.mkdir(dirname(output_path), { recursive: true });
  await fs.writeFile(output_path, yamlContent, 'utf-8');

  return output_path;
}

/**
 * Generate pattern filename from exam info
 */
function generatePatternFilename(exam_info: {
  course_code: string;
  date: string;
}): string {
  const code = exam_info.course_code.toLowerCase();
  const date = exam_info.date.replace(/-/g, '');
  return `${code}_${date}.yaml`;
}
