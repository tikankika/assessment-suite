import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { assessmentStart } from './tools/phase6_start.js';
import { phase6Methodology, Phase6MethodologyParams } from './tools/phase6_methodology.js';  // ADR-003
import { phase6Rubric, Phase6RubricParams } from './tools/phase6_rubric.js';  // ADR-003
import { assessmentReadNext } from './tools/phase6_read_next.js';
import { assessmentWrite } from './tools/phase6_write.js';
import { assessmentWriteFree } from './tools/phase6_write_free.js';
import { assessmentStatus } from './tools/phase6_status.js';
import { assessmentGet } from './tools/phase6_get.js';
import { assessmentDelete } from './tools/phase6_delete.js';  // RFC-025
import { teacherAnnotation, TeacherAnnotationInput, ANNOTATION_TYPES } from './tools/teacher_annotation.js';  // RFC-027
import { phase6_post_format, phase6_post_format_tool } from './tools/phase6_post_format.js';  // RFC-022
// Cross-phase tools (domain-based naming, no prefix)
import { rubricRead } from './tools/rubric_read.js';
import { rubricEdit, RubricEditInput } from './tools/rubric_edit.js';
import { writeJsonFile, WriteJsonFileInput } from './tools/json_write.js';

import { init } from './tools/init.js';
import { reflectInsights, ReflectInsightsInput } from './tools/reflect_insights.js';
import { processMemo, ProcessMemoInput } from './tools/process_memo.js';
import { reflectUncertainty, UncertaintyReviewerInput } from './reflection/uncertainty_reviewer.js';
import { reflectAspectAnalysis, ReflectAspectAnalysisInput } from './tools/reflect_aspect_analysis.js';
// Assessment Purpose (RFC-041)
import { assessmentPurpose, AssessmentPurposeInput } from './tools/assessment_purpose.js';
// Hermeneutic Circle Tool (RFC-042)
import { hermeneuticRead, HermeneuticReadInput } from './tools/hermeneutic_read.js';
// Phase 2 mechanical extraction (ADR-006: renumbered from Phase 4A/4D/4E)
import { phase2bQuestionDetection, Phase2bInput } from './tools/phase2b_questions.js';
import { phase2cAnswerBoundaries, Phase2cInput } from './tools/phase2c_boundaries.js';
import { phase2dStudents, Phase2dInput } from './tools/phase2d_students.js';
// Phase 3 annotation validation (RFC-034)
import { phase3Validate, Phase3ValidateInput } from './tools/phase3_validate.js';
// Phase 4 rubric work
import { phase4bRubricValidation, Phase4bInput } from './tools/phase4b_rubric.js';
import { phase4cSave, Phase4cSaveInput } from './tools/phase4c_save.js';
import { Assessment } from './types/assessment.js';
import { FOLDERS } from './shared/folder_constants.js';
import { enforceWorkspace } from './core/path_validator.js';
import { validateWorkspaceArg } from './core/workspace_preflight.js';

// Phase 9-12: Generic tools (RFC-030 §6.2)
import {
  genericPhaseTools,
  handlePhaseStart,
  handlePhaseComplete,
} from './tools/generic_phase_tools.js';


// Project repair tool (RFC-015)
import { projectRepairTool, handleProjectRepair } from './tools/project_repair_tool.js';

// Project status tool (RFC-013)
import { projectStatusTool, handleProjectStatus } from './tools/project_status_tool.js';

// Student report update tool (cross-phase utility for Phase 9-12)
import { studentReportUpdate, studentReportUpdateTool } from './tools/student_report_update.js';

/**
 * Assessment_MPC - MCP Server for Analytical Assessment
 *
 * Provides tools for:
 * - Phase 2: phase2b_questions, phase2c_boundaries, phase2d_students
 * - Phase 4: phase4b_rubric, phase4c_save
 * - Phase 6: phase6_start, phase6_read_next, phase6_write, phase6_write_free, phase6_status, phase6_get
 * - Meta-Reflection: reflect_insights, reflect_uncertainty, reflect_aspect_analysis
 * - Cross-phase: rubric_read, rubric_edit, json_write
 * - System: init
 *
 * @see README.md for usage instructions
 */
/**
 * Known argument names that contain file/directory paths.
 * Used for centralized workspace enforcement (RFC-035).
 */
const PATH_ARG_NAMES = [
  'project_path',
  'q_file_path',
  'rubric_path',
  'file_path',
  'assessment_path',
  'exam_path',
  'student_files_dir',
];

class AssessmentServer {
  private server: Server;
  private workspace: string;

