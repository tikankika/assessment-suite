import { promises as fs } from 'fs';
import * as path from 'path';
import { load as yamlLoad } from 'js-yaml';
import { StatusManager } from '../core/status_manager.js';
import { StudentReader } from '../core/student_reader.js';
import { RubricParser } from '../shared/rubric_parser.js';
import { MethodologyLoader } from '../core/methodology_loader.js';
import { ExamConfigReader, QuestionConfig } from '../shared/exam_config_reader.js';
import { debugLog } from '../core/debug.js';
import { AssessmentStartResult, SessionInfo, Student } from '../types/assessment.js';
import {
  deriveProjectPath,
  markPhaseInProgress,
  markPhaseIncomplete,
  logWorkflowAction,
  safeStateOperation,
  updatePhase6Session,
  getPhase6Session,
  getTimestamp,
  SourcesYaml,
  PerStudentEntry,
} from '../shared/project_state_manager.js';
import { FOLDERS } from '../shared/folder_constants.js';

// ADR-003: Methodology document types
// CORE docs (phase4*) are auto-loaded by Phase 4 tools - NOT listed here
// PHASE6_DOCS are loaded progressively in Phase 6 assessment
// INSIGHTS docs (teacher_insights_guide) are for Phase 7 - NOT shown in Phase 6
const PHASE6_DOCS = [
  'pedagogical/00_foundation.md',
  'pedagogical/phase6_assessment_method.md',
];

/**
 * assessment_start - Initialize an assessment session
 *
 * ADR-003: Progressive methodology loading
 *
 * This tool:
 * 1. Extracts question ID from Q-file path
 * 2. Finds exam_config.yaml in project directory
 * 3. Uses exam_config as INDEX to locate rubric section in rubric.md
 * 4. Extracts FULL rubric section text
 * 5. Lists methodology documents (doesn't load full content)
 * 6. Creates assessment file copy with traceability
 * 7. Creates/updates ASSESSMENT-STATUS YAML
 * 8. Returns: rubricSection, methodology_documents list, firstStudent
 *
 * @param args.q_file_path - Path to Q-file (e.g., Q6_alla_elever.md)
 * @param args.rubric_path - Path to bedömningsanvisningar
 * @param args.assessor - ADR-003: Assessor name/alias for traceability
 * @param args.create_copy - ADR-003: Create assessment file copy (default: true)
 * @returns AssessmentStartResult with rubricSection, methodology_documents, project_path
 *
 * @see docs/adr/ADR-003-progressive-methodology-loading.md
 */
