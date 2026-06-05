/**
 * Phase 6-post: Assessment Format Detection
 *
 * REQUIRED step between Phase 6 (assessment) and Phase 7 (report generation).
 * Detects and configures assessment format in Q-files to enable Phase 7.
 * Follows the proven Phase 4d pattern: LOAD → human analysis → SAVE
 *
 * RFC-022: Human-in-the-loop format detection before automated report generation
 *
 * Workflow:
 *   Phase 6 (assess students) → Phase 6-post (detect format) → Phase 7 (generate reports)
 */

import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ExamConfig } from '../shared/exam_config_reader.js';
import { fileURLToPath } from 'url';
import {
  logWorkflowAction,
  markPhaseComplete,
  safeStateOperation,
} from '../shared/project_state_manager.js';
import { FOLDERS } from '../shared/folder_constants.js';

// ESM-compatible __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QuestionFormatSchema = z.object({
  points_pattern: z.string().describe('Regex pattern to extract points for this question')
});

const Phase6PostRequestSchema = z.object({
  mode: z.enum(['load', 'save']).describe('Mode: load (get files + methodology) or save (write config)'),
  project_path: z.string().describe('Project directory path containing Q-files'),
  // SAVE mode requires explicit confirmation (like generate_reports)
  confirmed: z.boolean().optional().describe('SAVE mode: Teacher has reviewed and approved the format (REQUIRED for save)'),
  assessment_format: z.object({
    type: z.enum(['v2', 'legacy']),
    legacy_header: z.string().optional(),
    student_id_pattern: z.string().optional(),
    // Per-question patterns
    questions: z.record(z.string(), QuestionFormatSchema).optional().describe('Per-question format config'),
    default_points_pattern: z.string().optional().describe('Fallback pattern if question not specified'),
    confirmed_by: z.string()
  }).optional().describe('SAVE mode: The assessment format configuration')
});

type Phase6PostRequest = z.infer<typeof Phase6PostRequestSchema>;

interface Phase6PostLoadResponse {
  success: true;
  mode: 'load';
  q_files: string[];
  sample_file: string;
  sample_content: string;
  exam_config: {
    student_count: number;
    question_count: number;
    student_ids: string[];
  };
  methodology: string;
  instructions: string;
}

interface Phase6PostSaveResponse {
  success: true;
  mode: 'save';
  config_path: string;
  format_saved: {
    type: string;
    confirmed_by: string;
  };
}

type Phase6PostResponse = Phase6PostLoadResponse | Phase6PostSaveResponse;

/**
 * Find Q-files in assessment directory, preferring dated versions over originals.
 *
 * File naming patterns:
 * - Original: Q001_alla_elever.md
 * - Dated: Q001_alla_elever_2026-01-18_Author.md
 * - Copy: Q001_alla_elever_2026-01-18_Author 1.md (avoid these)
 *
 * Logic:
 * 1. Group files by question number (Q001, Q002, etc.)
 * 2. For each question, prefer dated files (with assessments) over original
 * 3. If multiple dated files, choose the latest date
 * 4. Avoid files with " 1", " 2" suffix (copies)
 */
