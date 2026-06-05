import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { load, dump } from 'js-yaml';
import { ExamConfig } from '../shared/exam_config_reader.js';
import { validatePathOrThrow } from '../core/path_validator.js';
import { MethodologyLoader } from '../core/methodology_loader.js';
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
 * Phase 2C: Answer Boundary Detection (ADR-006: renumbered from Phase 4D)
 *
 * Detects per-QUESTION boundary markers that work across ALL students.
 * Key insight: Markers are SAME for all students per question.
 *
 * TWO-PHASE WORKFLOW:
 * 1. LOAD mode: Returns student files + exam_config + methodology
 * 2. SAVE mode: Writes answer_boundaries section to exam_config.yaml
 *
 * @see methodology/phase2c_answer_boundaries.md
 */

// ============================================================================
// Input/Output Types
// ============================================================================

export interface Phase2cInput {
  project_path: string;
  mode: 'load' | 'preview' | 'batch' | 'save';
  // SAVE mode parameters
  answer_boundaries?: AnswerBoundariesConfig;
}

export interface QuestionBoundary {
  question_id: string;
  question_header: string; // e.g., "1 Restriktionsenzym (a-d)" - exact text to locate question (skip TOC)

  // Answer START detection
  answer_start_type: 'sub_question' | 'after_text';
  // sub_question: answer starts AT the marker (e.g., "a)")
  // after_text: answer starts AFTER the marker (last line of question text)
  answer_start_marker: string;

  // Sub-questions text (REQUIRED for answer_start_type: 'sub_question')
  // Maps label -> full question text (for separating question from answer)
  // e.g., { "a": "Vad är ett restriktionsenzym?", "b": "Förklara/beskriv var..." }
  sub_questions?: Record<string, string>;

  // Sub-question END (only for questions with sub-questions)
  sub_question_end_marker?: string; // e.g., "Ord:" - marks end of each sub-answer

  // Answer END detection
  answer_end_type: 'marker' | 'next_question';
  // marker: use answer_end_marker
  // next_question: ends at next question's header
  answer_end_marker?: string; // e.g., "Besvarad." - marks end of entire question

  // Verification
  consistent_across_students: boolean;
  verified_students: number;
  sample_extraction?: {
    student: string;
    word_count: number;
  };

  // Special cases
  auto_graded?: boolean;
  skip_boundary_detection?: boolean;
  has_text_answer?: boolean;
  reason?: string;

  // Legacy fields (for backwards compatibility)
  start_marker?: string;
  end_marker?: string;
}

export interface AnswerBoundariesConfig {
  global: {
    language: 'swedish' | 'english';
    default_sub_question_end?: string; // e.g., "Ord:" if same for all
    default_answer_end?: string; // e.g., "Besvarad." if same for all
    // Legacy fields
    start_marker?: string;
    end_marker_pattern?: string;
  };
  questions: Record<string, QuestionBoundary>;
}

// LOAD mode output
export interface Phase2cLoadOutput {
  mode: 'load';
  student_files: string[];
  first_student: {
    filename: string;
    content: string;
  };
  exam_config: {
    exam_name: string;
    questions: Array<{
      id: string;
      number: number;
      rubric_id: string | null;
      question_type: string;
      auto_graded: boolean;
    }>;
  };
  methodology: string;
  instructions: string;
}

// SAVE mode output
export interface Phase2cSaveOutput {
  mode: 'save';
  success: boolean;
  config_path: string;
  summary: {
    questions_with_boundaries: number;
    auto_graded_skipped: number;
    language: string;
  };
}

export type Phase2cOutput = Phase2cLoadOutput | Phase2cSaveOutput;

// ============================================================================
// Auto-graded question types
// ============================================================================

const AUTO_GRADED_TYPES = [
  'Graphic Gap Match',
  'Graphic Text Entry',
  'Multiple Choice',
  'Drag and Drop',
  'Gap Match',
  'Text Entry',
];

