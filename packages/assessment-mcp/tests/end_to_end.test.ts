import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { StudentReader } from '../src/core/student_reader.js';
import { AssessmentWriter } from '../src/core/assessment_writer.js';
import { StatusManager } from '../src/core/status_manager.js';
import type { Assessment } from '../src/types/assessment.js';

const TEST_DIR = '/tmp/e2e_assessment_test';
const reader = new StudentReader();
const writer = new AssessmentWriter();
const statusMgr = new StatusManager();

/**
 * Build a Q-file with N students, each with a unique answer.
 */
function buildQFile(studentCount: number): string {
  const sections: string[] = [];
  for (let i = 0; i < studentCount; i++) {
    const id = `S${String(i + 1).padStart(3, '0')}`;
    const words = 20 + i * 5;
    const answer = `Answer from ${id}: ` + Array(words).fill('word').join(' ');
    sections.push(`## Elev ${id} (${words} ord)\n\n${answer}\n`);
  }
  return sections.join('\n---\n\n');
}

/**
 * Build a sample assessment with deterministic points for a given student index.
 */
function buildAssessment(studentIndex: number): Assessment {
  const pointsA = (studentIndex % 3) + 1;   // 1-3
  const pointsB = (studentIndex % 2);        // 0-1
  return {
    aspects: [
      { name: '6a (Aspekt A)', symbol: '✓'.repeat(pointsA), points: pointsA, comment: `Comment A for student ${studentIndex}` },
      { name: '6b (Aspekt B)', symbol: pointsB > 0 ? '✓' : '✗', points: pointsB, comment: `Comment B for student ${studentIndex}` },
    ],
    totalPoints: pointsA + pointsB,
    maxPoints: 4,
    nextStep: `Feedback for student ${studentIndex}`,
  };
}

