import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { StatusManager } from '../src/core/status_manager.js';

const TEST_DIR = '/tmp/status_manager_test';
const statusManager = new StatusManager();

describe('StatusManager', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    try { await fs.rm(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
  });

  describe('create and read round-trip', () => {
    it('creates STATUS and reads it back correctly', async () => {
      const filePath = `${TEST_DIR}/roundtrip.md`;
      await fs.writeFile(filePath, '## Elev 111 (10 ord)\n\nAnswer.\n', 'utf-8');

      await statusManager.create(filePath, 'Diffusion', 5, 3, [], '/path/to/rubric.md');

      const status = await statusManager.read(filePath);
      expect(status.question).toBe('Diffusion');
      expect(status.maxPoints).toBe(5);
      expect(status.totalStudents).toBe(3);
    });

    it('hasStatus returns true after create', async () => {
      const filePath = `${TEST_DIR}/has_status.md`;
      await fs.writeFile(filePath, '## Elev 111 (10 ord)\n\nAnswer.\n', 'utf-8');

      expect(await statusManager.hasStatus(filePath)).toBe(false);

      await statusManager.create(filePath, 'Test', 3, 2, [], '');
      expect(await statusManager.hasStatus(filePath)).toBe(true);
    });
  });

  describe('update', () => {
    it('updates progress correctly', async () => {
      const filePath = `${TEST_DIR}/update_test.md`;
      // Realistic: the assessment is written into the file before update() runs.
      await fs.writeFile(filePath, '## Elev 111 (10 ord)\n\nAnswer.\n\n### BEDÖMNING: 111\n**A:** ✓ **1p**\n---\n', 'utf-8');

      await statusManager.create(filePath, 'Q1', 5, 3, [], '');
      await statusManager.update(filePath, '111', 0, 3);

      const status = await statusManager.read(filePath);
      expect(status.progress).toContain('1/3');
    });

    it('counts actually-assessed students, not the positional index (out-of-order)', async () => {
      const filePath = `${TEST_DIR}/out_of_order.md`;
      // 8 students; only the one at index 7 has an assessment written.
      const sections: string[] = [];
      for (let i = 0; i < 8; i++) {
        const id = `s${i}`;
        sections.push(
          i === 7
            ? `## Elev ${id} (10 ord)\n\nAnswer.\n\n### BEDÖMNING: ${id}\n**A:** ✓ **1p**\n---\n`
            : `## Elev ${id} (10 ord)\n\nAnswer.\n`
        );
      }
      await fs.writeFile(filePath, sections.join('\n'), 'utf-8');

      await statusManager.create(filePath, 'Q1', 5, 8, [], '');
      await statusManager.update(filePath, 's7', 7, 8);

      const status = await statusManager.read(filePath);
      // Only 1 of 8 assessed — must report 1/8, never 8/8 from the index.
      expect(status.progress).toContain('1/8');
      expect(status.progress).not.toContain('8/8');
    });

    it('preserves student answer content after STATUS operations', async () => {
      const originalContent = '## Elev 111 (10 ord)\n\nImportant answer text.\n';
      const filePath = `${TEST_DIR}/preserve_test.md`;
      await fs.writeFile(filePath, originalContent, 'utf-8');

      await statusManager.create(filePath, 'Q1', 5, 1, [], '');

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('Important answer text');
    });
  });

  describe('hasStatus with provided content', () => {
    it('uses provided content instead of reading the file', async () => {
      // A path that does not exist on disk: a non-false result proves the
      // provided content was inspected rather than the file being read.
      const missingPath = `${TEST_DIR}/hasstatus_content_missing.md`;
      const withStatus =
        '---\nASSESSMENT-STATUS:\n  File: x.md\n---\n\n## Elev 111 (1 ord)\n';
      const withoutStatus = '## Elev 111 (1 ord)\n\nAnswer.\n';

      expect(await statusManager.hasStatus(missingPath, withStatus)).toBe(true);
      expect(await statusManager.hasStatus(missingPath, withoutStatus)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('throws if STATUS already exists (prevents duplicate)', async () => {
      const filePath = `${TEST_DIR}/no_duplicate.md`;
      await fs.writeFile(filePath, '## Elev 111 (10 ord)\n\nAnswer.\n', 'utf-8');

      await statusManager.create(filePath, 'Q1', 5, 1, [], '');

      // Second create should throw
      await expect(
        statusManager.create(filePath, 'Q1', 5, 1, [], '')
      ).rejects.toThrow('already exists');
    });
  });
});