async function findQFiles(projectPath: string): Promise<string[]> {
  const assessmentDir = path.join(projectPath, FOLDERS.PHASE6_ASSESSMENT);

  try {
    const allFiles = await fs.readdir(assessmentDir);
    const qFiles = allFiles.filter(f => f.startsWith('Q') && f.endsWith('.md'));

    // Group files by question number
    const questionGroups: Map<string, string[]> = new Map();

    for (const file of qFiles) {
      // Extract question number (e.g., "Q001" from "Q001_alla_elever_2026-01-18_Author.md")
      const match = file.match(/^(Q\d+)/);
      if (match) {
        const questionId = match[1];
        if (!questionGroups.has(questionId)) {
          questionGroups.set(questionId, []);
        }
        questionGroups.get(questionId)!.push(file);
      }
    }

    // For each question, select the best file
    const selectedFiles: string[] = [];

    for (const [questionId, files] of questionGroups) {
      // Filter out copy files (with " 1", " 2", etc. suffix before .md)
      const nonCopyFiles = files.filter(f => !/ \d+\.md$/.test(f));

      // Separate dated files from original
      const datedFiles = nonCopyFiles.filter(f => /_\d{4}-\d{2}-\d{2}_/.test(f));
      const originalFiles = nonCopyFiles.filter(f => !/_\d{4}-\d{2}-\d{2}_/.test(f));

      let selectedFile: string;

      if (datedFiles.length > 0) {
        // Prefer dated files - sort by date descending to get latest
        datedFiles.sort((a, b) => {
          const dateA = a.match(/_(\d{4}-\d{2}-\d{2})_/)?.[1] || '';
          const dateB = b.match(/_(\d{4}-\d{2}-\d{2})_/)?.[1] || '';
          return dateB.localeCompare(dateA); // Descending
        });
        selectedFile = datedFiles[0];
      } else if (originalFiles.length > 0) {
        // Fall back to original file
        selectedFile = originalFiles[0];
      } else {
        // Use first available (shouldn't happen)
        selectedFile = files[0];
      }

      selectedFiles.push(path.join(assessmentDir, selectedFile));
    }

    // Sort by question number
    return selectedFiles.sort();
  } catch (error) {
    throw new Error(`Could not read assessment directory: ${assessmentDir}`);
  }
}

/**
 * Read sample content from first Q-file
 * 
 * FIX: Show both start and end of file to capture both v2 (inline) and legacy (end-of-file) formats.
 * Increased sample size to ensure assessment sections are visible.
 */
async function readSampleContent(qFile: string): Promise<string> {
  const content = await fs.readFile(qFile, 'utf-8');
  const lines = content.split('\n');
  
  // If file is small enough, return everything
  if (lines.length <= 300) {
    return content;
  }
  
  // For large files: first 150 + last 150 lines
  // This ensures we catch:
  // - v2 format (typically inline with students)
  // - Legacy format (typically at end of file)
  const firstPart = lines.slice(0, 150).join('\n');
  const lastPart = lines.slice(-150).join('\n');
  
  return `${firstPart}\n\n[... ${lines.length - 300} lines omitted ...]\n\n${lastPart}`;
}

/**
 * Load methodology document
 * 
 * CRITICAL FIX: Read from /methodology/ directory (same as Phase 4d)
 * This is where all methodology documents are stored in Assessment Suite.
 */
async function loadMethodology(): Promise<string> {
  // Find Assessment_suite root by going up from current location
  // We're in: Assessment_suite/packages/assessment-mcp/src/tools/
  // We need: Assessment_suite/methodology/
  const possiblePaths = [
    // Try subdirectory first (RFC-031 reorganization)
    path.join(__dirname, '../../../../methodology/technical/phase6_post_format_detection.md'),
    path.join(process.cwd(), 'methodology/technical/phase6_post_format_detection.md'),
    // Flat fallback for existing projects
    path.join(__dirname, '../../../../methodology/phase6_post_format_detection.md'),
    path.join(process.cwd(), 'methodology/phase6_post_format_detection.md'),
    // Legacy location (backup)
    path.join(__dirname, '../docs/phase6_post_format_detection_METHODOLOGY.md'),
  ];
  
  for (const methodologyPath of possiblePaths) {
    try {
      const content = await fs.readFile(methodologyPath, 'utf-8');
      console.error(`[Phase 6-post] Loaded methodology from: ${methodologyPath}`);
      return content;
    } catch (error) {
      // Try next path
      continue;
    }
  }
  
  // Fallback to inline instructions if file not found anywhere
  console.warn('[Phase 6-post] WARNING: Methodology file not found in any location, using fallback');
  return `# Phase 6-post: Assessment Format Detection

## Your Task
Analyze the sample Q-file content and detect the assessment format.

## Format Types

### v2 Format (Standard):
\`\`\`
<!-- PHASE6_ASSESSMENT_START student_id="12345" -->
Assessment text...
<!-- PHASE6_ASSESSMENT_END -->
\`\`\`

### Legacy Format:
\`\`\`
### BEDÖMNING: 12345
Assessment text...
(8/10 poäng)
\`\`\`

## Steps
1. Search for v2 markers (\`<!-- PHASE6_ASSESSMENT_START\`)
2. If not found, search for legacy markers (\`### BEDÖMNING:\`)
3. For legacy format:
   - Extract header pattern
   - Extract points pattern (common: \`\\((\\d+)/(\\d+)\\s*poäng\\)\`)
4. Verify pattern works on multiple assessments
5. Ask user to confirm
6. Call tool again with mode: 'save' and detected format

## Important
- v2 format requires NO additional config (just type: 'v2')
- Legacy format requires header + points pattern
- Always verify pattern against multiple examples
`;
}