export async function assessmentStart(args: {
  q_file_path?: string;
  student_files_dir?: string;
  rubric_path: string;
  assessor?: string;
  create_copy?: boolean;
  assessment_title?: string;
  project_path?: string;
}): Promise<AssessmentStartResult> {
  const { q_file_path, student_files_dir, rubric_path, assessor, create_copy = true, assessment_title } = args;

  // Validate: at least one input mode must be specified
  if (!q_file_path && !student_files_dir) {
    throw new Error('Either q_file_path or student_files_dir must be provided.');
  }
  if (q_file_path && student_files_dir) {
    throw new Error('Provide q_file_path OR student_files_dir, not both.');
  }

  // Per-student mode: delegate to separate handler
  if (student_files_dir) {
    return assessmentStartPerStudent({
      student_files_dir,
      rubric_path,
      assessor,
      assessment_title,
      project_path: args.project_path,
    });
  }

  // Q-file mode (existing logic below)
  // At this point q_file_path is guaranteed to be defined (per-student returned above)
  if (!q_file_path) {
    throw new Error('q_file_path is required for Q-file mode');
  }
  debugLog('[assessment_start] START ========================');
  debugLog('[assessment_start] q_file_path:', q_file_path);
  debugLog('[assessment_start] rubric_path:', rubric_path);
  debugLog('[assessment_start] assessor:', assessor || '(not specified)');
  debugLog('[assessment_start] create_copy:', create_copy);

  const statusManager = new StatusManager();
  const studentReader = new StudentReader();
  const rubricParser = new RubricParser();
  const methodologyLoader = new MethodologyLoader();
  const examConfigReader = new ExamConfigReader();

  const validationWarnings: string[] = [];
  let rubricSection: string = '';
  let questionConfig: QuestionConfig | null = null;
  let assessmentFile: string | undefined;
  let methodologyDocuments: string[] = [];
  let projectPath: string = '';
  let phaseMarkedInProgress = false;

  try {

  // 1. Check if file exists
  debugLog('[assessment_start] Step 1: Checking Q-file exists...');
  if (!(await studentReader.fileExists(q_file_path))) {
    debugLog('[assessment_start] ERROR: Q-file not found!');
    throw new Error(`Q-file not found: ${q_file_path}`);
  }
  debugLog('[assessment_start] Step 1: OK - Q-file exists');

  // 2. Extract question ID from Q-file path
  debugLog('[assessment_start] Step 2: Extracting question ID...');
  const questionId = examConfigReader.extractQuestionId(q_file_path);
  debugLog('[assessment_start] Step 2: questionId:', questionId || '(none)');

  // 3. Try to find and load exam_config.yaml
  debugLog('[assessment_start] Step 3: Looking for exam_config.yaml...');
  const configPath = await examConfigReader.findConfigPath(q_file_path);

  if (configPath) {
    debugLog('[assessment_start] Step 3: Found exam_config.yaml:', configPath);

    const examConfig = await examConfigReader.load(configPath);
    questionConfig = questionId
      ? examConfigReader.getQuestionById(examConfig, questionId)
      : null;

    if (questionConfig) {
      console.error(
        '[assessment_start] Step 3: Question config found:',
        questionConfig.question_title
      );

      // 4. Extract FULL rubric section using config as index
      debugLog('[assessment_start] Step 4: Extracting full rubric section...');
      rubricSection = await rubricParser.extractFullSection(rubric_path, questionConfig);
      console.error(
        '[assessment_start] Step 4: Rubric section extracted, length:',
        rubricSection.length
      );
    } else {
      validationWarnings.push(`Question ${questionId} not found in exam_config.yaml`);
      debugLog('[assessment_start] Step 3: Question not found in exam_config');
    }
  } else {
    validationWarnings.push('exam_config.yaml not found - using fallback rubric parsing');
    debugLog('[assessment_start] Step 3: exam_config.yaml not found, using fallback');

    // Fallback: try to extract question info from Q-file and parse rubric directly
    const questionInfo = await studentReader.extractQuestionInfo(q_file_path);
    if (questionInfo) {
      rubricSection = await rubricParser.getRubricSection(rubric_path, questionInfo.number);
      debugLog('[assessment_start] Step 4: Fallback rubric section, length:', rubricSection.length);
    }
  }

  // 5-6. Read Q-file once, share content with both extractQuestionInfo and parseStudents
  debugLog('[assessment_start] Step 5-6: Reading Q-file, extracting info and parsing students...');
  const qFileContent = await fs.readFile(q_file_path, 'utf-8');
  const questionInfo = await studentReader.extractQuestionInfo(q_file_path, qFileContent);
  const students = await studentReader.parseStudents(q_file_path, qFileContent);
  const maxPoints = questionConfig?.points || 0;
  const totalStudents = students.length;
  debugLog('[assessment_start] Step 6: Found', totalStudents, 'students');

  if (totalStudents === 0) {
    debugLog('[assessment_start] ERROR: No students found!');
    throw new Error('No students found in Q-file');
  }

  // 7. Check if already has STATUS (resume mode)
  debugLog('[assessment_start] Step 7: Checking for existing STATUS...');
  const hasExistingStatus = await statusManager.hasStatus(q_file_path);
  debugLog('[assessment_start] Step 7: hasExistingStatus:', hasExistingStatus);
  let resumed = false;
  let firstStudent: Student | null = null;

  if (hasExistingStatus) {
    resumed = true;
    firstStudent = await studentReader.getNextUnassessed(q_file_path);
    const existingStatus = await statusManager.read(q_file_path);
    validationWarnings.push(`Resuming session. Progress: ${existingStatus.progress}`);
    debugLog('[assessment_start] Step 7: RESUMING, progress:', existingStatus.progress);

    // ADR-005: Check if methodology was loaded in previous session
    const tempProjectPath = await deriveProjectPath(q_file_path);
    if (tempProjectPath) {
      const previousSession = await getPhase6Session(tempProjectPath);
      if (previousSession && !previousSession.methodology_loaded) {
        validationWarnings.push(
          '⚠️ METODDOKUMENT EJ LADDADE. Överväg att köra phase6_methodology för komplexa bedömningar.'
        );
        debugLog('[assessment_start] Step 7: WARNING - methodology not loaded in previous session');
      }
    }
  } else {
    // Create new status
    debugLog('[assessment_start] Step 7: Creating new STATUS...');
    const questionTitle =
      questionConfig?.question_title ||
      questionInfo?.title ||
      `Question ${questionId}`;

    await statusManager.create(
      q_file_path,
      questionTitle,
      maxPoints,
      totalStudents,
      [], // aspects not stored in status anymore - they're in rubric section
      rubric_path
    );
    firstStudent = students[0] || null;
    debugLog('[assessment_start] Step 7: New STATUS created');
  }

  // 8. ADR-003: Derive project path and read sources.yaml for methodology
  // RFC-018: Q-files now come from 05_answers_by_question/
  debugLog('[assessment_start] Step 8: Finding project path and methodology docs...');
  const stateProjectPath = await deriveProjectPath(q_file_path);
  projectPath = stateProjectPath || path.dirname(q_file_path)
    .replace(`/${FOLDERS.PHASE5_ANSWERS}`, '')
    .replace(`/${FOLDERS.PHASE6_ASSESSMENT}`, '');

  // Try to read sources.yaml to find methodology folder
  let methodologyFolder = '';
  try {
    const sourcesPath = path.join(projectPath, 'sources.yaml');
    const sourcesContent = await fs.readFile(sourcesPath, 'utf-8');
    const sources = yamlLoad(sourcesContent) as Partial<SourcesYaml>;
    if (sources?.sources?.methodology?.copied_to) {
      methodologyFolder = path.join(projectPath, sources.sources.methodology.copied_to);
      debugLog('[assessment_start] Step 8: Found methodology from sources.yaml:', methodologyFolder);
    }
  } catch {
    debugLog('[assessment_start] Step 8: sources.yaml not found, using default');
  }

  // Fallback: check project/methodology/ then parent/methodology/
  if (!methodologyFolder) {
    const localMethodology = path.join(projectPath, 'methodology');
    const parentMethodology = path.join(projectPath, '..', 'methodology');
    try {
      await fs.access(localMethodology);
      methodologyFolder = localMethodology;
      debugLog('[assessment_start] Step 8: Found local methodology/');
    } catch {
      try {
        await fs.access(parentMethodology);
        methodologyFolder = parentMethodology;
        debugLog('[assessment_start] Step 8: Found parent methodology/');
      } catch {
        debugLog('[assessment_start] Step 8: No methodology folder found');
      }
    }
  }

  // List and AUTO-LOAD Phase 6 methodology documents (same pattern as GenericPhaseOrchestrator)
  const methodologyContent: Array<{ name: string; content: string }> = [];
  if (methodologyFolder) {
    try {
      for (const doc of PHASE6_DOCS) {
        let docPath = path.join(methodologyFolder, doc);
        let docName = doc;
        try {
          await fs.access(docPath);
        } catch {
          // Fallback: try basename in flat structure (existing projects)
          const basename = doc.split('/').pop() ?? '';
          docPath = path.join(methodologyFolder, basename);
          docName = basename;
          try {
            await fs.access(docPath);
          } catch {
            continue; // Not found
          }
        }
        methodologyDocuments.push(docName);
        const content = await fs.readFile(docPath, 'utf-8');
        methodologyContent.push({ name: docName, content });
        debugLog('[assessment_start] Step 8: Loaded methodology doc:', docName, 'size:', content.length);
      }
      debugLog('[assessment_start] Step 8: Auto-loaded', methodologyContent.length, 'methodology docs');
    } catch {
      debugLog('[assessment_start] Step 8: Could not read methodology folder');
    }
  }

  // Fallback: minimal methodology for backwards compatibility
  let methodology = '';
  if (methodologyContent.length === 0) {
    try {
      methodology = await methodologyLoader.getCondensed();
      validationWarnings.push('Using fallback methodology - sources.yaml not configured');
    } catch {
      methodology = 'Use analytical assessment methodology.';
    }
  }

  // 8b. RFC-018: Create assessment file copy in 06_analytic_assessment/
  // Q-files come from 05/, working copies go to 06/
  if (create_copy && assessor) {
    const qFileName = path.basename(q_file_path);
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const baseName = qFileName.replace('.md', '');
    const copyFileName = `${baseName}_${dateStr}_${assessor}.md`;

    // RFC-018: Copy to 06_analytic_assessment/ directory
    const assessmentDir = path.join(projectPath, FOLDERS.PHASE6_ASSESSMENT);
    const copyPath = path.join(assessmentDir, copyFileName);

    try {
      // Ensure 06_analytic_assessment directory exists
      await fs.mkdir(assessmentDir, { recursive: true });

      // BUGFIX: Check if copy already exists - DON'T overwrite existing assessments!
      let copyExists = false;
      try {
        await fs.access(copyPath);
        copyExists = true;
      } catch {
        copyExists = false;
      }

      if (copyExists) {
        // Copy exists - use it, don't overwrite
        assessmentFile = copyPath;
        validationWarnings.push(`Using existing assessment file (not overwriting): ${copyFileName}`);
        debugLog('[assessment_start] Step 8b: Assessment copy already exists, reusing:', copyFileName);
      } else {
        // No copy exists - create one
        await fs.copyFile(q_file_path, copyPath);
        assessmentFile = copyPath;
        debugLog('[assessment_start] Step 8b: Created assessment copy in 06/:', copyFileName);
      }
    } catch (error) {
      validationWarnings.push(`Could not create assessment copy: ${error}`);
      debugLog('[assessment_start] Step 8b: Failed to create copy:', error);
    }
  } else if (create_copy && !assessor) {
    validationWarnings.push('No assessor specified - using original file (no copy created)');
  }

  // 9. Build session info
  const sessionInfo: SessionInfo = {
    file: q_file_path.split('/').pop() || q_file_path,
    question:
      questionConfig?.question_title ||
      questionInfo?.title ||
      `Question ${questionId}`,
    maxPoints,
    totalStudents,
    aspects: [], // Not used anymore - Claude reads from rubricSection
  };

  debugLog('[assessment_start] SUCCESS - returning result');

  // 10. Update project state (if project_state.json exists)
  if (projectPath && !resumed) {
    // Only mark as in_progress on NEW session (not resume)
    await safeStateOperation(
      () => markPhaseInProgress(projectPath, 6, '6_assessment'),
      'phase6_start markPhaseInProgress'
    );
    phaseMarkedInProgress = true;
  }

  // 10b. ADR-005: Store Phase 6 session state for auto-discovery
  if (projectPath) {
    await safeStateOperation(
      () => updatePhase6Session(projectPath, {
        current_question: questionId || '',
        assessment_file: assessmentFile || q_file_path,
        original_file: q_file_path,
        started_at: getTimestamp(),
        assessor: assessor || 'unknown',
        methodology_loaded: methodologyContent.length > 0,  // Auto-loaded by phase6_start
        rubric_displayed: rubricSection.length > 0,          // Auto-loaded by phase6_start
      }),
      'phase6_start: store session state (ADR-005)'
    );
  }

  // Log workflow action
  if (projectPath) {
    await safeStateOperation(
      () => logWorkflowAction(
        projectPath,
        6,
        'phase6_start',
        resumed ? 'assessment_session_resume' : 'assessment_session_start',
        {
          q_file_path,
          rubric_path,
        },
        {
          question_id: questionId,
          total_students: totalStudents,
          resumed,
          success: true,
        }
      ),
      'phase6_start logWorkflowAction'
    );
  }

  debugLog('[assessment_start] END ==========================');

  // 11. Build next_action instruction (methodology auto-loaded, show to teacher)
  let next_action: string;
  if (methodologyContent.length > 0) {
    next_action = `METODDOKUMENT LADDADE (${methodologyContent.length} st). ` +
      `VISA HELA INNEHÅLLET i methodology_content för läraren - ett dokument i taget. ` +
      `VISA ÄVEN rubricSection (bedömningsanvisningarna). ` +
      `Fråga sedan: "Redo att börja bedöma?"`;
  } else {
    next_action = `Inga metodikdokument hittades. Rubrik finns i rubricSection. Fråga: "Redo att börja bedöma?"`;
  }

  // 12. Return EVERYTHING Claude Desktop needs
  return {
    sessionInfo,
    rubricSection,  // Full rubric section (auto-loaded)
    methodology,  // Fallback only (empty if docs loaded)
    methodology_documents: methodologyDocuments,  // Names of loaded docs
    methodology_content: methodologyContent,  // Auto-loaded doc contents
    project_path: projectPath,  // For workflow state management
    question_id: questionId || '',  // For reference
    rubric_path: rubric_path,  // For reference
    assessment_file: assessmentFile,  // Traceability copy
    next_action,  // Instruction for Claude
    firstStudent,
    validationWarnings,
    resumed,
  };

  } catch (error) {
    // RFC-029 §14.2 R1: Mark phase as incomplete on error (matching phase2b/2c/2d pattern)
    if (phaseMarkedInProgress && projectPath) {
      await safeStateOperation(
        () => markPhaseIncomplete(projectPath, 6, '6_assessment', error as Error),
        'phase6_start markPhaseIncomplete'
      );
    }
    throw error;
  }
}


