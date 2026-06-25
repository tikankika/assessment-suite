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
 * phase6_methodology - Progressive methodology document loading
 *
 * ADR-003: Loads methodology documents one at a time for better processing.
 *
 * @param args.project_path - Path to project folder (from phase6_start)
 * @param args.document_index - 0-based index of document to load
 * @param args.document_name - Alternative: specific document by name
 * @returns Document content with progress info
 *
 * @see docs/decisions/ADR-003-progressive-methodology-loading.md
 */

// ADR-003: Methodology document types (same as phase6_start)
// CORE docs (phase4*) are auto-loaded by Phase 4 tools - NOT available here
// ASSESSMENT docs are for Phase 6 assessment workflow ONLY
// INSIGHTS docs are for Phase 7 - NOT loaded in Phase 6
const PHASE6_DOCS = [
  'pedagogical/00_foundation.md',
  'pedagogical/phase6_assessment_method.md',
];

export interface Phase6MethodologyParams {
  project_path: string;
  document_index?: number;
  document_name?: string;
  rubric_path?: string;      // For bundled rubric on last doc
  question_id?: string;      // For bundled rubric on last doc
}

export interface Phase6MethodologyResult {
  document: {
    name: string;
    path: string;
    content: string;
    size_bytes: number;
  };
  progress: {
    current_index: number;
    total_documents: number;
    remaining: string[];
  };
  rubric_section?: string;      // Bundled on last doc
  question_info?: {             // Bundled on last doc
    id: string;
    title: string;
    max_points: number;
  };
  next_action: string;
}

