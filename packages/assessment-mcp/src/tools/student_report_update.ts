/**
 * student_report_update - MCP tool for updating student reports
 *
 * Exposes the existing updateStudentReportSection() utility as an MCP tool.
 * Updates BOTH files for Phase 9-12:
 * - complete_assessment/Complete_{student}.md (progressive report)
 * - Phase-specific file (09_qualitative/, 10_extrapolation/, etc.)
 *
 * Use cases:
 * - Teacher discusses changes in chat → Claude generates content → tool writes to BOTH files
 * - Add summary section after Phase 12 complete
 * - Update any phase section based on dialog
 */

import { join } from 'path';
import { promises as fs } from 'fs';
import {
  updateStudentReportSection,
  UpdateResult,
} from '../utils/student_report_updater.js';
import { FOLDERS } from '../shared/folder_constants.js';
import {
  logWorkflowAction,
  safeStateOperation,
} from '../shared/project_state_manager.js';
import { assertSafeIdentifier } from '../core/path_validator.js';

// ============================================================
// TYPES
// ============================================================

export interface StudentReportUpdateRequest {
  project_path: string;
  student_id: string;
  phase: 9 | 10 | 11 | 12;
  section_title?: string;
  content: string;
  author?: string;
  change_description?: string;
}

export interface StudentReportUpdateResponse {
  success: boolean;
  action: 'created' | 'replaced' | 'appended';
  report_path: string;
  phase_file_path: string;
  phase_id: string;
  complete_updated: boolean;
  phase_file_updated: boolean;
  error?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_SECTION_TITLES: Record<number, string> = {
  9: 'DEL 2: KVALITATIV GENERALISERING',
  10: 'DEL 3: EXTRAPOLERING TILL LÄRANDEMÅL',
  11: 'DEL 4: BETYGSBESLUT',
  12: 'DEL 5: ÅTERKOPPLING TILL ELEV',
};

// Phase-specific file paths
const PHASE_FILE_PATHS: Record<number, { dir: string; prefix: string; suffix: string }> = {
  9: { dir: FOLDERS.PHASE9_QUALITATIVE, prefix: 'Student_', suffix: '_generalization.md' },
  10: { dir: FOLDERS.PHASE10_EXTRAPOLATION, prefix: 'Student_', suffix: '_extrapolation.md' },
  11: { dir: FOLDERS.PHASE11_GRADING, prefix: 'Student_', suffix: '_grade_decision.md' },
  12: { dir: FOLDERS.PHASE12_FEEDBACK, prefix: 'Student_', suffix: '_feedback.md' },
};

// ============================================================
// MAIN FUNCTION
// ============================================================

export async function studentReportUpdate(
  request: StudentReportUpdateRequest
): Promise<StudentReportUpdateResponse> {
  const {
    project_path,
    student_id,
    phase,
    section_title,
    content,
    author = 'Claude + Lärare',
    change_description,
  } = request;

  // Validate phase
  if (![9, 10, 11, 12].includes(phase)) {
    return {
      success: false,
      action: 'created',
      report_path: '',
      phase_file_path: '',
      phase_id: '',
      complete_updated: false,
      phase_file_updated: false,
      error: `Invalid phase: ${phase}. Must be 9, 10, 11, or 12.`,
    };
  }

  // Security: student_id is interpolated into both file paths below and is not
  // a PATH_ARG_NAME, so reject traversal here. (Vuln 2, RFC-035 gap.)
  try {
    assertSafeIdentifier(student_id, 'student_id');
  } catch (err) {
    return {
      success: false,
      action: 'created',
      report_path: '',
      phase_file_path: '',
      phase_id: '',
      complete_updated: false,
      phase_file_updated: false,
      error: (err as Error).message,
    };
  }

  // Build paths and identifiers
  const phaseId = `PHASE_${phase}`;
  const title = section_title || DEFAULT_SECTION_TITLES[phase];

  // Path to Complete_ file
  const completePath = join(
    project_path,
    FOLDERS.COMPLETE_ASSESSMENT,
    `Complete_${student_id}.md`
  );

  // Path to phase-specific file
  const phaseConfig = PHASE_FILE_PATHS[phase];
  const phaseFilePath = join(
    project_path,
    phaseConfig.dir,
    `${phaseConfig.prefix}${student_id}${phaseConfig.suffix}`
  );

  let completeUpdated = false;
  let phaseFileUpdated = false;
  const errors: string[] = [];

  // 1. Update Complete_ file (using existing utility)
  const completeResult: UpdateResult = await updateStudentReportSection({
    reportPath: completePath,
    phaseId,
    sectionTitle: title,
    content,
    author,
    changeDescription: change_description || `Uppdaterade ${title}`,
  });

  if (completeResult.success) {
    completeUpdated = true;
  } else {
    errors.push(`Complete file: ${completeResult.error}`);
  }

  // 2. Update phase-specific file (append/replace summary section)
  try {
    const phaseFileExists = await fs.access(phaseFilePath).then(() => true).catch(() => false);

    if (phaseFileExists) {
      let phaseContent = await fs.readFile(phaseFilePath, 'utf-8');

      // For Phase 12 feedback files, replace the SAMMANFATTNING section
      if (phase === 12) {
        const summaryMarker = '---\n\n## SAMMANFATTNING';
        const newSummaryMarker = '---\n\n## 🎯 SAMMANFATTNING';

        if (phaseContent.includes(summaryMarker) || phaseContent.includes(newSummaryMarker)) {
          // Replace old summary with new content
          const markerToUse = phaseContent.includes(newSummaryMarker) ? newSummaryMarker : summaryMarker;
          const beforeSummary = phaseContent.split(markerToUse)[0];
          phaseContent = beforeSummary.trimEnd() + '\n\n---\n\n' + content.trim() + '\n';
        } else {
          // Append at end
          phaseContent = phaseContent.trimEnd() + '\n\n---\n\n' + content.trim() + '\n';
        }
      } else {
        // For other phases, append content at end
        phaseContent = phaseContent.trimEnd() + '\n\n---\n\n' + content.trim() + '\n';
      }

      await fs.writeFile(phaseFilePath, phaseContent, 'utf-8');
      phaseFileUpdated = true;
    } else {
      errors.push(`Phase file not found: ${phaseFilePath}`);
    }
  } catch (err) {
    errors.push(`Phase file error: ${err}`);
  }

  // RFC-030 B10: Log to workflow_log for audit trail
  if (completeUpdated || phaseFileUpdated) {
    await safeStateOperation(
      () => logWorkflowAction(
        project_path,
        phase,
        'student_report_update',
        'report_section_update',
        {
          student_id,
          phase_id: phaseId,
          section_title: title,
        },
        {
          complete_updated: completeUpdated,
          phase_file_updated: phaseFileUpdated,
          action: completeResult.action,
          content_length: content.length,
        }
      ),
      'student_report_update logWorkflowAction'
    );
  }

  return {
    success: completeUpdated || phaseFileUpdated,
    action: completeResult.action,
    report_path: completePath,
    phase_file_path: phaseFilePath,
    phase_id: phaseId,
    complete_updated: completeUpdated,
    phase_file_updated: phaseFileUpdated,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

// ============================================================
// MCP TOOL DEFINITION
// ============================================================

export const studentReportUpdateTool = {
  name: 'student_report_update',
  description: `Update BOTH student report files for Phase 9-12.

Updates TWO files simultaneously:
1. complete_assessment/Complete_{student}.md (progressive report)
2. Phase-specific file:
   - Phase 9: 09_qualitative/Student_*_generalization.md
   - Phase 10: 10_extrapolation/Student_*_extrapolation.md
   - Phase 11: 11_grading/Student_*_grade_decision.md
   - Phase 12: 12_feedback/Student_*_feedback.md

Use this tool to:
- Add or update Phase 9-12 sections based on chat dialog
- Add summary after phase complete
- Make corrections to previously generated content

The tool automatically:
- Updates Complete_ file using PHASE_X markers
- Updates phase-specific file (replaces summary section for Phase 12)
- Updates changelog in Complete_ file`,
  inputSchema: {
    type: 'object',
    properties: {
      project_path: {
        type: 'string',
        description: 'Path to project root directory',
      },
      student_id: {
        type: 'string',
        description: 'Student identifier (e.g., "<id>")',
      },
      phase: {
        type: 'number',
        enum: [9, 10, 11, 12],
        description: 'Phase number (9, 10, 11, or 12)',
      },
      content: {
        type: 'string',
        description: 'Markdown content to write to the section',
      },
      section_title: {
        type: 'string',
        description: 'Optional custom section title (default based on phase)',
      },
      author: {
        type: 'string',
        description: 'Author for changelog (default: "Claude + Lärare")',
      },
      change_description: {
        type: 'string',
        description: 'Description of the change for changelog',
      },
    },
    required: ['project_path', 'student_id', 'phase', 'content'],
  },
};