describe('End-to-end assessment flow', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    try { await fs.rm(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
  });

  describe('Full loop: 5 students assessed one-by-one', () => {
    const STUDENT_COUNT = 5;
    const filePath = `${TEST_DIR}/e2e_5students.md`;

    it('initial parse finds all students as unassessed', async () => {
      await fs.writeFile(filePath, buildQFile(STUDENT_COUNT), 'utf-8');
      const students = await reader.parseStudents(filePath);

      expect(students).toHaveLength(STUDENT_COUNT);
      expect(students.every(s => !s.assessed)).toBe(true);
      expect(students[0].id).toBe('S001');
      expect(students[4].id).toBe('S005');
    });

    it('first unassessed is S001', async () => {
      const next = await reader.getNextUnassessed(filePath);
      expect(next).not.toBeNull();
      expect(next!.id).toBe('S001');
    });

    it('assess S001 → next unassessed becomes S002', async () => {
      const result = await writer.writeAssessment(filePath, 'S001', buildAssessment(0));
      expect(result.success).toBe(true);

      const next = await reader.getNextUnassessed(filePath);
      expect(next).not.toBeNull();
      expect(next!.id).toBe('S002');
    });

    it('S001 is now marked assessed, S002-S005 are not', async () => {
      const students = await reader.parseStudents(filePath);
      expect(students[0].assessed).toBe(true);
      for (let i = 1; i < STUDENT_COUNT; i++) {
        expect(students[i].assessed).toBe(false);
      }
    });

    it('assess remaining students S002-S005', async () => {
      for (let i = 1; i < STUDENT_COUNT; i++) {
        const studentId = `S${String(i + 1).padStart(3, '0')}`;
        const result = await writer.writeAssessment(filePath, studentId, buildAssessment(i));
        expect(result.success).toBe(true);
      }
    });

    it('all students marked as assessed after full loop', async () => {
      const students = await reader.parseStudents(filePath);
      expect(students).toHaveLength(STUDENT_COUNT);
      expect(students.every(s => s.assessed)).toBe(true);
    });

    it('getNextUnassessed returns null when all done', async () => {
      const next = await reader.getNextUnassessed(filePath);
      expect(next).toBeNull();
    });

    it('countAssessed matches total', async () => {
      const count = await reader.countAssessed(filePath);
      expect(count).toBe(STUDENT_COUNT);
    });

    it('each student answer is still intact (no corruption)', async () => {
      const students = await reader.parseStudents(filePath);
      for (let i = 0; i < STUDENT_COUNT; i++) {
        const id = `S${String(i + 1).padStart(3, '0')}`;
        expect(students[i].id).toBe(id);
        expect(students[i].answer).toContain(`Answer from ${id}`);
      }
    });

    it('file contains one assessment section per student', async () => {
      const content = await fs.readFile(filePath, 'utf-8');
      // Match either v1 (BEDÖMNING) or legacy (ANALYTIC ASSESSMENT) format
      const matches = content.match(/### (?:BEDÖMNING|ANALYTIC ASSESSMENT):/g);
      expect(matches).toHaveLength(STUDENT_COUNT);
    });

    it('each assessment has correct points', async () => {
      const content = await fs.readFile(filePath, 'utf-8');
      for (let i = 0; i < STUDENT_COUNT; i++) {
        const assessment = buildAssessment(i);
        // Match point totals regardless of format (TOTALPOÄNG or TOTAL)
        expect(content).toContain(`${assessment.totalPoints}/${assessment.maxPoints}p`);
      }
    });
  });

  describe('Large batch: 16 students without corruption', () => {
    const STUDENT_COUNT = 16;
    const filePath = `${TEST_DIR}/e2e_16students.md`;

    it('assess all 16 and verify file integrity', async () => {
      await fs.writeFile(filePath, buildQFile(STUDENT_COUNT), 'utf-8');

      // Assess all students
      for (let i = 0; i < STUDENT_COUNT; i++) {
        const studentId = `S${String(i + 1).padStart(3, '0')}`;
        const result = await writer.writeAssessment(filePath, studentId, buildAssessment(i));
        expect(result.success).toBe(true);
      }

      // Verify all assessed
      const students = await reader.parseStudents(filePath);
      expect(students).toHaveLength(STUDENT_COUNT);
      expect(students.every(s => s.assessed)).toBe(true);

      // Verify no answer corruption
      for (let i = 0; i < STUDENT_COUNT; i++) {
        const id = `S${String(i + 1).padStart(3, '0')}`;
        expect(students[i].answer).toContain(`Answer from ${id}`);
      }

      // Verify correct number of BEDÖMNINGs
      const content = await fs.readFile(filePath, 'utf-8');
      const matches = content.match(/### (?:BEDÖMNING|ANALYTIC ASSESSMENT):/g);
      expect(matches).toHaveLength(STUDENT_COUNT);
    });
  });

  describe('Status tracking across writes', () => {
    const filePath = `${TEST_DIR}/e2e_status.md`;
    const STUDENT_COUNT = 4;

    it('creates status, assesses students, and tracks progress', async () => {
      await fs.writeFile(filePath, buildQFile(STUDENT_COUNT), 'utf-8');

      // Create STATUS frontmatter
      await statusMgr.create(
        filePath,
        'Fråga 6: Diffusion',
        4,
        STUDENT_COUNT,
        [{ name: '6a', max: 3 }, { name: '6b', max: 1 }],
        'rubric.md'
      );

      // Verify status was created
      const hasStatus = await statusMgr.hasStatus(filePath);
      expect(hasStatus).toBe(true);

      const initialStatus = await statusMgr.read(filePath);
      expect(initialStatus.totalStudents).toBe(STUDENT_COUNT);
      expect(initialStatus.lastAssessedStudent).toBeNull();
      expect(initialStatus.progress).toContain('0/4');

      // Assess student 0 and update status
      await writer.writeAssessment(filePath, 'S001', buildAssessment(0));
      await statusMgr.update(filePath, 'S001', 0, STUDENT_COUNT);

      const status1 = await statusMgr.read(filePath);
      expect(status1.lastAssessedStudent).toBe('S001');
      expect(status1.progress).toContain('1/4');

      // Assess student 1
      await writer.writeAssessment(filePath, 'S002', buildAssessment(1));
      await statusMgr.update(filePath, 'S002', 1, STUDENT_COUNT);

      const status2 = await statusMgr.read(filePath);
      expect(status2.lastAssessedStudent).toBe('S002');
      expect(status2.progress).toContain('2/4');

      // Verify students are still parseable after status updates
      const students = await reader.parseStudents(filePath);
      expect(students).toHaveLength(STUDENT_COUNT);
      expect(students[0].assessed).toBe(true);
      expect(students[1].assessed).toBe(true);
      expect(students[2].assessed).toBe(false);
    });
  });

  describe('Re-assessment (remove + write again)', () => {
    const filePath = `${TEST_DIR}/e2e_reassess.md`;

    it('remove and rewrite assessment without corrupting other students', async () => {
      await fs.writeFile(filePath, buildQFile(3), 'utf-8');

      // Assess all 3
      await writer.writeAssessment(filePath, 'S001', buildAssessment(0));
      await writer.writeAssessment(filePath, 'S002', buildAssessment(1));
      await writer.writeAssessment(filePath, 'S003', buildAssessment(2));

      // Remove S002's assessment
      const removed = await writer.removeAssessment(filePath, 'S002');
      expect(removed).toBe(true);

      // Verify S002 is now unassessed but S001 and S003 remain assessed
      const students = await reader.parseStudents(filePath);
      expect(students[0].assessed).toBe(true);
      expect(students[1].assessed).toBe(false);
      expect(students[2].assessed).toBe(true);

      // Re-assess S002 with different points
      const newAssessment: Assessment = {
        aspects: [
          { name: '6a', symbol: '✓✓✓', points: 3, comment: 'Revised: excellent' },
          { name: '6b', symbol: '✓', points: 1, comment: 'Revised: good' },
        ],
        totalPoints: 4,
        maxPoints: 4,
        nextStep: 'Keep up the good work',
      };
      const result = await writer.writeAssessment(filePath, 'S002', newAssessment);
      expect(result.success).toBe(true);

      // All 3 should be assessed again
      const studentsAfter = await reader.parseStudents(filePath);
      expect(studentsAfter.every(s => s.assessed)).toBe(true);

      // Verify the new assessment content
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('Revised: excellent');
      expect(content).toContain('4/4p');

      // Other students' answers intact
      expect(content).toContain('Answer from S001');
      expect(content).toContain('Answer from S003');
    });
  });

  describe('Duplicate assessment prevention', () => {
    const filePath = `${TEST_DIR}/e2e_duplicate.md`;

    it('throws when writing assessment for already-assessed student', async () => {
      await fs.writeFile(filePath, buildQFile(2), 'utf-8');

      await writer.writeAssessment(filePath, 'S001', buildAssessment(0));

      await expect(
        writer.writeAssessment(filePath, 'S001', buildAssessment(0))
      ).rejects.toThrow(/already has assessment/);
    });
  });

  describe('Mixed ID formats in same file', () => {
    const filePath = `${TEST_DIR}/e2e_mixed_ids.md`;

    const MIXED_ID_QFILE = `## Elev 100001 (40 ord)

Pure numeric ID answer about diffusion.

---

## Elev TestElev10 (35 ord)

Alphanumeric ID answer about ecology.

---

## Elev 100300_200300 (28 ord)

Underscore ID answer about osmosis.
`;

    it('handles numeric, alphanumeric, and underscore IDs in one file', async () => {
      await fs.writeFile(filePath, MIXED_ID_QFILE, 'utf-8');

      const students = await reader.parseStudents(filePath);
      expect(students).toHaveLength(3);
      expect(students[0].id).toBe('100001');
      expect(students[1].id).toBe('TestElev10');
      expect(students[2].id).toBe('100300_200300');

      // Assess all three
      await writer.writeAssessment(filePath, '100001', buildAssessment(0));
      await writer.writeAssessment(filePath, 'TestElev10', buildAssessment(1));
      await writer.writeAssessment(filePath, '100300_200300', buildAssessment(2));

      const assessed = await reader.parseStudents(filePath);
      expect(assessed.every(s => s.assessed)).toBe(true);

      // All answers intact
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('Pure numeric ID answer');
      expect(content).toContain('Alphanumeric ID answer');
      expect(content).toContain('Underscore ID answer');
    });
  });

  describe('Freetext assessment (v2 format)', () => {
    const filePath = `${TEST_DIR}/e2e_freetext.md`;

    it('writes v2 freetext and reader detects it as assessed', async () => {
      await fs.writeFile(filePath, buildQFile(2), 'utf-8');

      await writer.writeFreetextAssessment(
        filePath,
        'S001',
        '**6a:** ✓✓ 2p - Bra förståelse\n**6b:** ✗ 0p - Saknas\n\n**TOTALPOÄNG: 2/4p**\n**→ Nästa steg:** Studera osmosis',
        { total_points: 2, max_points: 4, assessed_by: 'Teacher_A' }
      );

      // Reader should detect v2 as assessed
      const students = await reader.parseStudents(filePath);
      expect(students[0].assessed).toBe(true);
      expect(students[1].assessed).toBe(false);

      // File should contain v2 markers
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('PHASE6_ASSESSMENT_START');
      expect(content).toContain('PHASE6_ASSESSMENT_END');
      expect(content).toContain('format_version: 2');
    });
  });

  describe('Empty answer students (0 ord)', () => {
    const filePath = `${TEST_DIR}/e2e_empty.md`;

    const EMPTY_ANSWER_QFILE = `## Elev E001 (45 ord)

A real answer with content about diffusion and gasutbyte.

---

## Elev E002 (0 ord)

Ingen svar

---

## Elev E003 (30 ord)

Another answer with some content.
`;

    it('handles 0-word students correctly in the flow', async () => {
      await fs.writeFile(filePath, EMPTY_ANSWER_QFILE, 'utf-8');

      const students = await reader.parseStudents(filePath);
      expect(students).toHaveLength(3);
      expect(students[1].wordCount).toBe(0);

      // Assess all including the 0-word student
      const zeroWordAssessment: Assessment = {
        aspects: [{ name: '6a', symbol: '✗', points: 0, comment: 'No answer' }],
        totalPoints: 0,
        maxPoints: 4,
        nextStep: 'Submit an answer next time',
      };

      await writer.writeAssessment(filePath, 'E001', buildAssessment(0));
      await writer.writeAssessment(filePath, 'E002', zeroWordAssessment);
      await writer.writeAssessment(filePath, 'E003', buildAssessment(2));

      const assessed = await reader.parseStudents(filePath);
      expect(assessed.every(s => s.assessed)).toBe(true);
      expect(assessed[1].answer).toContain('Ingen svar');
    });
  });
});
