import { promises as fs } from 'fs';
import * as path from 'path';
import { load as yamlLoad } from 'js-yaml';
import { RubricParser } from '../shared/rubric_parser.js';
import { ExamConfigReader } from '../shared/exam_config_reader.js';
import {
  updatePhase6Session,
  logWorkflowAction,
  safeStateOperation,
  SourcesYaml,
} from '../shared/project_state_manager.js';
import { FOLDERS } from '../shared/folder_constants.js';

/**
 * phase6_rubric - Load rubric section for current question
 *
 * ADR-003: Progressive loading - rubric loaded separately after methodology.
 * This creates a natural checkpoint where teacher must confirm before proceeding.
 *
 * @param args.project_path - Path to project folder
 * @param args.question_id - Question ID (e.g., "Q1", "Q001")
 * @param args.rubric_path - Optional: explicit path to rubric file
 * @returns Rubric section content with next_action
 *
 * @see docs/decisions/ADR-003-progressive-methodology-loading.md
 */

export interface Phase6RubricParams {
  project_path: string;
  question_id: string;
  rubric_path?: string;
}

export interface Phase6RubricResult {
  rubric_section: string;
  question_info: {
    id: string;
    title: string;
    max_points: number;
  };
  next_action: string;
}

export async function phase6Rubric(
  args: Phase6RubricParams
): Promise<Phase6RubricResult> {
  const { project_path, question_id, rubric_path: explicitRubricPath } = args;

  console.error('[phase6_rubric] START ========================');
  console.error('[phase6_rubric] project_path:', project_path);
  console.error('[phase6_rubric] question_id:', question_id);

  const rubricParser = new RubricParser();
  const examConfigReader = new ExamConfigReader();

  // 1. Find rubric path from sources.yaml or use explicit path
  let rubricPath = explicitRubricPath || '';

  if (!rubricPath) {
    try {
      const sourcesPath = path.join(project_path, 'sources.yaml');
      const sourcesContent = await fs.readFile(sourcesPath, 'utf-8');
      const sources = yamlLoad(sourcesContent) as Partial<SourcesYaml>;
      if (sources?.sources?.rubric?.copied_to) {
        rubricPath = path.join(project_path, sources.sources.rubric.copied_to);
      }
    } catch (error) {
      console.error('[phase6_rubric] sources.yaml not found, trying default');
    }
  }

  // Fallback to default rubric location
  if (!rubricPath) {
    rubricPath = path.join(project_path, FOLDERS.PHASE2_MARKDOWN, 'rubric.md');
  }

  console.error('[phase6_rubric] rubricPath:', rubricPath);

  // 2. Load exam_config.yaml to get question info
  let questionTitle = `Question ${question_id}`;
  let maxPoints = 0;
  let rubricSection = '';

  const configPath = path.join(project_path, 'exam_config.yaml');
  try {
    const examConfig = await examConfigReader.load(configPath);
    const questionConfig = examConfigReader.getQuestionById(examConfig, question_id);

    if (questionConfig) {
      questionTitle = questionConfig.question_title || questionTitle;
      maxPoints = questionConfig.points || 0;
      console.error('[phase6_rubric] Question found:', questionTitle, maxPoints, 'p');

      // 3. Extract rubric section using config
      rubricSection = await rubricParser.extractFullSection(rubricPath, questionConfig);
      console.error('[phase6_rubric] Rubric section extracted, length:', rubricSection.length);
    } else {
      console.error('[phase6_rubric] Question not found in exam_config, trying fallback');
      // Fallback: try to parse question number from ID
      const qNumMatch = question_id.match(/Q?0*(\d+)/i);
      if (qNumMatch) {
        const qNum = parseInt(qNumMatch[1], 10);
        rubricSection = await rubricParser.getRubricSection(rubricPath, qNum);
      }
    }
  } catch (error) {
    console.error('[phase6_rubric] Error loading config:', error);
    // Fallback: try to parse question number from ID
    const qNumMatch = question_id.match(/Q?0*(\d+)/i);
    if (qNumMatch) {
      const qNum = parseInt(qNumMatch[1], 10);
      rubricSection = await rubricParser.getRubricSection(rubricPath, qNum);
    }
  }

  if (!rubricSection) {
    throw new Error(`Could not extract rubric section for question ${question_id}`);
  }

  console.error('[phase6_rubric] END ==========================');

  // ADR-005: Mark rubric as displayed in session state
  await safeStateOperation(
    () => updatePhase6Session(project_path, { rubric_displayed: true }),
    'phase6_rubric: mark rubric_displayed (ADR-005)'
  );

  // RFC-027: Log rubric display for research timeline
  await safeStateOperation(
    () => logWorkflowAction(
      project_path,
      6,
      'phase6_rubric',
      'rubric_display',
      {
        question_id,
      },
      {
        rubric_length: rubricSection.length,
        max_points: maxPoints,
      }
    ),
    'phase6_rubric logWorkflowAction'
  );

  return {
    rubric_section: rubricSection,
    question_info: {
      id: question_id,
      title: questionTitle,
      max_points: maxPoints,
    },
    next_action: `VIKTIGT: VISA HELA rubric_section OVAN för läraren - INTE en sammanfattning! Fråga sedan: "Redo att börja bedöma ${questionTitle}?" Vänta på svar innan du anropar phase6_assess_student.`,
  };
}