function isAutoGraded(questionType: string): boolean {
  return AUTO_GRADED_TYPES.some(type =>
    questionType.toLowerCase().includes(type.toLowerCase())
  );
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function phase2cAnswerBoundaries(
  input: Phase2cInput
): Promise<Phase2cOutput> {
  const { project_path, mode } = input;
  validatePathOrThrow(project_path);

  if (mode === 'save') {
    return handleSaveMode(input);
  }

  return handleLoadMode(project_path, mode);
}

// ============================================================================
// LOAD Mode
// ============================================================================

async function handleLoadMode(
  project_path: string,
  mode: 'load' | 'preview' | 'batch'
): Promise<Phase2cLoadOutput> {
  // Find student files
  const studentAnswersPath = join(project_path, FOLDERS.PHASE2_MARKDOWN, 'student_answers');

  let studentFiles: string[] = [];
  let firstStudentContent = '';
  let firstStudentFilename = '';

  try {
    const files = await fs.readdir(studentAnswersPath);
    studentFiles = files
      .filter(f => f.endsWith('.md'))
      .map(f => join(studentAnswersPath, f));

    // Read first student file
    if (studentFiles.length > 0) {
      firstStudentFilename = basename(studentFiles[0]);
      firstStudentContent = await fs.readFile(studentFiles[0], 'utf-8');
    }
  } catch (error) {
    throw new Error(`Student answers directory not found: ${studentAnswersPath}`);
  }

  // Load exam_config.yaml
  const examConfigPath = join(project_path, 'exam_config.yaml');
  let examConfig: Partial<ExamConfig>;

  try {
    const configContent = await fs.readFile(examConfigPath, 'utf-8');
    examConfig = load(configContent) as Partial<ExamConfig>;
  } catch (error) {
    throw new Error(`exam_config.yaml not found at ${examConfigPath}`);
  }

  // Extract question info
  const questions = (examConfig.questions || []).map((q) => ({
    id: q.id,
    number: q.number,
    rubric_id: q.rubric_id || null,
    question_type: q.question_type || 'Unknown',
    auto_graded: isAutoGraded(q.question_type || ''),
  }));

  // Load methodology
  const methodologyLoader = new MethodologyLoader();
  const methodology = await methodologyLoader.loadPhase2C();

  // Build instructions
  const instructions = buildInstructions(mode, studentFiles.length, questions);

  return {
    mode: 'load',
    student_files: studentFiles,
    first_student: {
      filename: firstStudentFilename,
      content: firstStudentContent,
    },
    exam_config: {
      exam_name: examConfig.exam?.exam_name || 'Unknown',
      questions,
    },
    methodology,
    instructions,
  };
}

function buildInstructions(
  mode: 'load' | 'preview' | 'batch',
  studentCount: number,
  questions: Array<{ id: string; number: number; auto_graded: boolean; question_type: string; rubric_id: string | null }>
): string {
  const manualQuestions = questions.filter(q => !q.auto_graded);
  const autoQuestions = questions.filter(q => q.auto_graded);

  let instructions = `
## Phase 4D: Answer Boundary Detection - ${mode.toUpperCase()} MODE

**Studenter:** ${studentCount}
**Frågor:** ${questions.length} (${manualQuestions.length} manual, ${autoQuestions.length} auto-graded)

### Din uppgift: ANALYSERA dokumentstrukturen

**HÅRDKODA ALDRIG värden** - analysera studentfilen och hitta exakt vad som står där.

### Steg 1: Identifiera språk
Titta på dokumentet och identifiera:
- Svenska: "Ord: XX" efter svar
- Engelska: "Words: XX" efter svar

### Steg 2: För varje MANUELL fråga (${manualQuestions.map(q => q.id).join(', ')}):

**A) Hitta question_header:**
- Exakt text som identifierar frågan (t.ex. "1 Restriktionsenzym (a-d)")
- OBS: Samma text kan finnas i TOC - välj den som står ENSAM på raden

**B) Identifiera om frågan har delfrågor:**
- Finns a), b), c)... efter frågetexten?

**C) Identifiera answer_start:**
- MED delfrågor: \`answer_start_type: "sub_question"\`, \`answer_start_marker: "a)"\`
- UTAN delfrågor: \`answer_start_type: "after_text"\`, \`answer_start_marker: "[frågetexten]"\`

**D) Om delfrågor: Spara SISTA RADEN av frågetexten i sub_questions:**
- VIKTIGT: Spara EXAKT den sista raden som kommer DIREKT FÖRE studentens svar
- Om frågan är på flera rader, spara BARA sista raden
- Inkludera punkter, citattecken, frågetecken etc. EXAKT som de står
- ⚠️ INKLUDERA ALDRIG labeln (a), b), c) etc.) i värdet!
  - ❌ FEL: \`a: "a) Vad är ett restriktionsenzym?"\`
  - ✅ RÄTT: \`a: "Vad är ett restriktionsenzym?"\`

**E) Identifiera answer_end:**
- Vad står efter sista svaret? Spara EXAKT text.
- Om explicit markör: \`answer_end_type: "marker"\`, \`answer_end_marker: "[exakt text]"\`
- Om ingen markör: \`answer_end_type: "next_question"\`

**F) Om delfrågor: Identifiera sub_question_end_marker:**
- Vad markerar slutet på varje delsvar? (t.ex. "Ord:")

### Steg 3: Verifiera för ALLA ${studentCount} studenter

### Output format:

\`\`\`yaml
# Fråga MED delfrågor:
Q001:
  question_header: "1 Restriktionsenzym (a-d)"   # EXAKT från dokumentet
  answer_start_type: "sub_question"
  answer_start_marker: "a)"                      # Första delfrågan
  sub_questions:                                 # SISTA RADEN - UTAN label!
    a: "Vad är ett restriktionsenzym?"           # ✅ Utan "a)" - enradig fråga
    b: "verkligheten\"."                          # ✅ Flerradig → bara sista raden
    c: "Vad har de för bioteknisk användning?"   # ✅ Utan "c)"
    d: "Vad var restriktionsenzymernas..."       # ✅ Utan "d)"
  sub_question_end_marker: "Ord:"                # EXAKT text
  answer_end_type: "marker"
  answer_end_marker: "Besvarad."                 # EXAKT text
  consistent_across_students: true
  verified_students: ${studentCount}

# Fråga UTAN delfrågor:
Q002:
  question_header: "2 Lambda-DNA"
  answer_start_type: "after_text"
  answer_start_marker: "Vad är lambda-DNA?"      # Frågetexten (svar börjar efter denna)
  answer_end_type: "marker"
  answer_end_marker: "Besvarad."
  consistent_across_students: true
  verified_students: ${studentCount}
\`\`\`

### Auto-graded frågor (${autoQuestions.map(q => q.id).join(', ') || 'inga'}):
\`\`\`yaml
skip_boundary_detection: true
auto_graded: true
\`\`\`

### När du är klar:
Kalla phase2c_answer_boundaries med mode="save" och answer_boundaries={...}
`;

  return instructions.trim();
}

// ============================================================================
// SAVE Mode
// ============================================================================

async function handleSaveMode(input: Phase2cInput): Promise<Phase2cSaveOutput> {
  const { project_path, answer_boundaries } = input;
  const startTime = performance.now();

  if (!answer_boundaries) {
    throw new Error('answer_boundaries is required for SAVE mode');
  }

  // Derive project root for state tracking
  const stateProjectPath = await deriveProjectPath(project_path);

  // Mark phase as in_progress
  if (stateProjectPath) {
    await safeStateOperation(
      () => markPhaseInProgress(stateProjectPath, 2, '2c_boundaries'),
      'phase2c markPhaseInProgress'
    );
  }

  try {
    // Load existing exam_config.yaml
    const configPath = join(project_path, 'exam_config.yaml');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = load(configContent) as Record<string, unknown>;

    // Add answer_boundaries section
    config.answer_boundaries = answer_boundaries;

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

    // Calculate summary stats
    const questionEntries = Object.entries(answer_boundaries.questions);
    const withBoundaries = questionEntries.filter(
      ([_, q]) => !q.skip_boundary_detection
    ).length;
    const autoGraded = questionEntries.filter(
      ([_, q]) => q.auto_graded || q.skip_boundary_detection
    ).length;

    const durationSeconds = (performance.now() - startTime) / 1000;

    // Update project state on success
    if (stateProjectPath) {
      await safeStateOperation(
        () => markPhaseComplete(stateProjectPath, 2, '2c_boundaries', {
          questions_with_boundaries: withBoundaries,
          auto_graded_skipped: autoGraded,
          language: answer_boundaries.global.language,
        }),
        'phase2c markPhaseComplete'
      );

      // Log workflow action
      await safeStateOperation(
        () => logWorkflowAction(
          stateProjectPath,
          '2c',
          'phase2c_boundaries',
          'answer_boundaries_save',
          {
            project_path,
            total_questions: questionEntries.length,
          },
          {
            config_path: configPath,
            questions_with_boundaries: withBoundaries,
            auto_graded_skipped: autoGraded,
            language: answer_boundaries.global.language,
            success: true,
          },
          durationSeconds
        ),
        'phase2c logWorkflowAction'
      );
    }

    return {
      mode: 'save',
      success: true,
      config_path: configPath,
      summary: {
        questions_with_boundaries: withBoundaries,
        auto_graded_skipped: autoGraded,
        language: answer_boundaries.global.language,
      },
    };
  } catch (error) {
    // Mark phase as incomplete on error
    if (stateProjectPath) {
      await safeStateOperation(
        () => markPhaseIncomplete(stateProjectPath, 2, '2c_boundaries', error as Error),
        'phase2c markPhaseIncomplete'
      );
    }
    throw error;
  }
}
