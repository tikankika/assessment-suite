import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { phase2bQuestionDetection } from '../src/tools/phase2b_questions.js';
import { MethodologyLoader } from '../src/core/methodology_loader.js';
import type { Question } from '../src/types/exam.js';

/**
 * Tests for phase2b_question_detection tool
 *
 * Simple tests focused on:
 * - Methodology loading
 * - LOAD mode returns exam_content + methodology
 * - SAVE mode writes files
 */

// Test data directory
const TEST_DIR = '/tmp/phase2b_test';
const TEST_PROJECT_PATH = `${TEST_DIR}/project`;
const TEST_EXAM_PATH = `${TEST_PROJECT_PATH}/02_markdown/exam_questions.md`;

// Sample exam content
const SAMPLE_EXAM_CONTENT = `# PDF: exam_questions.pdf

## Page 1

Question Question title Marks Question type
6 ### E3. Diffusion och gasutbyte (5 poäng) 5 Text area

## Page 7

6 ### E3. Diffusion och gasutbyte (5 poäng)

Förklara hur gasutbyte sker i alveolerna genom diffusion.
Beskriv riktningen för syre och koldioxid.

Maximum marks: 5
`;

describe('phase2b_question_detection', () => {
  beforeAll(async () => {
    // Create test directories and exam file inside 02_markdown/ (mirrors real project layout)
    await fs.mkdir(`${TEST_PROJECT_PATH}/02_markdown`, { recursive: true });
    await fs.mkdir(`${TEST_PROJECT_PATH}/patterns`, { recursive: true });
    await fs.writeFile(TEST_EXAM_PATH, SAMPLE_EXAM_CONTENT, 'utf-8');
  });

  afterAll(async () => {
    // Cleanup
    try {
      await fs.rm(TEST_DIR, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('LOAD mode', () => {
    it('should return exam_content in single mode', async () => {
      const result = await phase2bQuestionDetection({
        exam_path: TEST_EXAM_PATH,
        mode: 'single',
      });

      expect(result.mode).toBe('load');
      if (result.mode === 'load') {
        expect(result.exam_content).toContain('E3. Diffusion och gasutbyte');
        expect(result.analysis_mode).toBe('single');
      }
    });

    it('should return methodology instructions', async () => {
      const result = await phase2bQuestionDetection({
        exam_path: TEST_EXAM_PATH,
        mode: 'single',
      });

      expect(result.mode).toBe('load');
      if (result.mode === 'load') {
        expect(result.methodology).toBeDefined();
        expect(result.methodology.length).toBeGreaterThan(100);
      }
    });

    it('should include instructions based on mode', async () => {
      const result = await phase2bQuestionDetection({
        exam_path: TEST_EXAM_PATH,
        mode: 'batch',
      });

      expect(result.mode).toBe('load');
      if (result.mode === 'load') {
        expect(result.instructions).toContain('batch');
        expect(result.instructions).toContain('Flag issues');
      }
    });
  });

  describe('SAVE mode', () => {
    it('should write exam_config.yaml', async () => {
      const testQuestions: Question[] = [
        {
          id: 'Q006',
          number: 6,
          rubric_id: 'E3',
          raw_header: '6 ### E3. Diffusion och gasutbyte (5 poäng)',
          question_title: 'Diffusion och gasutbyte',
          question_text: 'Förklara hur gasutbyte sker i alveolerna...',
          points: 5,
          max_marks: 5,
          question_type: 'Text area',
          warnings: [],
        },
      ];

      const result = await phase2bQuestionDetection({
        exam_path: TEST_EXAM_PATH,
        mode: 'batch',
        save_results: true,
        project_path: TEST_PROJECT_PATH,
        questions: testQuestions,
      });

      expect(result.mode).toBe('save');
      if (result.mode === 'save') {
        expect(result.success).toBe(true);
        expect(result.files_created).toContain(`${TEST_PROJECT_PATH}/exam_config.yaml`);
        expect(result.summary.total_questions).toBe(1);
      }

      // Verify file exists
      const configExists = await fs.access(`${TEST_PROJECT_PATH}/exam_config.yaml`)
        .then(() => true)
        .catch(() => false);
      expect(configExists).toBe(true);
    });

    it('should write annotated markdown', async () => {
      const testQuestions: Question[] = [
        {
          id: 'Q006',
          number: 6,
          rubric_id: 'E3',
          raw_header: '6 ### E3. Diffusion (5 poäng)',
          question_title: 'Diffusion',
          question_text: 'Test question',
          points: 5,
          max_marks: 5,
          question_type: 'Text area',
          warnings: [],
        },
      ];

      const result = await phase2bQuestionDetection({
        exam_path: TEST_EXAM_PATH,
        mode: 'batch',
        save_results: true,
        project_path: TEST_PROJECT_PATH,
        questions: testQuestions,
      });

      expect(result.mode).toBe('save');
      if (result.mode === 'save') {
        const annotatedPath = `${TEST_PROJECT_PATH}/02_markdown/exam_questions_annotated.md`;
        expect(result.files_created).toContain(annotatedPath);

        const content = await fs.readFile(annotatedPath, 'utf-8');
        expect(content).toContain('id: Q006');
        expect(content).toContain('rubric_id: E3');
      }
    });

    it('should write pattern file when detected_pattern provided', async () => {
      const testQuestions: Question[] = [
        {
          id: 'Q006',
          number: 6,
          rubric_id: 'E3',
          raw_header: '6 ### E3. Test',
          question_title: 'Test',
          question_text: 'Test',
          points: 5,
          max_marks: 5,
          question_type: 'Text area',
          warnings: [],
        },
      ];

      const result = await phase2bQuestionDetection({
        exam_path: TEST_EXAM_PATH,
        mode: 'batch',
        save_results: true,
        project_path: TEST_PROJECT_PATH,
        questions: testQuestions,
        detected_pattern: {
          description: '{number} ### {ID}. {title} ({points}p)',
          confidence: 'high',
        },
      });

      expect(result.mode).toBe('save');
      if (result.mode === 'save') {
        expect(result.summary.pattern_file).toBeDefined();
        expect(result.files_created.length).toBe(3);
      }
    });

    it('should throw error if questions not provided in SAVE mode', async () => {
      await expect(
        phase2bQuestionDetection({
          exam_path: TEST_EXAM_PATH,
          mode: 'batch',
          save_results: true,
          project_path: TEST_PROJECT_PATH,
        })
      ).rejects.toThrow('SAVE mode requires questions array');
    });

    it('should throw error if project_path not provided in SAVE mode', async () => {
      await expect(
        phase2bQuestionDetection({
          exam_path: TEST_EXAM_PATH,
          mode: 'batch',
          save_results: true,
          questions: [],
        })
      ).rejects.toThrow('SAVE mode requires questions array');
    });
  });

  describe('MethodologyLoader.loadPhase2B', () => {
    it('should load Phase 2B methodology', async () => {
      const loader = new MethodologyLoader();
      const methodology = await loader.loadPhase2B();

      expect(methodology).toBeDefined();
      expect(methodology).toContain('Phase 4A'); // methodology file still uses Phase 4A internally
    });

    it('should contain key instructions', async () => {
      const loader = new MethodologyLoader();
      const methodology = await loader.loadPhase2B();

      // Check for key concepts from methodology file
      expect(methodology).toContain('Table of Contents');
      expect(methodology).toContain('Maximum marks');
    });
  });
});