/**
 * Load exam_config.yaml and extract relevant info
 */
async function loadExamConfig(projectPath: string): Promise<{
  student_count: number;
  question_count: number;
  student_ids: string[];
}> {
  const configPath = path.join(projectPath, 'exam_config.yaml');

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = yaml.load(content) as Partial<ExamConfig>;

    const students = config?.students || {};
    const questions = config?.questions || [];

    return {
      student_count: students.count || students.ids?.length || 0,
      question_count: questions.length || 0,
      student_ids: (students.ids || []).slice(0, 5) // First 5 as examples
    };
  } catch (error) {
    return {
      student_count: 0,
      question_count: 0,
      student_ids: []
    };
  }
}

/**
 * Build dynamic instructions for Claude Desktop (like Phase 4d)
 */
function buildInstructions(
  qFileCount: number,
  studentCount: number,
  questionCount: number,
  studentIdExamples: string[]
): string {
  return `
## Phase 6-post: Assessment Format Detection - LOAD MODE

**Q-filer:** ${qFileCount}
**Studenter:** ${studentCount}
**Frågor:** ${questionCount}
${studentIdExamples.length > 0 ? `**Student-ID exempel:** ${studentIdExamples.join(', ')}` : ''}

---

### Din uppgift:

1. **ANALYSERA ALLA Q-filer** - samples finns för varje Q-fil
   - v2 format: \`<!-- PHASE6_ASSESSMENT_START student_id="..." -->\`
   - Legacy format: \`### BEDÖMNING: ...\`

2. **IDENTIFIERA patterns** (för legacy format):
   - Header pattern (t.ex. \`### BEDÖMNING:\`)
   - Student ID pattern (regex för att extrahera ID)
   - Points pattern (regex för att extrahera poäng)

3. **⚠️ KRITISKT: VERIFIERA MOT ALLA Q-FILER**
   - Testa pattern mot Q001, Q002, Q003, Q004...
   - Om olika Q-filer har OLIKA format → rapportera detta!
   - Pattern MÅSTE fungera för ALLA filer

4. **PRESENTERA** dina findings för läraren:
   \`\`\`
   Format: legacy
   Header: ### BEDÖMNING:
   Points pattern: \\(([0-9.]+)/([0-9]+)p\\)

   Verifierat mot ALLA Q-filer:
   - Q001: ✓ 17/17 matchade
   - Q002: ✓ 17/17 matchade
   - Q003: ✓ 17/17 matchade
   - Q004: ✓ 17/17 matchade
   \`\`\`

5. **SPARA** efter lärarens godkännande:
   \`\`\`
   phase6_post_format(
     mode: "save",
     project_path: "...",
     assessment_format: { type: "legacy", ... }
   )
   \`\`\`

---

### Viktigt:
- **ANALYSERA ALLA samples** - inte bara första Q-filen
- **EN pattern för ALLA** - måste fungera för Q001-Q00N
- **VARNA om inkonsistent** - om olika Q-filer har olika format
- Fråga läraren INNAN du sparar
`.trim();
}

/**
 * Validate regex pattern is syntactically correct
 *
 * FIX: Add validation before saving patterns
 */
