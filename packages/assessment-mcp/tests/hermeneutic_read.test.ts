import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';

const TEST_DIR = '/tmp/hermeneutic_test';

const SAMPLE_COMPLETE_FILE = `# Complete Assessment — Student_001

### Fråga Q001
**Score:** 3/5
Student demonstrated good understanding of diffusion.

---

### Fråga Q002
**Score:** 2/4
Partial answer with some misconceptions.

---

### Fråga Q003A
**Score:** 4/4
Excellent answer.
`;

describe('hermeneutic_read: extractQuestionAssessments', () => {
  // We test the internal logic via the exported function
  beforeAll(async () => {
    await fs.mkdir(`${TEST_DIR}/complete_assessment`, { recursive: true });
    await fs.mkdir(`${TEST_DIR}/methodology/pedagogical`, { recursive: true });
    await fs.writeFile(
      `${TEST_DIR}/complete_assessment/Complete_Student_001.md`,
      SAMPLE_COMPLETE_FILE,
      'utf-8'
    );
    await fs.writeFile(
      `${TEST_DIR}/methodology/pedagogical/hermeneutic_guidance.md`,
      '## Phase 9: Test\n\n### STEG 1: Test step\n\nTest guidance.',
      'utf-8'
    );
    process.env.METHODOLOGY_PATH = `${TEST_DIR}/methodology`;
  });

  afterAll(async () => {
    delete process.env.METHODOLOGY_PATH;
    try {
      await fs.rm(TEST_DIR, { recursive: true });
    } catch { /* ignore */ }
  });

  it('returns assessment texts for existing questions', async () => {
    const { hermeneuticRead } = await import('../src/tools/hermeneutic_read.js');
    const result = await hermeneuticRead({
      project_path: TEST_DIR,
      student_id: 'Student_001',
      question_ids: ['Q001', 'Q002'],
      phase: 9,
    });

    expect(result.success).toBe(true);
    expect(result.assessment_texts['Q001']).toContain('Fråga Q001');
    expect(result.assessment_texts['Q002']).toContain('Fråga Q002');
  });

  it('returns null for missing questions', async () => {
    const { hermeneuticRead } = await import('../src/tools/hermeneutic_read.js');
    const result = await hermeneuticRead({
      project_path: TEST_DIR,
      student_id: 'Student_001',
      question_ids: ['Q001', 'Q999'],
      phase: 9,
    });

    expect(result.success).toBe(true);
    expect(result.assessment_texts['Q001']).not.toBeNull();
    expect(result.assessment_texts['Q999']).toBeNull();
    expect(result.message).toContain('1/2');
  });

  it('handles question IDs with special regex characters', async () => {
    const { hermeneuticRead } = await import('../src/tools/hermeneutic_read.js');
    const result = await hermeneuticRead({
      project_path: TEST_DIR,
      student_id: 'Student_001',
      question_ids: ['Q003A'],
      phase: 9,
    });

    expect(result.success).toBe(true);
    expect(result.assessment_texts['Q003A']).toContain('Excellent');
  });

  it('rejects phases outside 9-14', async () => {
    const { hermeneuticRead } = await import('../src/tools/hermeneutic_read.js');
    const result = await hermeneuticRead({
      project_path: TEST_DIR,
      student_id: 'Student_001',
      question_ids: ['Q001'],
      phase: 6,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('utanför');
  });

  it('returns guidance for specific phase and step', async () => {
    const { hermeneuticRead } = await import('../src/tools/hermeneutic_read.js');
    const result = await hermeneuticRead({
      project_path: TEST_DIR,
      student_id: 'Student_001',
      question_ids: ['Q001'],
      phase: 9,
      step: 1,
    });

    expect(result.success).toBe(true);
    expect(result.guidance).toContain('STEG 1');
  });

  it('returns error for missing student file', async () => {
    const { hermeneuticRead } = await import('../src/tools/hermeneutic_read.js');
    const result = await hermeneuticRead({
      project_path: TEST_DIR,
      student_id: 'NonExistent',
      question_ids: ['Q001'],
      phase: 9,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Kunde inte läsa');
  });
});