export async function phase6Methodology(
  args: Phase6MethodologyParams
): Promise<Phase6MethodologyResult> {
  const { project_path, document_index = 0, document_name, rubric_path, question_id } = args;

  console.error('[phase6_methodology] START ========================');
  console.error('[phase6_methodology] project_path:', project_path);
  console.error('[phase6_methodology] document_index:', document_index);
  console.error('[phase6_methodology] document_name:', document_name || '(not specified)');
  console.error('[phase6_methodology] rubric_path:', rubric_path || '(not specified)');
  console.error('[phase6_methodology] question_id:', question_id || '(not specified)');

  // 1. Find methodology folder from sources.yaml
  let methodologyFolder = '';
  try {
    const sourcesPath = path.join(project_path, 'sources.yaml');
    const sourcesContent = await fs.readFile(sourcesPath, 'utf-8');
    const sources = yamlLoad(sourcesContent) as Partial<SourcesYaml>;
    if (sources?.sources?.methodology?.copied_to) {
      methodologyFolder = path.join(project_path, sources.sources.methodology.copied_to);
    }
  } catch (error) {
    console.error('[phase6_methodology] sources.yaml not found, trying default');
  }

  // Fallback to default methodology folder in project
  if (!methodologyFolder) {
    methodologyFolder = path.join(project_path, FOLDERS.METHODOLOGY);
  }

  console.error('[phase6_methodology] methodologyFolder:', methodologyFolder);

  // 2. List available Phase 6 documents (ASSESSMENT only, not INSIGHTS)
  let availableDocs: string[] = [];
  try {
    for (const doc of PHASE6_DOCS) {
      try {
        await fs.access(path.join(methodologyFolder, doc));
        availableDocs.push(doc);
      } catch {
        // Fallback: try basename in flat structure (existing projects)
        const basename = doc.split('/').pop() ?? '';
        try {
          await fs.access(path.join(methodologyFolder, basename));
          availableDocs.push(basename);
        } catch { /* not found */ }
      }
    }
  } catch (error) {
    throw new Error(`Could not read methodology folder: ${methodologyFolder}`);
  }

  if (availableDocs.length === 0) {
    throw new Error('No methodology documents found in project');
  }

  console.error('[phase6_methodology] availableDocs:', availableDocs);

  // 3. Determine which document to load
  let targetDoc: string;
  let targetIndex: number;

  if (document_name) {
    // Load by name
    if (!availableDocs.includes(document_name)) {
      throw new Error(`Document not found: ${document_name}. Available: ${availableDocs.join(', ')}`);
    }
    targetDoc = document_name;
    targetIndex = availableDocs.indexOf(document_name);
  } else {
    // Load by index
    if (document_index < 0 || document_index >= availableDocs.length) {
      throw new Error(`Invalid document_index: ${document_index}. Valid range: 0-${availableDocs.length - 1}`);
    }
    targetDoc = availableDocs[document_index];
    targetIndex = document_index;
  }

  console.error('[phase6_methodology] Loading:', targetDoc);

  // 4. Load document content
  const docPath = path.join(methodologyFolder, targetDoc);
  const content = await fs.readFile(docPath, 'utf-8');
  const stats = await fs.stat(docPath);

  console.error('[phase6_methodology] Loaded, size:', stats.size, 'bytes');

  // 5. Build progress info
  const remaining = availableDocs.slice(targetIndex + 1);
  let nextAction: string;
  let rubricSection: string | undefined;
  let questionInfo: { id: string; title: string; max_points: number } | undefined;

  if (remaining.length === 0) {
    // LAST DOCUMENT: Bundle rubric if rubric_path provided
    if (rubric_path && question_id) {
      console.error('[phase6_methodology] Last doc - loading bundled rubric...');

      const rubricParser = new RubricParser();
      const examConfigReader = new ExamConfigReader();

      let questionTitle = `Question ${question_id}`;
      let maxPoints = 0;

      // Try to load from exam_config.yaml
      const configPath = path.join(project_path, 'exam_config.yaml');
      try {
        const examConfig = await examConfigReader.load(configPath);
        const questionConfig = examConfigReader.getQuestionById(examConfig, question_id);

        if (questionConfig) {
          questionTitle = questionConfig.question_title || questionTitle;
          maxPoints = questionConfig.points || 0;
          rubricSection = await rubricParser.extractFullSection(rubric_path, questionConfig);
          console.error('[phase6_methodology] Rubric extracted, length:', rubricSection.length);
        } else {
          // Fallback: parse question number
          const qNumMatch = question_id.match(/Q?0*(\d+)/i);
          if (qNumMatch) {
            const qNum = parseInt(qNumMatch[1], 10);
            rubricSection = await rubricParser.getRubricSection(rubric_path, qNum);
          }
        }
      } catch (error) {
        console.error('[phase6_methodology] Config error, using fallback:', error);
        const qNumMatch = question_id.match(/Q?0*(\d+)/i);
        if (qNumMatch) {
          const qNum = parseInt(qNumMatch[1], 10);
          rubricSection = await rubricParser.getRubricSection(rubric_path, qNum);
        }
      }

      questionInfo = { id: question_id, title: questionTitle, max_points: maxPoints };
      nextAction = `KLART! Visa HELA document.content OCH rubric_section för läraren. Fråga: "Redo att börja bedöma ${questionTitle}?" Vänta på svar innan phase6_assess_student.`;
    } else {
      nextAction = 'KLART! Fråga: "Ok att fortsätta till bedömningsanvisningarna?" Vänta på svar. Anropa sedan phase6_rubric för att ladda bedömningsanvisningarna.';
    }
  } else {
    nextAction = `VIKTIGT: Du har precis laddat ett dokument. VISA HELA INNEHÅLLET OVAN för läraren (document.content). Fråga sedan: "Ok att fortsätta till ${remaining[0]}?" Vänta på svar innan du laddar nästa.`;
  }

  console.error('[phase6_methodology] END ==========================');

  // ADR-005: Mark methodology as loaded in session state
  await safeStateOperation(
    () => updatePhase6Session(project_path, { methodology_loaded: true }),
    'phase6_methodology: mark methodology_loaded (ADR-005)'
  );

  // RFC-027: Log methodology loading for research timeline
  await safeStateOperation(
    () => logWorkflowAction(
      project_path,
      6,
      'phase6_methodology',
      'methodology_load',
      {
        document_name: targetDoc,
        document_index: targetIndex,
      },
      {
        size_bytes: stats.size,
        remaining_count: remaining.length,
        has_bundled_rubric: !!rubricSection,
      }
    ),
    'phase6_methodology logWorkflowAction'
  );

  return {
    document: {
      name: targetDoc,
      path: docPath,
      content,
      size_bytes: stats.size,
    },
    progress: {
      current_index: targetIndex,
      total_documents: availableDocs.length,
      remaining,
    },
    rubric_section: rubricSection,
    question_info: questionInfo,
    next_action: nextAction,
  };
}