function validateRegexPattern(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Save format configuration to exam_config.yaml
 *
 * Supports per-question patterns for different Q-files
 */
async function saveFormatConfig(
  projectPath: string,
  format: NonNullable<Phase6PostRequest['assessment_format']>
): Promise<string> {
  const configPath = path.join(projectPath, 'exam_config.yaml');

  // Validate regex patterns before saving
  if (format.type === 'legacy') {
    if (!format.student_id_pattern || !validateRegexPattern(format.student_id_pattern)) {
      throw new Error(`Invalid student_id_pattern regex: ${format.student_id_pattern}`);
    }
    if (!format.legacy_header) {
      throw new Error('legacy_header is required for legacy format');
    }

    // Validate per-question patterns
    if (format.questions) {
      for (const [qId, qConfig] of Object.entries(format.questions)) {
        if (!validateRegexPattern(qConfig.points_pattern)) {
          throw new Error(`Invalid points_pattern for ${qId}: ${qConfig.points_pattern}`);
        }
      }
    }

    // Validate default pattern if provided
    if (format.default_points_pattern && !validateRegexPattern(format.default_points_pattern)) {
      throw new Error(`Invalid default_points_pattern: ${format.default_points_pattern}`);
    }

    // Must have either questions or default_points_pattern
    if (!format.questions && !format.default_points_pattern) {
      throw new Error('Either questions or default_points_pattern is required for legacy format');
    }
  }

  // Read existing config
  let config: any = {};
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    config = yaml.load(content) || {};
  } catch (error) {
    // Config doesn't exist yet, create new
    console.error('[Phase 6-post] Creating new exam_config.yaml');
  }

  // Add assessment_format section with per-question patterns
  config.assessment_format = {
    type: format.type,
    ...(format.type === 'legacy' ? {
      legacy_header: format.legacy_header,
      student_id_pattern: format.student_id_pattern,
      ...(format.questions ? { questions: format.questions } : {}),
      ...(format.default_points_pattern ? { default_points_pattern: format.default_points_pattern } : {})
    } : {}),
    confirmed_by: format.confirmed_by,
    confirmed_at: new Date().toISOString()
  };
  
  // Write back with error handling
  try {
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });
    
    await fs.writeFile(configPath, yamlContent, 'utf-8');
    console.error(`[Phase 6-post] Saved assessment format config to ${configPath}`);
  } catch (error) {
    throw new Error(`Failed to write config file: ${error}`);
  }
  
  return configPath;
}

/**
 * Phase 6-post: Assessment Format Detection
 * REQUIRED between Phase 6 and Phase 7
 */
