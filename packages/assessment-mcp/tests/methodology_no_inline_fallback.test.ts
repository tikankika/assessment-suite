import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { MethodologyLoader } from '../src/core/methodology_loader.js';

// The methodology documents are the source of truth (code-as-plumber rule).
// When one cannot be loaded, each loader must stop and name the missing file,
// not continue with instructions written into the code.

const LOADERS: Array<[keyof MethodologyLoader, string]> = [
  ['loadPhase2B', 'technical/phase2b_question_detection.md'],
  ['loadPhase2C', 'technical/phase2c_answer_boundaries.md'],
  ['loadPhase4B', 'technical/phase4b_rubric_validation.md'],
  ['loadPhase4CSave', 'technical/phase4c_save.md'],
  ['loadAssessmentPurposeMethodology', 'pedagogical/assessment_purpose_method.md'],
  ['loadPhase9Methodology', 'pedagogical/phase9_generalization_method.md'],
  ['loadPhase10Methodology', 'pedagogical/phase10_extrapolation_method.md'],
  ['loadPhase11Methodology', 'pedagogical/phase11_grade_decision_method.md'],
  ['loadPhase12Methodology', 'pedagogical/phase12_feedback_method.md'],
  ['loadPhase13Methodology', 'pedagogical/phase13_teacher_summary_method.md'],
  ['loadPhase14Methodology', 'pedagogical/phase14_student_feedback_method.md'],
  ['loadHermeneuticGuidance', 'pedagogical/hermeneutic_guidance.md'],
];

async function call(loader: MethodologyLoader, method: keyof MethodologyLoader): Promise<string> {
  return (loader[method] as () => Promise<string>).call(loader);
}

describe('methodology loaders without their documents', () => {
  let empty: string;
  const saved = process.env.METHODOLOGY_PATH;

  beforeAll(async () => {
    empty = await fs.mkdtemp(path.join(os.tmpdir(), 'no-methodology-'));
  });

  afterAll(async () => {
    if (saved === undefined) delete process.env.METHODOLOGY_PATH;
    else process.env.METHODOLOGY_PATH = saved;
    await fs.rm(empty, { recursive: true, force: true });
  });

  function loaderWithoutDocuments(): MethodologyLoader {
    process.env.METHODOLOGY_PATH = empty;
    return new MethodologyLoader();
  }

  it.each(LOADERS)('%s throws an error naming methodology/%s', async (method, file) => {
    await expect(call(loaderWithoutDocuments(), method)).rejects.toThrow(`methodology/${file}`);
  });

  it('getCondensed throws naming both the foundation and the summary document', async () => {
    const attempt = call(loaderWithoutDocuments(), 'getCondensed');
    await expect(attempt).rejects.toThrow('methodology/pedagogical/00_foundation.md');
    await expect(call(loaderWithoutDocuments(), 'getCondensed')).rejects.toThrow(
      'methodology/fallback-summary.md',
    );
  });
});

describe('methodology loaders with the repository documents', () => {
  it.each(LOADERS)('%s returns the document content', async (method) => {
    const saved = process.env.METHODOLOGY_PATH;
    delete process.env.METHODOLOGY_PATH;
    try {
      const content = await call(new MethodologyLoader(), method);
      expect(content.length).toBeGreaterThan(200);
      expect(content).not.toMatch(/\(Fallback\)/);
    } finally {
      if (saved !== undefined) process.env.METHODOLOGY_PATH = saved;
    }
  });
});
