import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { AssessmentWriter } from '../src/core/assessment_writer.js';
import type { Assessment } from '../src/types/assessment.js';

const TEST_DIR = '/tmp/assessment_writer_test';
const writer = new AssessmentWriter();

const SAMPLE_ASSESSMENT: Assessment = {
  aspects: [
    { name: 'Diffusion', symbol: '✓✓', points: 2, maxPoints: 3, comment: 'Good understanding' },
  ],
  totalPoints: 2,
  maxPoints: 3,
  comment: 'Well done.',
  nextStep: 'Study osmosis next.',
};

const TWO_STUDENT_QFILE = `## Elev 111 (30 ord)

Student 111 answer about diffusion.
Gasutbyte sker i alveolerna.

---

## Elev 222 (25 ord)

Student 222 answer about ecology.
`;

const UNDERSCORE_ID_QFILE = `## Elev 100300_200300 (30 ord)

Answer from student with underscore ID.

---

## Elev 999 (20 ord)

Another answer.
`;

describe('AssessmentWriter', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    try { await fs.rm(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
  });

  it('writes BEDÖMNING to correct student', async () => {
    const filePath = `${TEST_DIR}/write_test.md`;
    await fs.writeFile(filePath, TWO_STUDENT_QFILE, 'utf-8');

    const result = await writer.writeAssessment(filePath, '111', SAMPLE_ASSESSMENT);
    expect(result.success).toBe(true);

    const content = await fs.readFile(filePath, 'utf-8');
    // Check that assessment was written
    expect(content.length).toBeGreaterThan(TWO_STUDENT_QFILE.length);
    expect(content).toContain('Diffusion');
    expect(content).toContain('2/3p');
    // Student 222's answer should still be intact
    expect(content).toContain('Student 222 answer about ecology');
    // Assessment should be before student 222
    const assessmentPos = content.indexOf('Diffusion');
    const student222Pos = content.indexOf('## Elev 222');
    expect(assessmentPos).toBeLessThan(student222Pos);
  });

  it('supports underscore in student IDs', async () => {
    const filePath = `${TEST_DIR}/underscore_test.md`;
    await fs.writeFile(filePath, UNDERSCORE_ID_QFILE, 'utf-8');

    const result = await writer.writeAssessment(filePath, '100300_200300', SAMPLE_ASSESSMENT);
    expect(result.success).toBe(true);

    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toContain('Diffusion');
    // Student 999 should be untouched
    expect(content).toContain('Another answer');
  });

  it('throws for non-existent student', async () => {
    const filePath = `${TEST_DIR}/not_found_test.md`;
    await fs.writeFile(filePath, TWO_STUDENT_QFILE, 'utf-8');

    await expect(
      writer.writeAssessment(filePath, 'NONEXISTENT', SAMPLE_ASSESSMENT)
    ).rejects.toThrow();
  });

  it('removes existing BEDÖMNING when overwriting', async () => {
    const filePath = `${TEST_DIR}/overwrite_test.md`;
    await fs.writeFile(filePath, TWO_STUDENT_QFILE, 'utf-8');

    // Write first assessment
    await writer.writeAssessment(filePath, '111', SAMPLE_ASSESSMENT);

    // Remove it
    await writer.removeAssessment(filePath, '111');

    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).not.toContain('### BEDÖMNING:');
    // Original answer should remain
    expect(content).toContain('Student 111 answer about diffusion');
  });
});