/**
 * Per-student mode: Initialize assessment session from a directory of student files.
 *
 * Each student has their own file (PDF or MD). Assessment is written to
 * standalone BEDÖMNING files in 06_analytic_assessment/.
 *
 * Progress is tracked in project_state.json (not Q-file frontmatter).
 */
async function assessmentStartPerStudent(args: {
  student_files_dir: string;
  rubric_path: string;
  assessor?: string;
  assessment_title?: string;
  project_path?: string;
}): Promise<AssessmentStartResult> {
  const { student_files_dir, rubric_path, assessor, assessment_title } = args;

  debugLog('[assessment_start_per_student] START ========================');
  debugLog('[assessment_start_per_student] student_files_dir:', student_files_dir);
  debugLog('[assessment_start_per_student] rubric_path:', rubric_path);

  const methodologyLoader = new MethodologyLoader();
  const validationWarnings: string[] = [];
  let projectPath = '';

  // 1. Validate directory exists
  try {
    const stat = await fs.stat(student_files_dir);
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${student_files_dir}`);
    }
  } catch (error) {
    throw new Error(`Student files directory not found: ${student_files_dir}`);
  }

  // 2. Scan for student files (.pdf, .md)
  // Minimal filtering: only skip hidden files. Claude Desktop asks the teacher to confirm.
  const dirEntries = await fs.readdir(student_files_dir);
  let studentFiles = dirEntries
    .filter(f => /\.(pdf|md)$/i.test(f))
    .filter(f => !f.startsWith('.'))
    .sort();

  // Prefer PDFs when both PDF and MD exist (avoids counting same student twice)
  const hasPdfs = studentFiles.some(f => /\.pdf$/i.test(f));
  if (hasPdfs) {
    studentFiles = studentFiles.filter(f => /\.pdf$/i.test(f));
  }

  if (studentFiles.length === 0) {
    throw new Error(`No student files (.pdf/.md) found in: ${student_files_dir}`);
  }

  // 3. Derive student IDs from filenames
  const students: PerStudentEntry[] = studentFiles.map(f => {
    const stem = f.replace(/\.(pdf|md)$/i, '');
    // Strip common suffixes and intermediate extensions for cleaner IDs
    const id = stem
      .replace(/\.docx?/i, '')      // AAA.docx_anonymized → AAA_anonymized
      .replace(/_anonymized$/i, '')
      .replace(/_lab\d+$/i, '')
      .replace(/_rapport$/i, '');
    return {
      id,
      source_file: path.join(student_files_dir, f),
      assessed: false,
    };
  });

  debugLog('[assessment_start_per_student] Found', students.length, 'student files');

  // 4. Derive project path (explicit > auto-derived)
  if (args.project_path) {
    projectPath = args.project_path;
  } else {
    const stateProjectPath = await deriveProjectPath(student_files_dir);
    projectPath = stateProjectPath || path.dirname(student_files_dir);
  }

  // 5. Load methodology documents (same pattern as Q-file mode)
  const methodologyDocuments: string[] = [];
  const methodologyContent: Array<{ name: string; content: string }> = [];
  let methodologyFolder = '';

  try {
    const sourcesPath = path.join(projectPath, 'sources.yaml');
    const sourcesContent = await fs.readFile(sourcesPath, 'utf-8');
    const sources = yamlLoad(sourcesContent) as Partial<SourcesYaml>;
    if (sources?.sources?.methodology?.copied_to) {
      methodologyFolder = path.join(projectPath, sources.sources.methodology.copied_to);
    }
  } catch {
    debugLog('[assessment_start_per_student] sources.yaml not found');
  }

  // Fallback: check project/methodology/ then parent/methodology/
  if (!methodologyFolder) {
    const localMethodology = path.join(projectPath, 'methodology');
    const parentMethodology = path.join(projectPath, '..', 'methodology');
    try {
      await fs.access(localMethodology);
      methodologyFolder = localMethodology;
    } catch {
      try {
        await fs.access(parentMethodology);
        methodologyFolder = parentMethodology;
      } catch { /* no methodology found */ }
    }
  }

  if (methodologyFolder) {
    for (const doc of PHASE6_DOCS) {
      let docPath = path.join(methodologyFolder, doc);
      let docName = doc;
      try {
        await fs.access(docPath);
      } catch {
        const basename = doc.split('/').pop() ?? '';
        docPath = path.join(methodologyFolder, basename);
        docName = basename;
        try { await fs.access(docPath); } catch { continue; }
      }
      methodologyDocuments.push(docName);
      const content = await fs.readFile(docPath, 'utf-8');
      methodologyContent.push({ name: docName, content });
    }
  }

  let methodology = '';
  if (methodologyContent.length === 0) {
    try {
      methodology = await methodologyLoader.getCondensed();
    } catch {
      methodology = 'Use analytical assessment methodology.';
    }
  }

  // 6. Load rubric
  let rubricSection = '';
  try {
    rubricSection = await fs.readFile(rubric_path, 'utf-8');
  } catch {
    validationWarnings.push(`Could not read rubric file: ${rubric_path}`);
  }

  // 7. Ensure assessment output directory exists
  const assessmentOutputDir = path.join(projectPath, FOLDERS.PHASE6_ASSESSMENT);
  await fs.mkdir(assessmentOutputDir, { recursive: true });

  // 8. Check for already-assessed students (resume support)
  for (const student of students) {
    const bedömningPath = path.join(assessmentOutputDir, `BEDÖMNING_${student.id}.md`);
    try {
      await fs.access(bedömningPath);
      student.assessed = true;
      student.assessment_file = bedömningPath;
    } catch {
      // Not yet assessed
    }
  }

  const assessedCount = students.filter(s => s.assessed).length;
  const resumed = assessedCount > 0;
  if (resumed) {
    validationWarnings.push(`Resuming: ${assessedCount}/${students.length} students already assessed.`);
  }

  // 9. Store session state
  await safeStateOperation(
    () => markPhaseInProgress(projectPath, 6, '6_assessment'),
    'phase6_start_per_student markPhaseInProgress'
  );

  await safeStateOperation(
    () => updatePhase6Session(projectPath, {
      current_question: assessment_title || 'per_student_assessment',
      assessment_file: assessmentOutputDir,
      original_file: student_files_dir,
      started_at: getTimestamp(),
      assessor: assessor || 'unknown',
      methodology_loaded: methodologyContent.length > 0,
      rubric_displayed: rubricSection.length > 0,
      mode: 'per_student',
      student_files_dir,
      assessment_output_dir: assessmentOutputDir,
      rubric_path,
      students,
      total_students: students.length,
    }),
    'phase6_start_per_student: store session state'
  );

  // 10. Log workflow action
  await safeStateOperation(
    () => logWorkflowAction(
      projectPath, 6, 'phase6_start', 'per_student_session_start',
      { student_files_dir, rubric_path, student_count: students.length },
      { success: true, resumed, assessed_count: assessedCount }
    ),
    'phase6_start_per_student logWorkflowAction'
  );

  // 11. Build first student
  const firstUnassessed = students.find(s => !s.assessed) || null;
  const firstStudent: Student | null = firstUnassessed ? {
    id: firstUnassessed.id,
    index: students.indexOf(firstUnassessed),
    wordCount: 0,
    answer: `[Read PDF: ${firstUnassessed.source_file}]`,
    assessed: false,
  } : null;

  // 12. Build next_action
  let next_action: string;
  if (methodologyContent.length > 0) {
    next_action = `PER-STUDENT MODE. ${students.length} elever, ${assessedCount} redan bedömda. ` +
      `METODDOKUMENT LADDADE (${methodologyContent.length} st). ` +
      `VISA methodology_content + rubricSection för läraren. ` +
      `Läs sedan elevens PDF direkt.`;
  } else {
    next_action = `PER-STUDENT MODE. ${students.length} elever. Läs rubricSection, sedan elevens PDF.`;
  }

  return {
    sessionInfo: {
      file: path.basename(student_files_dir),
      question: assessment_title || 'Per-student assessment',
      maxPoints: 0,
      totalStudents: students.length,
      aspects: [],
    },
    rubricSection,
    methodology,
    methodology_documents: methodologyDocuments,
    methodology_content: methodologyContent,
    project_path: projectPath,
    question_id: 'per_student',
    rubric_path,
    assessment_file: assessmentOutputDir,
    next_action,
    firstStudent,
    validationWarnings,
    resumed,
  };
}
