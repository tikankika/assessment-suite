/**
 * Tests for InsightsWriter — cross-phase methodology § 4.3 anti-patterns enforcement
 *
 * Per methodology/cross_phase/meta_reflection_method.md § 4.3:
 * - The *Elever:-line that insights_writer.ts:78 emits must NOT appear
 *   in Teacher_Insights.md output, even when relatedStudents is passed
 * - 5-digit student IDs must not appear in body text
 * - relatedQuestions IS permitted (questions are not student data)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { InsightsWriter, InsightEntry } from '../src/reflection/insights_writer.js';

describe('InsightsWriter — cross-phase methodology § 4.3 anti-patterns', () => {
  let tempDir: string;
  let assessmentPath: string;
  let writer: InsightsWriter;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'insights-test-'));
    assessmentPath = path.join(tempDir, 'Q001_alla_elever.md');
    writer = new InsightsWriter();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('does NOT emit *Elever:-line in output even when relatedStudents is provided', async () => {
    const insight: InsightEntry = {
      type: 'pattern',
      content: '5/8 students confuse dendrites with axons',
      timestamp: '2026-05-05 22:00',
      relatedStudents: ['90001', '90002', '90003'],
      relatedQuestions: ['Q013'],
    };

    await writer.appendInsight(assessmentPath, insight);

    const filePath = writer.getInsightsPath(assessmentPath);
    const content = await fs.readFile(filePath, 'utf-8');

    expect(content).not.toContain('Elever:');
    expect(content).not.toContain('90001');
    expect(content).not.toContain('90002');
    expect(content).not.toContain('90003');
  });

  it('emits *Frågor:-line when relatedQuestions is provided (questions are not student data)', async () => {
    const insight: InsightEntry = {
      type: 'pattern',
      content: 'Q3 was difficult for the class',
      timestamp: '2026-05-05 22:00',
      relatedQuestions: ['Q003', 'Q005'],
    };

    await writer.appendInsight(assessmentPath, insight);

    const filePath = writer.getInsightsPath(assessmentPath);
    const content = await fs.readFile(filePath, 'utf-8');

    expect(content).toContain('Frågor: Q003, Q005');
  });

  it('omits relations line entirely when only relatedStudents was passed (now ignored)', async () => {
    const insight: InsightEntry = {
      type: 'pattern',
      content: 'Aggregate observation',
      timestamp: '2026-05-05 22:00',
      relatedStudents: ['90001'],
    };

    await writer.appendInsight(assessmentPath, insight);

    const filePath = writer.getInsightsPath(assessmentPath);
    const content = await fs.readFile(filePath, 'utf-8');

    // No Elever-line and no Frågor-line → no relations italic-block at all
    expect(content).not.toMatch(/^\*[^*]*\*$/m);
  });

  it('formats insight with Swedish category header', async () => {
    const insight: InsightEntry = {
      type: 'pedagogical',
      content: 'Need more emphasis on osmosis next year',
      timestamp: '2026-05-05 22:00',
    };

    await writer.appendInsight(assessmentPath, insight);

    const filePath = writer.getInsightsPath(assessmentPath);
    const content = await fs.readFile(filePath, 'utf-8');

    expect(content).toContain('Pedagogiska Insikter');
  });

  it('appends multiple insights to same file', async () => {
    const insight1: InsightEntry = {
      type: 'pattern',
      content: 'first',
      timestamp: '2026-05-05 22:00',
    };
    const insight2: InsightEntry = {
      type: 'critical',
      content: 'second',
      timestamp: '2026-05-05 22:01',
    };

    await writer.appendInsight(assessmentPath, insight1);
    await writer.appendInsight(assessmentPath, insight2);

    const filePath = writer.getInsightsPath(assessmentPath);
    const content = await fs.readFile(filePath, 'utf-8');

    expect(content).toContain('first');
    expect(content).toContain('second');
    expect(content).toContain('Mönster & Missförstånd');
    expect(content).toContain('Kritiska Observationer');
  });
});