export async function phase6_post_format(request: Phase6PostRequest): Promise<Phase6PostResponse> {
  const { mode, project_path } = request;
  
  // Validate project path
  const projectPath = path.resolve(project_path);
  const exists = await fs.stat(projectPath).catch(() => null);
  if (!exists?.isDirectory()) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }
  
  if (mode === 'load') {
    // LOAD mode: Return Q-files, exam_config, methodology, and instructions (like Phase 4d)
    const qFiles = await findQFiles(projectPath);

    if (qFiles.length === 0) {
      throw new Error('No Q-files found. Run Phase 6 assessment first.');
    }

    // Return first Q-file as sample (like Phase 4d returns first student)
    // Claude must verify against ALL Q-files before saving (see methodology)
    const sampleFile = qFiles[0];
    const sampleContent = await readSampleContent(sampleFile);
    const methodology = await loadMethodology();
    const examConfig = await loadExamConfig(projectPath);

    // Build dynamic instructions (like Phase 4d's buildInstructions)
    const instructions = buildInstructions(
      qFiles.length,
      examConfig.student_count,
      examConfig.question_count,
      examConfig.student_ids
    );

    // RFC-027: Log format detection load
    await safeStateOperation(
      () => logWorkflowAction(
        projectPath,
        '6-post',
        'phase6_post_format',
        'format_detection_load',
        {
          project_path: projectPath,
        },
        {
          q_file_count: qFiles.length,
          student_count: examConfig.student_count,
        }
      ),
      'phase6_post_format logWorkflowAction load'
    );

    return {
      success: true,
      mode: 'load',
      q_files: qFiles.map(f => path.basename(f)),
      sample_file: path.basename(sampleFile),
      sample_content: sampleContent,
      exam_config: examConfig,
      methodology,
      instructions
    };
  } else {
    // SAVE mode: Save configuration

    // CRITICAL: Require explicit teacher confirmation before saving
    // This prevents Claude from saving without asking the user first
    if (!request.confirmed) {
      throw new Error(
        'CONFIRMATION REQUIRED: Set confirmed=true to save.\n\n' +
        'Before saving, you MUST:\n' +
        '1. Show the detected format to the teacher\n' +
        '2. Ask "Är detta korrekt? Ska jag spara?"\n' +
        '3. Wait for explicit approval\n' +
        '4. THEN call again with confirmed=true\n\n' +
        'This ensures teacher review before any changes are written.'
      );
    }

    if (!request.assessment_format) {
      throw new Error('assessment_format is required for save mode');
    }

    const assessmentFormat = request.assessment_format;
    const configPath = await saveFormatConfig(projectPath, assessmentFormat);

    // RFC-027: Log format detection save
    await safeStateOperation(
      () => logWorkflowAction(
        projectPath,
        '6-post',
        'phase6_post_format',
        'format_detection_save',
        {
          project_path: projectPath,
          format_type: assessmentFormat.type,
        },
        {
          config_path: configPath,
          confirmed_by: assessmentFormat.confirmed_by,
        }
      ),
      'phase6_post_format logWorkflowAction save'
    );

    // RFC-029 §16.2: Track phase 6-post completion in project_state
    await safeStateOperation(
      () => markPhaseComplete(projectPath, 6, '6_post_format', {
        format_type: assessmentFormat.type,
        confirmed_by: assessmentFormat.confirmed_by,
      }),
      'phase6_post_format markPhaseComplete'
    );

    return {
      success: true,
      mode: 'save',
      config_path: configPath,
      format_saved: {
        type: assessmentFormat.type,
        confirmed_by: assessmentFormat.confirmed_by
      }
    };
  }
}

// Tool definition for MCP
export const phase6_post_format_tool = {
  name: 'phase6_post_format',
  description: `Phase 6-post: Assessment Format Detection - REQUIRED step between Phase 6 and Phase 7.

Run this AFTER completing Phase 6 assessment and BEFORE Phase 7 report generation.

TWO-PHASE WORKFLOW:
(1) LOAD mode - Returns Q-files + sample content + methodology
(2) SAVE mode - Saves detected format to exam_config.yaml (REQUIRES confirmed=true)

CRITICAL: SAVE mode requires teacher confirmation. Show format to teacher and ask before saving.

Workflow: Phase 6 (assess) → Phase 6-post (this tool) → Phase 7 (reports)`,
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['load', 'save'],
        description: 'Mode: load (get files + methodology) or save (write config)'
      },
      project_path: {
        type: 'string',
        description: 'Project directory path containing Q-files'
      },
      confirmed: {
        type: 'boolean',
        description: 'SAVE mode ONLY: Teacher has reviewed and approved format (REQUIRED for save)'
      },
      assessment_format: {
        type: 'object',
        description: 'SAVE mode: The detected format configuration',
        properties: {
          type: {
            type: 'string',
            enum: ['v2', 'legacy']
          },
          legacy_header: {
            type: 'string',
            description: 'For legacy: header pattern like "### BEDÖMNING:"'
          },
          student_id_pattern: {
            type: 'string',
            description: 'For legacy: regex to extract student_id'
          },
          questions: {
            type: 'object',
            description: 'Per-question patterns: { Q001: { points_pattern: "..." }, Q002: { ... } }',
            additionalProperties: {
              type: 'object',
              properties: {
                points_pattern: {
                  type: 'string',
                  description: 'Regex to extract points for this question'
                }
              },
              required: ['points_pattern']
            }
          },
          default_points_pattern: {
            type: 'string',
            description: 'Fallback pattern if question not in questions dict'
          },
          confirmed_by: {
            type: 'string',
            description: 'Name of person confirming format'
          }
        },
        required: ['type', 'confirmed_by']
      }
    },
    required: ['mode', 'project_path']
  }
};
