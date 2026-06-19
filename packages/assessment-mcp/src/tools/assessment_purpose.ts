/**
 * assessment_purpose — Declare assessment purpose and pipeline depth (RFC-041)
 *
 * Saves assessment_purpose.md in project root with:
 * - level (minitest/prov/stort_prov/tenta)
 * - teacher's stated purpose (free text)
 * - pipeline configuration per phase
 * - optional per-student exceptions
 *
 * Loaded automatically by phase_start for Phase 9-14.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import {
  deriveProjectPath,
  logWorkflowAction,
  safeStateOperation,
} from '../shared/project_state_manager.js';
import { methodologyLoader } from '../core/methodology_loader.js';

// ============================================================
// TYPES
// ============================================================

export type AssessmentLevel = 'minitest' | 'prov' | 'stort_prov' | 'tenta';
export type PhaseDepth = 'full' | 'short' | 'off';

export interface PipelineConfig {
  phase_9: PhaseDepth;
  phase_10: PhaseDepth;
  phase_11: PhaseDepth;
  phase_12: PhaseDepth;
  phase_13: PhaseDepth;
  phase_14: PhaseDepth;
}

export interface StudentException {
  student_id: string;
  level: AssessmentLevel;
  reason: string;
}

export interface AssessmentPurposeInput {
  project_path: string;
  level: AssessmentLevel;
  purpose: string;
  pipeline?: Partial<PipelineConfig>;
  student_exceptions?: StudentException[];
}

export interface AssessmentPurposeResult {
  success: boolean;
  file_path: string;
  level: AssessmentLevel;
  pipeline: PipelineConfig;
  methodology: string;
}

// ============================================================
// DEFAULT PIPELINE PER LEVEL
// ============================================================

const DEFAULT_PIPELINES: Record<AssessmentLevel, PipelineConfig> = {
  minitest: {
    phase_9: 'short',
    phase_10: 'off',
    phase_11: 'off',
    phase_12: 'short',
    phase_13: 'short',
    phase_14: 'short',
  },
  prov: {
    phase_9: 'full',
    phase_10: 'short',
    phase_11: 'off',
    phase_12: 'short',
    phase_13: 'full',
    phase_14: 'full',
  },
  stort_prov: {
    phase_9: 'full',
    phase_10: 'full',
    phase_11: 'off',
    phase_12: 'full',
    phase_13: 'full',
    phase_14: 'full',
  },
  tenta: {
    phase_9: 'full',
    phase_10: 'full',
    phase_11: 'full',
    phase_12: 'full',
    phase_13: 'full',
    phase_14: 'full',
  },
};

// ============================================================
// HANDLER
// ============================================================

export async function assessmentPurpose(
  args: AssessmentPurposeInput,
): Promise<AssessmentPurposeResult> {
  const { project_path, level, purpose, pipeline, student_exceptions } = args;

  if (!purpose || purpose.trim().length === 0) {
    throw new Error('Purpose text is required — the teacher must state what this assessment is for.');
  }

  const stateProjectPath = await deriveProjectPath(project_path);
  const projectRoot = stateProjectPath || project_path;

  // Merge defaults with overrides
  const defaultPipeline = DEFAULT_PIPELINES[level];
  const finalPipeline: PipelineConfig = {
    ...defaultPipeline,
    ...pipeline,
  };

  // Build markdown
  const date = new Date().toISOString().split('T')[0];
  const lines: string[] = [];

  lines.push('---');
  lines.push('type: assessment_purpose');
  lines.push(`created: ${new Date().toISOString()}`);
  lines.push(`level: ${level}`);
  lines.push('pipeline:');
  for (const [key, val] of Object.entries(finalPipeline)) {
    lines.push(`  ${key}: ${val}`);
  }
  if (student_exceptions?.length) {
    lines.push('student_exceptions:');
    for (const exc of student_exceptions) {
      lines.push(`  - student_id: "${exc.student_id}"`);
      lines.push(`    level: ${exc.level}`);
      lines.push(`    reason: "${exc.reason}"`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push('# ASSESSMENT PURPOSE');
  lines.push('');
  lines.push(`## Touch Point 1: Deklaration (${date})`);
  lines.push('');
  lines.push(`**Bedömningstyp:** ${level}`);
  lines.push(`**Syfte:** ${purpose.trim()}`);
  lines.push('');
  lines.push('### Pipeline-konfiguration');
  lines.push('');
  lines.push('| Fas | Djup |');
  lines.push('|-----|------|');
  lines.push(`| Phase 9 | ${finalPipeline.phase_9} |`);
  lines.push(`| Phase 10 | ${finalPipeline.phase_10} |`);
  lines.push(`| Phase 11 | ${finalPipeline.phase_11} |`);
  lines.push(`| Phase 12 | ${finalPipeline.phase_12} |`);
  lines.push(`| Phase 13 | ${finalPipeline.phase_13} |`);
  lines.push(`| Phase 14 | ${finalPipeline.phase_14} |`);

  if (student_exceptions?.length) {
    lines.push('');
    lines.push('### Individuella undantag');
    lines.push('');
    lines.push('| Student | Djup | Anledning |');
    lines.push('|---------|------|-----------|');
    for (const exc of student_exceptions) {
      lines.push(`| ${exc.student_id} | ${exc.level} | ${exc.reason} |`);
    }
  }

  lines.push('');

  const filePath = join(projectRoot, 'assessment_purpose.md');
  await fs.writeFile(filePath, lines.join('\n'), 'utf-8');

  // Load methodology for Claude Desktop
  const methodology = await methodologyLoader.loadAssessmentPurposeMethodology();

  // Log to workflow_log
  if (stateProjectPath) {
    await safeStateOperation(
      () => logWorkflowAction(
        stateProjectPath,
        2,
        'assessment_purpose',
        'purpose_declared',
        { level, purpose_length: purpose.length },
        {
          saved_to: filePath,
          pipeline: finalPipeline,
          student_exceptions: student_exceptions?.length || 0,
        },
      ),
      'assessment_purpose logWorkflowAction',
    );
  }

  return {
    success: true,
    file_path: filePath,
    level,
    pipeline: finalPipeline,
    methodology,
  };
}
