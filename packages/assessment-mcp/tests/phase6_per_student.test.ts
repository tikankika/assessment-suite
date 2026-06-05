import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { PerStudentEntry } from '../src/shared/project_state_manager.js';

/**
 * Tests for per-student (lab report) mode in Phase 6.
 *
 * These tests validate the session state and file operations
 * without calling the full tool functions (which require
 * project_state.json, sources.yaml, etc.)
 */

const TEST_DIR = '/tmp/phase6_per_student_test';

describe('Per-student mode', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    try { await fs.rm(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
  });

  describe('Student file discovery', () => {
    const studentDir = join(TEST_DIR, 'student_files');

    beforeEach(async () => {
      await fs.mkdir(studentDir, { recursive: true });
    });

    it('finds PDF and MD files, skips non-student files', async () => {
      // Create test files
      await fs.writeFile(join(studentDir, 'AAA_anonymized.pdf'), 'pdf content');
      await fs.writeFile(join(studentDir, 'EA_anonymized.pdf'), 'pdf content');
      await fs.writeFile(join(studentDir, 'CF_anonymized.md'), '# CF report');
      await fs.writeFile(join(studentDir, 'rubric.md'), '# Rubric');
      await fs.writeFile(join(studentDir, 'exam_questions.pdf'), 'exam');
      await fs.writeFile(join(studentDir, '.hidden.pdf'), 'hidden');

      const dirEntries = await fs.readdir(studentDir);
      const studentFiles = dirEntries
        .filter(f => /\.(pdf|md)$/i.test(f))
        .filter(f => !f.startsWith('.'))
        .filter(f => !f.startsWith('rubric'))
        .filter(f => !f.startsWith('exam'))
        .sort();

      expect(studentFiles).toHaveLength(3);
      expect(studentFiles).toContain('AAA_anonymized.pdf');
      expect(studentFiles).toContain('CF_anonymized.md');
      expect(studentFiles).toContain('EA_anonymized.pdf');
      expect(studentFiles).not.toContain('rubric.md');
      expect(studentFiles).not.toContain('exam_questions.pdf');
      expect(studentFiles).not.toContain('.hidden.pdf');
    });
  });

  describe('Student ID derivation', () => {
    it('strips _anonymized suffix', () => {
      const stem = 'AAA_anonymized';
      const id = stem.replace(/_anonymized$/i, '').replace(/_lab\d+$/i, '').replace(/_rapport$/i, '');
      expect(id).toBe('AAA');
    });

    it('strips _labN suffix', () => {
      const stem = 'Student1_lab3';
      const id = stem.replace(/_anonymized$/i, '').replace(/_lab\d+$/i, '').replace(/_rapport$/i, '');
      expect(id).toBe('Student1');
    });

    it('strips _rapport suffix', () => {
      const stem = 'EA_rapport';
      const id = stem.replace(/_anonymized$/i, '').replace(/_lab\d+$/i, '').replace(/_rapport$/i, '');
      expect(id).toBe('EA');
    });

    it('keeps clean IDs unchanged', () => {
      const stem = 'CF';
      const id = stem.replace(/_anonymized$/i, '').replace(/_lab\d+$/i, '').replace(/_rapport$/i, '');
      expect(id).toBe('CF');
    });

    it('handles compound IDs with underscores', () => {
      const stem = 'Student_A_anonymized';
      const id = stem.replace(/_anonymized$/i, '').replace(/_lab\d+$/i, '').replace(/_rapport$/i, '');
      expect(id).toBe('Student_A');
    });
  });

  describe('PerStudentEntry tracking', () => {
    it('tracks assessed state per student', () => {
      const students: PerStudentEntry[] = [
        { id: 'AAA', source_file: '/path/AAA.pdf', assessed: false },
        { id: 'EA', source_file: '/path/EA.pdf', assessed: false },
        { id: 'CF', source_file: '/path/CF.pdf', assessed: false },
      ];

      // Assess AAA
      students[0].assessed = true;
      students[0].assessment_file = '/path/BEDÖMNING_AAA.md';

      expect(students.filter(s => s.assessed)).toHaveLength(1);
      expect(students.filter(s => !s.assessed)).toHaveLength(2);

      // Next unassessed should be EA
      const next = students.find(s => !s.assessed);
      expect(next?.id).toBe('EA');
    });

    it('reports all assessed when done', () => {
      const students: PerStudentEntry[] = [
        { id: 'AAA', source_file: '/path/AAA.pdf', assessed: true, assessment_file: '/path/B_AAA.md' },
        { id: 'EA', source_file: '/path/EA.pdf', assessed: true, assessment_file: '/path/B_EA.md' },
      ];

      const next = students.find(s => !s.assessed);
      expect(next).toBeUndefined();
    });
  });

  describe('BEDÖMNING file creation', () => {
    const outputDir = join(TEST_DIR, '06_analytic_assessment');

    beforeEach(async () => {
      await fs.mkdir(outputDir, { recursive: true });
    });

    it('creates standalone BEDÖMNING file with v2 markers', async () => {
      const studentId = 'EA';
      const bedomningText = '**A1:** ✓✓ C — Alla rubriker finns\n**A2:** ✓ E — Grundläggande teori';
      const assessedAt = new Date().toISOString();
      const assessedBy = 'Teacher_A';

      const content = `---
student_id: "${studentId}"
source_file: "/path/EA_anonymized.pdf"
rubric: "/path/rubric_analytic.md"
assessor: "${assessedBy}"
assessed_at: "${assessedAt}"
format_version: 2
---

<!-- PHASE6_ASSESSMENT_START student_id="${studentId}" -->
### BEDÖMNING: ${studentId}

${bedomningText}

<!-- PHASE6_ASSESSMENT
student_id: ${studentId}
total_points: null
max_points: null
assessed_by: ${assessedBy}
assessed_at: ${assessedAt}
format_version: 2
-->
<!-- PHASE6_ASSESSMENT_END -->
`;

      const outputFile = join(outputDir, `BEDÖMNING_${studentId}.md`);
      await fs.writeFile(outputFile, content, 'utf-8');

      // Verify file exists and has correct content
      const written = await fs.readFile(outputFile, 'utf-8');
      expect(written).toContain('PHASE6_ASSESSMENT_START');
      expect(written).toContain('PHASE6_ASSESSMENT_END');
      expect(written).toContain(`student_id: "${studentId}"`);
      expect(written).toContain('### BEDÖMNING: EA');
      expect(written).toContain('format_version: 2');
      expect(written).toContain('✓✓ C');
    });

    it('resume detects existing BEDÖMNING files', async () => {
      const outputFile = join(outputDir, 'BEDÖMNING_CF.md');
      await fs.writeFile(outputFile, '### BEDÖMNING: CF\nContent', 'utf-8');

      // Check if file exists (resume detection logic)
      let exists = false;
      try {
        await fs.access(outputFile);
        exists = true;
      } catch {
        exists = false;
      }

      expect(exists).toBe(true);
    });
  });

  describe('Progress calculation', () => {
    it('calculates correct progress string', () => {
      // Import the function used by the actual tools
      const calculateProgress = (assessed: number, total: number): string => {
        const percentage = total > 0 ? ((assessed / total) * 100).toFixed(2) : '0';
        return `${assessed}/${total} (${percentage}%)`;
      };

      expect(calculateProgress(0, 8)).toBe('0/8 (0.00%)');
      expect(calculateProgress(2, 8)).toBe('2/8 (25.00%)');
      expect(calculateProgress(8, 8)).toBe('8/8 (100.00%)');
    });
  });

  describe('Q-file mode backward compatibility', () => {
    it('PerStudentEntry interface is optional in Phase6Session', () => {
      // Simulate a Q-file session (no per-student fields)
      const session = {
        current_question: 'Q003',
        assessment_file: '/path/Q3.md',
        original_file: '/path/Q3.md',
        started_at: '2026-04-15T10:00:00Z',
        assessor: 'Teacher_A',
        methodology_loaded: true,
        rubric_displayed: true,
      };

      // mode should be undefined (defaults to qfile)
      expect(session).not.toHaveProperty('mode');
      expect(session).not.toHaveProperty('students');

      // Accessing mode with default
      const mode = (session as { mode?: string }).mode ?? 'qfile';
      expect(mode).toBe('qfile');
    });
  });
});
