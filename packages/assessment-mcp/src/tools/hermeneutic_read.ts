/**
 * hermeneutic_read - RFC-042: Hermeneutic Circle Tool
 *
 * Retrieves Phase 6 assessment text for specific questions/students
 * and returns contextual theoretical guidance for the current phase/step.
 *
 * Combines two functions:
 * 1. Structured re-reading of Phase 6 assessments (Moss's hermeneutic circle)
 * 2. Contextual theoretical questions from hermeneutic_guidance.md
 *
 * Stateless utility — reads data but modifies nothing.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { methodologyLoader } from '../core/methodology_loader.js';
import { escapeRegex } from '../utils/regex_utils.js';
import { assertSafeIdentifier } from '../core/path_validator.js';

// ── Types ───────────────────────────────────────────────────────────

export interface HermeneuticReadInput {
  project_path: string;
  student_id: string;
  question_ids: string[];
  phase: number;
  step?: number;
}

export interface HermeneuticReadResult {
  success: boolean;
  student_id: string;
  assessment_texts: Record<string, string | null>;
  guidance: string;
  message: string;
}

// ── Complete file parsing ───────────────────────────────────────────

/**
 * Extract Phase 6 assessment sections for specific questions from a
 * Complete_{studentId}.md file.
 *
 * Questions are delimited by `### Fråga {QXXX}` headings and `---` separators.
 * Returns null for questions not found in the file.
 */
function extractQuestionAssessments(
  content: string,
  questionIds: string[],
): Record<string, string | null> {
  const results: Record<string, string | null> = {};

  for (const qid of questionIds) {
    // Match from "### Fråga QXXX" to the next "---" or next "### Fråga"
    const pattern = new RegExp(
      `### Fråga ${escapeRegex(qid)}\\b([\\s\\S]*?)(?=\\n---\\s*\\n|### Fråga \\S|$)`,
      'i',
    );
    const match = content.match(pattern);
    results[qid] = match ? `### Fråga ${qid}${match[1].trim()}` : null;
  }

  return results;
}

// ── Guidance extraction ─────────────────────────────────────────────

/**
 * Extract the relevant section from hermeneutic_guidance.md for a given
 * phase and optional step.
 *
 * Sections are delimited by `## Phase {N}` headings.
 * Steps are delimited by `### STEG {N}` or `### DEL {N}` headings.
 */
function extractGuidanceSection(
  guidance: string,
  phase: number,
  step?: number,
): string {
  // Extract the phase section
  const phasePattern = new RegExp(
    `## (?:Phase|Fas) ${phase}[:\\s—–-][^\\n]*\\n([\\s\\S]*?)(?=\\n## (?:Phase|Fas) \\d|\\n## Design|$)`,
    'i',
  );
  const phaseMatch = guidance.match(phasePattern);

  if (!phaseMatch) {
    return `[Ingen vägledning hittades för fas ${phase}]`;
  }

  const phaseContent = phaseMatch[0];

  // If no specific step requested, return the whole phase section
  if (!step) {
    return phaseContent.trim();
  }

  // Extract specific step/del
  const stepPattern = new RegExp(
    `### (?:STEG|DEL) ${step}[:\\s—–-][^\\n]*\\n([\\s\\S]*?)(?=\\n### (?:STEG|DEL) \\d|\\n## |$)`,
    'i',
  );
  const stepMatch = phaseContent.match(stepPattern);

  if (stepMatch) {
    return stepMatch[0].trim();
  }

  // Fallback: return full phase section if step not found
  return phaseContent.trim() + `\n\n*[STEG ${step} ej specificerat — visar hela fasen]*`;
}

// ── Main handler ────────────────────────────────────────────────────

export async function hermeneuticRead(
  input: HermeneuticReadInput,
): Promise<HermeneuticReadResult> {
  const { project_path, student_id, question_ids, phase, step } = input;

  // Validate phase range
  if (phase < 9 || phase > 14) {
    return {
      success: false,
      student_id,
      assessment_texts: {},
      guidance: '',
      message: `Fas ${phase} är utanför räckvidden (9-14)`,
    };
  }

  // Security: student_id is interpolated into the path below and is not a
  // PATH_ARG_NAME, so reject traversal here. (Vuln 3, RFC-035 gap.)
  try {
    assertSafeIdentifier(student_id, 'student_id');
  } catch (err) {
    return {
      success: false,
      student_id,
      assessment_texts: {},
      guidance: '',
      message: (err as Error).message,
    };
  }

  // 1. Read Complete_{studentId}.md
  const completePath = join(
    project_path,
    'complete_assessment',
    `Complete_${student_id}.md`,
  );

  let completeContent: string;
  try {
    completeContent = await fs.readFile(completePath, 'utf-8');
  } catch {
    return {
      success: false,
      student_id,
      assessment_texts: {},
      guidance: '',
      message: `Kunde inte läsa ${completePath}`,
    };
  }

  // 2. Extract per-question assessment texts
  const assessmentTexts = extractQuestionAssessments(
    completeContent,
    question_ids,
  );

  // 3. Load hermeneutic guidance via MethodologyLoader
  const loader = methodologyLoader;
  const fullGuidance = await loader.loadHermeneuticGuidance();

  // 4. Extract relevant section for phase/step
  const guidance = extractGuidanceSection(fullGuidance, phase, step);

  const foundCount = Object.values(assessmentTexts).filter(
    (v) => v !== null,
  ).length;

  return {
    success: true,
    student_id,
    assessment_texts: assessmentTexts,
    guidance,
    message:
      `Hämtade ${foundCount}/${question_ids.length} bedömningar för elev ${student_id}. ` +
      `Vägledning för fas ${phase}${step ? ` steg ${step}` : ''} inkluderad.`,
  };
}