  constructor(workspace: string) {
    this.workspace = workspace;
    this.server = new Server(
      {
        name: 'assessment-mcp-server',
        version: '0.8.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'init',
          description:
            'CALL THIS FIRST! Returns critical instructions for using MPC tools. ' +
            'You MUST follow these instructions. ' +
            'NEVER use bash/find/ls/cat. ALWAYS call MPC tools directly.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'phase6_start',
          description:
            'Phase 6: Initialize an assessment session. ' +
            'Two modes: (1) Q-file mode: pass q_file_path for traditional exams. ' +
            '(2) Per-student mode: pass student_files_dir for lab reports (one PDF/MD per student). ' +
            'IMPORTANT: After calling this, you MUST show methodology_content and rubricSection to the teacher.',
          inputSchema: {
            type: 'object',
            properties: {
              q_file_path: {
                type: 'string',
                description: 'Path to Q-file (traditional exam mode). Use this OR student_files_dir.',
              },
              student_files_dir: {
                type: 'string',
                description: 'Directory with per-student files — PDF or MD (lab report mode). Use this OR q_file_path.',
              },
              rubric_path: {
                type: 'string',
                description: 'Path to bedömningsanvisningar/rubric file',
              },
              assessor: {
                type: 'string',
                description: 'Assessor name/alias for traceability',
              },
              create_copy: {
                type: 'boolean',
                description: 'Create assessment file copy (default: true, Q-file mode only)',
              },
              assessment_title: {
                type: 'string',
                description: 'Title for the assessment (used in per-student mode)',
              },
              project_path: {
                type: 'string',
                description: 'Explicit project path (per-student mode). Use when student_files_dir is outside the project folder.',
              },
            },
            required: ['rubric_path'],
          },
        },
        {
          name: 'phase6_methodology',
          description:
            'Phase 6: Load and DISPLAY ONE methodology document at a time. ' +
            'CRITICAL: You MUST display the full document.content to the teacher! Do NOT summarize or skip. ' +
            'Start with document_index=0, SHOW full content, ask "Ok att fortsätta?", wait for response. ' +
            'Then document_index=1, SHOW full content, ask "Ok?". Only 2 docs total.',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: 'Project path (from phase6_start response)',
              },
              document_index: {
                type: 'number',
                description: '0-based index of document to load (default: 0)',
              },
              document_name: {
                type: 'string',
                description: 'Alternative: Load specific document by name',
              },
              rubric_path: {
                type: 'string',
                description: 'Path to rubric file (for bundled loading on last doc)',
              },
              question_id: {
                type: 'string',
                description: 'Question ID (for bundled rubric loading on last doc)',
              },
            },
            required: ['project_path'],
          },
        },
        {
          name: 'phase6_rubric',
          description:
            'Phase 6: Load and DISPLAY the rubric section for current question. ' +
            'CRITICAL: You MUST display the full rubric_section to the teacher! Do NOT summarize. ' +
            'Call this AFTER all methodology documents are loaded and teacher says "Ok". ' +
            'Then ask "Redo att börja bedöma?" before calling phase6_assess_student.',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: 'Project path (from phase6_start response)',
              },
              question_id: {
                type: 'string',
                description: 'Question ID (from phase6_start response, e.g., "Q1", "Q001")',
              },
              rubric_path: {
                type: 'string',
                description: 'Optional: explicit path to rubric file',
              },
            },
            required: ['project_path', 'question_id'],
          },
        },
        {
          name: 'phase6_read_next',
          description:
            'Phase 6: Read the next unassessed student. ' +
            'Q-file mode: returns student answer. Per-student mode: returns file path (Claude reads PDF directly). ' +
            'ADR-005: auto-discovered from session state.',
          inputSchema: {
            type: 'object',
            properties: {
              q_file_path: {
                type: 'string',
                description: 'Path to Q-file (optional: auto-resolved from session state)',
              },
              project_path: {
                type: 'string',
                description: 'Explicit project path (required for per-student mode if auto-discovery fails)',
              },
            },
          },
        },
        {
          name: 'phase6_write',
          description:
            'Phase 6: Write a teacher-confirmed assessment for a student. ' +
            'Inserts BEDÖMNING section, updates STATUS, returns next student.',
          inputSchema: {
            type: 'object',
            properties: {
              q_file_path: {
                type: 'string',
                description: 'Path to Q-file (optional: auto-resolved from session state)',
              },
              student_id: {
                type: 'string',
                description: 'Student ID to assess (e.g., "<id>")',
              },
              overwrite: {
                type: 'boolean',
                description: 'Set to true to replace existing BEDÖMNING (default: false)',
              },
              assessment: {
                type: 'object',
                description: 'Assessment data',
                properties: {
                  aspects: {
                    type: 'array',
                    description: 'Aspect scores',
                    items: {
                      type: 'object',
                      properties: {
                        name: {
                          type: 'string',
                          description: 'Aspect name (e.g., "6a (Riktningar)")',
                        },
                        symbol: {
                          type: 'string',
                          description: 'Quality symbol (defined by methodology)',
                        },
                        points: {
                          type: 'number',
                          description: 'Points awarded',
                        },
                        comment: {
                          type: 'string',
                          description: 'Brief explanation',
                        },
                      },
                      required: ['name', 'symbol', 'points', 'comment'],
                    },
                  },
                  totalPoints: {
                    type: 'number',
                    description: 'Sum of aspect points',
                  },
                  maxPoints: {
                    type: 'number',
                    description: 'Maximum possible points',
                  },
                  nextStep: {
                    type: 'string',
                    description: 'Forward-looking feedback (Nästa steg)',
                  },
                  comment: {
                    type: 'string',
                    description: 'Optional general comment',
                  },
                },
                required: ['aspects', 'totalPoints', 'maxPoints', 'nextStep'],
              },
            },
            required: ['student_id', 'assessment'],
          },
        },
        {
          name: 'phase6_status',
          description:
            'Phase 6: Show current assessment progress. ' +
            'Returns assessed/remaining students, statistics if partially complete. ' +
            'ADR-005: auto-discovered from session state.',
          inputSchema: {
            type: 'object',
            properties: {
              q_file_path: {
                type: 'string',
                description: 'Path to Q-file (optional: auto-resolved from session state)',
              },
              project_path: {
                type: 'string',
                description: 'Explicit project path (required for per-student mode if auto-discovery fails)',
              },
            },
          },
        },
        {
          name: 'phase6_get',
          description:
            'Phase 6: Read a specific student\'s assessment. ' +
            'Returns student answer, parsed BEDÖMNING, and raw markdown. ' +
            'Use this to view existing assessments before overwriting.',
          inputSchema: {
            type: 'object',
            properties: {
              q_file_path: {
                type: 'string',
                description: 'Path to Q-file',
              },
              student_id: {
                type: 'string',
                description: 'Student ID to retrieve (e.g., "10001")',
              },
            },
            required: ['q_file_path', 'student_id'],
          },
        },
        // RFC-025: Assessment Delete tool
        {
          name: 'assessment_delete',
          description:
            'Phase 6: Delete an existing assessment for a student. ' +
            'Use to clean up duplicates, reset for re-assessment, or fix errors. ' +
            'Does NOT write a new assessment - just removes the existing one.',
          inputSchema: {
            type: 'object',
            properties: {
              q_file_path: {
                type: 'string',
                description: 'Path to Q-file',
              },
              student_id: {
                type: 'string',
                description: 'Student ID to delete assessment for',
              },
            },
            required: ['q_file_path', 'student_id'],
          },
        },
        // RFC-027: Teacher Annotation tool for research-grade logging
        {
          name: 'teacher_annotation',
          description:
            'Research tool: Log teacher interventions during assessment. ' +
            'Use when the teacher clarifies a rubric, corrects an error, requests generous interpretation, ' +
            'adjusts a score, adds domain knowledge, revises a previous assessment, or makes calibration notes. ' +
            'Lightweight, non-blocking — just logs to workflow_log.jsonl for research analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              annotation_type: {
                type: 'string',
                enum: [...ANNOTATION_TYPES],
                description:
                  'Type of teacher intervention: ' +
                  'rubric_clarification, rubric_correction, generous_interpretation, ' +
                  'score_adjustment, context_addition, retroactive_change, ' +
                  'calibration_note, general_note',
              },
              description: {
                type: 'string',
                description: 'What the teacher said or did (free text)',
              },
              student_id: {
                type: 'string',
                description: 'Student ID if applicable',
              },
              question_id: {
                type: 'string',
                description: 'Question ID if applicable',
              },
              related_students: {
                type: 'array',
                items: { type: 'string' },
                description: 'Other student IDs affected by this annotation',
              },
              original_value: {
                type: 'string',
                description: 'Original value before teacher adjustment',
              },
              adjusted_value: {
                type: 'string',
                description: 'New value after teacher adjustment',
              },
              reasoning: {
                type: 'string',
                description: 'Teacher reasoning for the intervention',
              },
              project_path: {
                type: 'string',
                description: 'Project path (auto-derived from session if omitted)',
              },
              q_file_path: {
                type: 'string',
                description: 'Q-file path (used to derive project path if project_path omitted)',
              },
            },
            required: ['annotation_type', 'description'],
          },
        },
        // Phase 6-post: Assessment Format Detection (RFC-022)
        // REQUIRED step between Phase 6 and Phase 7
        phase6_post_format_tool,
        // Cross-phase tools (domain-based naming, no prefix)
        {
          name: 'rubric_read',
          description:
            'Read bedömningsanvisningar file directly. ' +
            'Cross-phase tool: used in Phase 4B and Phase 6. ' +
            'Returns full rubric content or specific question section.',
          inputSchema: {
            type: 'object',
            properties: {
              rubric_path: {
                type: 'string',
                description: 'Path to bedömningsanvisningar file',
              },
              question_id: {
                type: 'string',
                description: 'Optional: Question number to filter (e.g., "1", "8")',
              },
            },
            required: ['rubric_path'],
          },
        },
        {
          name: 'phase6_write_free',
          description:
            'Phase 6: Write a FREE-TEXT assessment (no structured validation). ' +
            'Use this when Claude writes assessment freely based on dialogue. ' +
            'In per-student mode: creates standalone BEDÖMNING_{student}.md file. ' +
            'Include total_points/max_points for reliable Phase 7 parsing.',
          inputSchema: {
            type: 'object',
            properties: {
              q_file_path: {
                type: 'string',
                description: 'Path to Q-file (optional: auto-resolved from session state)',
              },
              project_path: {
                type: 'string',
                description: 'Explicit project path (required for per-student mode if auto-discovery fails)',
              },
              student_id: {
                type: 'string',
                description: 'Student ID to assess (e.g., "<id>")',
              },
              bedomning_text: {
                type: 'string',
                description: 'Free-form assessment text from Claude Desktop dialogue',
              },
              total_points: {
                type: 'number',
                description: 'Total points awarded (enables machine-readable Phase 7 metadata)',
              },
              max_points: {
                type: 'number',
                description: 'Maximum possible points for this question',
              },
              overwrite: {
                type: 'boolean',
                description: 'Set to true to replace existing BEDÖMNING (default: false)',
              },
            },
            required: ['student_id', 'bedomning_text'],
          },
        },
        {
          name: 'process_memo',
          description:
            'Save a process memo: decisions, conventions, observations, or uncertainties during assessment. ' +
            'Examples: "stu1 skriver 1, istället för 1. — vi tolkar det som fråga 1", ' +
            '"Tveksam på gränsen mellan E och C för Q003a". Saves to _process_memos/ in project root.',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: 'Path to the assessment project root directory',
              },
              note: {
                type: 'string',
                description: 'Free-text memo content',
              },
              phase: {
                type: 'number',
                description: 'Optional: which phase this memo relates to (e.g. 3, 6)',
              },
              memo_type: {
                type: 'string',
                enum: ['decision', 'convention', 'observation', 'uncertainty'],
                description: 'Category: decision (explicit choice made), convention (recurring pattern established), observation (something noticed), uncertainty (doubt or question)',
              },
              related_students: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional: Student IDs this memo relates to',
              },
              related_questions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional: Question IDs (e.g., "Q001", "Q003")',
              },
            },
            required: ['project_path', 'note'],
          },
        },
        // ============================================================
        // ASSESSMENT PURPOSE (RFC-041)
        // ============================================================
        {
          name: 'assessment_purpose',
          description:
            'Declare assessment purpose and pipeline depth (RFC-041). ' +
            'Run during Phase 2, BEFORE Phase 6. The teacher states what this assessment is for ' +
            '(minitest/prov/stort_prov/tenta) and the system sets pipeline depth for Phase 9-14. ' +
            'Saves assessment_purpose.md in project root. Loaded automatically by phase_start. ' +
            'IMPORTANT: The response includes a "methodology" field with the full assessment_purpose methodology. ' +
            'You MUST read and present this methodology to the teacher IMMEDIATELY — do not skip it or summarize it on your own. ' +
            'The teacher needs to understand the touch points, levels, and pipeline configuration before proceeding.',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: 'Path to assessment project root',
              },
              level: {
                type: 'string',
                enum: ['minitest', 'prov', 'stort_prov', 'tenta'],
                description: 'Assessment level: minitest (formative quiz), prov (partial exam), stort_prov (major assessment), tenta (formal grading exam)',
              },
              purpose: {
                type: 'string',
                description: "Teacher's stated purpose in their own words — WHY this assessment exists",
              },
              pipeline: {
                type: 'object',
                description: 'Optional: override default pipeline depths per phase',
                properties: {
                  phase_9: { type: 'string', enum: ['full', 'short', 'off'] },
                  phase_10: { type: 'string', enum: ['full', 'short', 'off'] },
                  phase_11: { type: 'string', enum: ['full', 'short', 'off'] },
                  phase_12: { type: 'string', enum: ['full', 'short', 'off'] },
                  phase_13: { type: 'string', enum: ['full', 'short', 'off'] },
                  phase_14: { type: 'string', enum: ['full', 'short', 'off'] },
                },
              },
              student_exceptions: {
                type: 'array',
                description: 'Optional: students needing different depth than default',
                items: {
                  type: 'object',
                  properties: {
                    student_id: { type: 'string' },
                    level: { type: 'string', enum: ['minitest', 'prov', 'stort_prov', 'tenta'] },
                    reason: { type: 'string' },
                  },
                  required: ['student_id', 'level', 'reason'],
                },
              },
            },
            required: ['project_path', 'level', 'purpose'],
          },
        },
        // ============================================================
        // HERMENEUTIC CIRCLE TOOL (RFC-042)
        // ============================================================
        {
          name: 'hermeneutic_read',
          description:
            'Hermeneutic re-reading tool (RFC-042). Retrieves Phase 6 assessment text for specific ' +
            'questions/students and returns contextual theoretical guidance for the current phase/step. ' +
            'Use during Phase 9-14 to support Moss\'s hermeneutic circle: whole → parts → revised whole. ' +
            'Stateless utility — reads data but modifies nothing.',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: 'Path to assessment project root',
              },
              student_id: {
                type: 'string',
                description: 'Student ID (matches Complete_{studentId}.md filename)',
              },
              question_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Question IDs to retrieve (e.g., ["Q001", "Q002A"])',
              },
              phase: {
                type: 'number',
                description: 'Current phase (9-14)',
              },
              step: {
                type: 'number',
                description: 'Optional: current step within the phase (1, 2, or 3)',
              },
            },
            required: ['project_path', 'student_id', 'question_ids', 'phase'],
          },
        },
        {
          name: 'reflect_insights',
          description:
            'Meta-Reflection: Save a METAREFLEKTION (pedagogical insight, pattern explanation) to Teacher_Insights.md. ' +
            'Use when Claude Desktop spontaneously generates valuable insights during assessment dialogue. ' +
            'NOT for student progression data - that is automated in Assessment_Status_Summary.md. ' +
            'ANTI-PATTERN (per cross_phase/meta_reflection_method.md § 4.3): the content field must NOT include 5-digit student IDs ' +
            'or other per-student data. Aggregate counts ("5/8 students confused X") are required; specific IDs are forbidden. ' +
            'Per-student observations belong in Phase 9 (per-student profile), not in Teacher_Insights.md. ' +
            'See methodology/cross_phase/meta_reflection_method.md for the full anti-pattern list.',
          inputSchema: {
            type: 'object',
            properties: {
              assessment_path: {
                type: 'string',
                description: 'Path to any Q-file in the assessment folder',
              },
              insight_type: {
                type: 'string',
                enum: ['pattern', 'pedagogical', 'critical', 'summary'],
                description:
                  'Category: pattern (common errors), pedagogical (teaching recommendations), ' +
                  'critical (technical issues), summary (per-question summaries)',
              },
              content: {
                type: 'string',
                description: 'Free-text insight content from Claude Desktop. Aggregate-formulated; no per-student IDs.',
              },
              related_students: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'DEPRECATED (cross_phase/meta_reflection_method.md § 4.3): per-student data does not belong in Teacher_Insights.md. ' +
                  'The field is accepted for backwards compatibility but is IGNORED in the saved output. ' +
                  'Use Phase 9 (per-student profile) for student-specific observations.',
              },
              related_questions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional: Question numbers (e.g., "Q1", "Q3"). Questions are not student data and are emitted to the file.',
              },
            },
            required: ['assessment_path', 'insight_type', 'content'],
          },
        },
        {
          name: 'reflect_uncertainty',
          description:
            'Meta-Reflection: Create a QUALITY REVIEW document for uncertain assessments. ' +
            'Use when teacher is unsure about an assessment and needs bedömningsansvarig review. ' +
            'Creates structured document in 05_uncertainty_review/ folder with student answer, ' +
            'rubric, current assessment, and options for bedömningsansvarig to decide.',
          inputSchema: {
            type: 'object',
            properties: {
              q_file_path: {
                type: 'string',
                description: 'Path to Q-file containing the student',
              },
              student_id: {
                type: 'string',
                description: 'Student ID to review (e.g., "TestElev12")',
              },
              reason: {
                type: 'string',
                description: 'Why this assessment needs review',
              },
              detailed_analysis: {
                type: 'string',
                description: "Claude's analysis of the uncertainty",
              },
              options: {
                type: 'object',
                properties: {
                  a: {
                    type: 'object',
                    properties: {
                      description: { type: 'string' },
                      next_step: { type: 'string' },
                    },
                    required: ['description', 'next_step'],
                  },
                  b: {
                    type: 'object',
                    properties: {
                      description: { type: 'string' },
                      next_step: { type: 'string' },
                    },
                    required: ['description', 'next_step'],
                  },
                },
                required: ['a', 'b'],
                description: 'Two options for bedömningsansvarig to choose from',
              },
              comparison_students: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional: Other student IDs to compare with',
              },
              aspect_of_concern: {
                type: 'string',
                description: 'Optional: Specific aspect causing uncertainty (e.g., "1b")',
              },
            },
            required: ['q_file_path', 'student_id', 'reason', 'detailed_analysis', 'options'],
          },
        },
        {
          name: 'reflect_aspect_analysis',
          description:
            'Meta-Reflection: Generate per-aspect statistics from assessed Q-files. ' +
            'Analyzes BEDÖMNING sections to calculate mean, min, max, distribution per aspect. ' +
            'Returns raw statistics — pedagogical interpretation left to methodology/LLM.',
          inputSchema: {
            type: 'object',
            properties: {
              q_file_path: {
                type: 'string',
                description: 'Path to assessed Q-file (must have BEDÖMNING sections)',
              },
              output_format: {
                type: 'string',
                enum: ['summary', 'detailed', 'json'],
                description: 'Output format: summary (table), detailed (per-aspect breakdown), json (programmatic). Default: summary',
              },
              include_students: {
                type: 'boolean',
                description: 'Include student ID lists in detailed output (default: false)',
              },
              append_to_insights: {
                type: 'boolean',
                description: 'Append analysis to Teacher_Insights.md (default: false)',
              },
            },
            required: ['q_file_path'],
          },
        },
        {
          name: 'phase2b_questions',
          description:
            'Phase 2B: Question Detection with Methodology-Based Approach.\n\n' +
            '⚠️ KRITISKT - SINGLE MODE OBLIGATORISKT:\n' +
            'När single_mode=true (default): STANNA efter VARJE fråga!\n' +
            'Visa frågan för läraren → Vänta på bekräftelse → Fortsätt INTE automatiskt!\n\n' +
            'TWO-PHASE WORKFLOW:\n' +
            '(1) LOAD mode - Returns exam_content + methodology instructions.\n' +
            '(2) SAVE mode - After teacher verification, writes files.\n\n' +
            'VIKTIGT: Kör ALLTID single mode först för att bygga lärarens förtroende.\n' +
            'Batch mode får ENDAST användas efter explicit lärarbekräftelse.',
          inputSchema: {
            type: 'object',
            properties: {
              exam_path: {
                type: 'string',
                description: `Path to exam markdown file (e.g., ${FOLDERS.PHASE2_MARKDOWN}/exam_questions.md)`,
              },
              mode: {
                type: 'string',
                enum: ['single', 'pattern', 'batch'],
                description: 'Analysis mode: single (RECOMMENDED - one at a time), pattern, batch',
              },
              single_mode: {
                type: 'boolean',
                description: 'STOP after each question for teacher verification (default: true). Set false ONLY after teacher explicitly approves batch mode.',
              },
              question_number: {
                type: 'number',
                description: 'For single mode: which question to analyze (optional)',
              },
              save_results: {
                type: 'boolean',
                description: 'Set to true to trigger SAVE mode - writes files after verification',
              },
              project_path: {
                type: 'string',
                description: 'Project directory path (required for SAVE mode)',
              },
              questions: {
                type: 'array',
                description: 'Verified questions array (required for SAVE mode)',
              },
              detected_pattern: {
                type: 'object',
                description: 'Detected pattern info for reuse (optional for SAVE mode)',
              },
              course_code: {
                type: 'string',
                description: 'Course code (e.g. "<course-code>"). If omitted, extracted from path or set to UNKNOWN.',
              },
              exam_name: {
                type: 'string',
                description: 'Exam name (e.g. "<exam-name>"). If omitted, defaults to "Exam".',
              },
              exam_date: {
                type: 'string',
                description: 'Exam date YYYY-MM-DD (e.g. "2026-03-12"). If omitted, defaults to today.',
              },
            },
            required: ['exam_path', 'mode'],
          },
        },
        {
          name: 'phase4b_rubric',
          description:
            'Phase 4B: Rubric Validation with Methodology-Based Approach.\n\n' +
            '⚠️ KRITISKT - SINGLE MODE OBLIGATORISKT:\n' +
            'När single_mode=true (default): STANNA efter VARJE rubrik-matchning!\n' +
            'Visa matchningen för läraren → Vänta på bekräftelse → Fortsätt INTE automatiskt!\n\n' +
            'TWO-PHASE WORKFLOW:\n' +
            '(1) LOAD mode - Returns rubric_content + exam_questions + methodology.\n' +
            '(2) SAVE mode - After teacher verification, updates exam_config.yaml.\n\n' +
            'VIKTIGT: Kör ALLTID single mode först för att bygga lärarens förtroende.\n' +
            'Batch mode får ENDAST användas efter explicit lärarbekräftelse.',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: 'Project directory path containing exam_config.yaml and rubric',
              },
              mode: {
                type: 'string',
                enum: ['single', 'preview', 'batch'],
                description: 'Analysis mode: single (RECOMMENDED - one at a time), preview (first question) or batch (all)',
              },
              single_mode: {
                type: 'boolean',
                description: 'STOP after each rubric match for teacher verification (default: true). Set false ONLY after teacher explicitly approves batch mode.',
              },
              question_index: {
                type: 'number',
                description: 'For single mode: which question to validate (0-indexed). Response includes next_question_index for iteration.',
              },
              save_results: {
                type: 'boolean',
                description: 'Set to true to trigger SAVE mode - updates exam_config.yaml',
              },
              validated_questions: {
                type: 'array',
                description: 'Verified questions with rubric data (required for SAVE mode)',
              },
            },
            required: ['project_path', 'mode'],
          },
        },
        {
          name: 'rubric_edit',
          description:
            'Edit rubric aspects - Update max points or criteria text.\n\n' +
            'Cross-phase tool: used in Phase 4B and Phase 6.\n' +
            'Use when the teacher notices an error in the rubric during validation or assessment.\n' +
            'Features:\n' +
            '- Updates max points for an aspect\n' +
            '- Updates criteria text\n' +
            '- Syncs changes to exam_config.yaml\n' +
            '- Creates backup before modification\n' +
            '- Logs changes for audit trail\n' +
            '- Warns about students already assessed with old criteria',
          inputSchema: {
            type: 'object',
            properties: {
              rubric_path: {
                type: 'string',
                description: 'Path to bedömningsanvisningar markdown file',
              },
              exam_config_path: {
                type: 'string',
                description: 'Optional: Path to exam_config.yaml for sync',
              },
              question_id: {
                type: 'string',
                description: 'Question identifier (e.g., "E4", "6", "Q001")',
              },
              updates: {
                type: 'object',
                properties: {
                  aspect_name: {
                    type: 'string',
                    description: 'Aspect to update (e.g., "E4a", "6b")',
                  },
                  new_max_points: {
                    type: 'number',
                    description: 'New max points for this aspect',
                  },
                  new_criteria: {
                    type: 'string',
                    description: 'New criteria text for this aspect',
                  },
                },
                required: ['aspect_name'],
                description: 'Updates to apply (at least one of new_max_points or new_criteria required)',
              },
              reason: {
                type: 'string',
                description: 'Required: Why the change is being made (for audit trail)',
              },
              q_file_path: {
                type: 'string',
                description: 'Optional: Path to Q-file to check affected students',
              },
              sync_config: {
                type: 'boolean',
                description: 'Sync changes to exam_config.yaml (default: true)',
              },
            },
            required: ['rubric_path', 'question_id', 'updates', 'reason'],
          },
        },
        {
          name: 'phase4c_save',
          description:
            'Phase 4C: Save Configuration - Per-student completion overview. ' +
            'TWO-PHASE WORKFLOW: ' +
            '(1) LOAD mode - Returns student_files + methodology. ' +
            'Claude analyzes each student file to identify answered questions and word counts. ' +
            '(2) SAVE mode - Writes student_report.md with completion status per student. ' +
            'Flags short answers: ⚠️ 30-39 words, ❌ <30 words.',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: `Project directory path containing ${FOLDERS.PHASE2_MARKDOWN}/student_answers/`,
              },
              mode: {
                type: 'string',
                enum: ['load', 'save'],
                description: 'Mode: load (get files + methodology) or save (write report)',
              },
              report_content: {
                type: 'string',
                description: 'SAVE mode: The complete student report markdown content',
              },
            },
            required: ['project_path', 'mode'],
          },
        },
        {
          name: 'phase2c_boundaries',
          description:
            'Phase 2C: Answer Boundary Detection - Per-QUESTION markers. ' +
            'KEY INSIGHT: Markers are SAME for all students per question! ' +
            'TWO-PHASE WORKFLOW: ' +
            '(1) LOAD mode - Returns student_files + exam_config + methodology. ' +
            'Claude identifies start/end markers for each question, then verifies across ALL students. ' +
            '(2) SAVE mode - Writes answer_boundaries section to exam_config.yaml. ' +
            'Modes: load (first student), preview (first question), batch (all questions). ' +
            'Handles Inspera patterns: Swedish (Skriv ditt svar här.../Ord:) and English (Write your answer here.../Words:).',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: 'Project directory path containing exam_config.yaml and student_answers/',
              },
              mode: {
                type: 'string',
                enum: ['load', 'preview', 'batch', 'save'],
                description: 'Mode: load (get files), preview (first question), batch (all questions), save (write boundaries)',
              },
              answer_boundaries: {
                type: 'object',
                description: 'SAVE mode: The answer_boundaries config object with global markers and per-question boundaries',
              },
            },
            required: ['project_path', 'mode'],
          },
        },
        {
          name: 'phase2d_students',
          description:
            'Phase 2D: Student Discovery - Discovers and registers student IDs. ' +
            `Scans student markdown files (${FOLDERS.PHASE2_MARKDOWN}/student_answers/) OR existing Q-files. ` +
            'TWO-PHASE WORKFLOW: ' +
            '(1) DISCOVER mode - Extracts student IDs and detects ID format pattern. ' +
            '(2) SAVE mode - Writes students section to exam_config.yaml. ' +
            'Use from_qfiles=true for existing projects where Phase 5-6 are already complete.',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: 'Project directory path containing student files or Q-files',
              },
              mode: {
                type: 'string',
                enum: ['discover', 'save'],
                description: 'Mode: discover (extract student IDs) or save (write to config)',
              },
              from_qfiles: {
                type: 'boolean',
                description: 'Extract from Q-files instead of student files (default: false)',
              },
              students: {
                type: 'object',
                description: 'SAVE mode: Students config object to save',
                properties: {
                  count: { type: 'number' },
                  id_format: { type: 'string' },
                  id_pattern: { type: 'string' },
                  id_examples: { type: 'array', items: { type: 'string' } },
                  ids: { type: 'array', items: { type: 'string' } },
                  source: { type: 'string', enum: ['student_files', 'q_files'] },
                },
              },
            },
            required: ['project_path', 'mode'],
          },
        },
        {
          name: 'phase3_validate',
          description:
            'Phase 3: Validate student answer annotations (RFC-034). ' +
            'Mechanical checks — no AI needed. ' +
            'Validates annotated files in 03_material/student_answers/ against originals in 02_markdown/student_answers/. ' +
            'Checks: marker completeness, placement, text preservation, nesting, no text outside markers. ' +
            'Run after annotating each student file or after a batch.',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: 'Project directory path containing exam_config.yaml',
              },
              student_id: {
                type: 'string',
                description: 'Validate single student (default: all students)',
              },
            },
            required: ['project_path'],
          },
        },
        {
          name: 'json_write',
          description:
            'Write JSON data to a file on the Mac filesystem. ' +
            'Cross-phase tool: use when you need to save analysis results. ' +
            'Solves the parameter size limit problem.',
          inputSchema: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'Full path where to write the file',
              },
              data: {
                type: 'object',
                description: 'JSON data to write (any structure)',
              },
              pretty: {
                type: 'boolean',
                description: 'Pretty print JSON (default: true)',
              },
            },
            required: ['file_path', 'data'],
          },
        },
        // ============================================================
        // PHASE 9-12: GENERIC TOOLS (RFC-030 §6.2)
        // ============================================================
        ...genericPhaseTools,
        // ============================================================
        // PROJECT REPAIR (RFC-015)
        // ============================================================
        {
          name: 'project_repair',
          description:
            'Fix path portability issues in an assessment project (RFC-015). ' +
            'Converts absolute paths (e.g., /Users/username/...) to relative paths, ' +
            'enabling projects to be shared across different machines. ' +
            'Use dry_run=true to preview changes without applying them.',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: 'Path to assessment project root (where project_state.json is located)',
              },
              dry_run: {
                type: 'boolean',
                description: 'If true, report what would be changed without applying changes (default: false)',
              },
            },
            required: ['project_path'],
          },
        },
        // ============================================================
        // PROJECT STATUS (RFC-013)
        // ============================================================
        {
          name: 'project_status',
          description:
            'Get comprehensive status of an assessment project (RFC-013: Session Continuity). ' +
            'Shows project overview, phase completion, Q-file progress, active sessions, ' +
            'source file locations, and recommendations. Use this when resuming a project.',
          inputSchema: {
            type: 'object',
            properties: {
              project_path: {
                type: 'string',
                description: 'Path to assessment project root (where project_state.json is located)',
              },
            },
            required: ['project_path'],
          },
        },

        // ============================================================
        // CROSS-PHASE UTILITY TOOLS
        // ============================================================
        studentReportUpdateTool,
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // RFC-035: Enforce workspace boundary for all path arguments
        if (args && typeof args === 'object') {
          for (const argName of PATH_ARG_NAMES) {
            const value = (args as Record<string, unknown>)[argName];
            if (typeof value === 'string') {
              enforceWorkspace(value, this.workspace, { tool: name, argName });
            }
          }
        }

        let result: unknown;

        switch (name) {
          case 'init':
            result = await init();
            break;

          case 'phase6_start':
            result = await assessmentStart(
              args as {
                q_file_path: string;
                rubric_path: string;
                assessor?: string;
                create_copy?: boolean;
              }
            );
            break;

          case 'phase6_methodology':
            result = await phase6Methodology(args as unknown as Phase6MethodologyParams);
            break;

          case 'phase6_rubric':
            result = await phase6Rubric(args as unknown as Phase6RubricParams);
            break;

          case 'phase6_read_next':
            result = await assessmentReadNext(
              args as { q_file_path: string }
            );
            break;

          case 'phase6_write':
            result = await assessmentWrite(
              args as {
                q_file_path?: string;
                student_id: string;
                assessment: Assessment;
                overwrite?: boolean;
              }
            );
            break;

          case 'phase6_status':
            result = await assessmentStatus(
              args as { q_file_path: string }
            );
            break;

          case 'phase6_get':
            result = await assessmentGet(
              args as { q_file_path: string; student_id: string }
            );
            break;

          case 'assessment_delete':
            result = await assessmentDelete(
              args as { q_file_path: string; student_id: string }
            );
            break;

          case 'teacher_annotation':
            result = await teacherAnnotation(
              args as unknown as TeacherAnnotationInput
            );
            break;

          case 'phase6_post_format':
            result = await phase6_post_format(
              args as {
                mode: 'load' | 'save';
                project_path: string;
                assessment_format?: {
                  type: 'v2' | 'legacy';
                  legacy_header?: string;
                  student_id_pattern?: string;
                  points_pattern?: string;
                  confirmed_by: string;
                };
              }
            );
            break;

          // Cross-phase tools (domain-based naming)
          case 'rubric_read':
            result = await rubricRead(
              args as { rubric_path: string; question_id?: string }
            );
            break;

          case 'phase6_write_free':
            result = await assessmentWriteFree(
              args as {
                q_file_path?: string;
                student_id: string;
                bedomning_text: string;
                total_points?: number;
                max_points?: number;
                overwrite?: boolean;
              }
            );
            break;

          case 'process_memo':
            result = await processMemo(args as unknown as ProcessMemoInput);
            break;

          case 'assessment_purpose':
            result = await assessmentPurpose(args as unknown as AssessmentPurposeInput);
            break;

          case 'hermeneutic_read':
            result = await hermeneuticRead(args as unknown as HermeneuticReadInput);
            break;

          case 'reflect_insights':
            result = await reflectInsights(args as unknown as ReflectInsightsInput);
            break;

          case 'reflect_uncertainty':
            result = await reflectUncertainty(args as unknown as UncertaintyReviewerInput);
            break;

          case 'reflect_aspect_analysis':
            result = await reflectAspectAnalysis(args as unknown as ReflectAspectAnalysisInput);
            break;

          // Phase 2: Mechanical extraction (ADR-006)
          case 'phase2b_questions':
            result = await phase2bQuestionDetection(args as unknown as Phase2bInput);
            break;

          case 'phase2c_boundaries':
            result = await phase2cAnswerBoundaries(args as unknown as Phase2cInput);
            break;

          case 'phase2d_students':
            result = await phase2dStudents(args as unknown as Phase2dInput);
            break;

          // Phase 3: Annotation validation (RFC-034)
          case 'phase3_validate':
            result = await phase3Validate(args as unknown as Phase3ValidateInput);
            break;

          // Phase 4: Rubric work (ADR-006)
          case 'phase4b_rubric':
            result = await phase4bRubricValidation(args as unknown as Phase4bInput);
            break;

          case 'rubric_edit':
            result = await rubricEdit(args as unknown as RubricEditInput);
            break;

          case 'phase4c_save':
            result = await phase4cSave(args as unknown as Phase4cSaveInput);
            break;

          case 'json_write':
            result = await writeJsonFile(args as unknown as WriteJsonFileInput);
            break;

          // ============================================================
          // PHASE 9-12: GENERIC TOOLS (RFC-030 §6.2)
          // ============================================================
          case 'phase_start':
            result = await handlePhaseStart(
              args as { phase: number; project_path: string; student_id: string }
            );
            break;

          case 'phase_complete':
            result = await handlePhaseComplete(
              args as { session_id: string; content: string }
            );
            break;

          // ============================================================
          // PROJECT REPAIR (RFC-015)
          // ============================================================
          case 'project_repair':
            result = await handleProjectRepair(
              args as { project_path: string; dry_run?: boolean }
            );
            break;

          // ============================================================
          // PROJECT STATUS (RFC-013)
          // ============================================================
          case 'project_status':
            result = await handleProjectStatus(
              args as { project_path: string }
            );
            break;

          // ============================================================
          // CROSS-PHASE UTILITY TOOLS
          // ============================================================
          case 'student_report_update':
            result = await studentReportUpdate(
              args as {
                project_path: string;
                student_id: string;
                phase: 9 | 10 | 11 | 12;
                content: string;
                section_title?: string;
                author?: string;
                change_description?: string;
              }
            );
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.error(`Tool ${name} error:`, errorMessage);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: errorMessage,
                  tool: name,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Assessment MCP Server running...');
  }
}

// Parse --workspace CLI argument (RFC-035)
const cliArgs = process.argv.slice(2);
const workspaceIdx = cliArgs.indexOf('--workspace');
const workspace = workspaceIdx >= 0 ? cliArgs[workspaceIdx + 1] : undefined;

if (!workspace) {
  console.error(
    'ERROR: --workspace argument required.\n' +
    'Assessment Suite MCP servers require a workspace boundary for security.\n' +
    'Add --workspace to your claude_desktop_config.json.\n\n' +
    'Example:\n' +
    '  "args": ["dist/server.js", "--workspace", "/path/to/assessment_workspace"]'
  );
  process.exit(1);
}

// RFC-035 §9: Pre-flight check on the workspace value before connecting.
const preflight = validateWorkspaceArg(workspace);
if (!preflight.ok) {
  console.error(`ERROR: ${preflight.error}`);
  process.exit(1);
}
if (preflight.warning) {
  console.error(`WARNING: ${preflight.warning}`);
}

// Start server
const server = new AssessmentServer(workspace);
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
