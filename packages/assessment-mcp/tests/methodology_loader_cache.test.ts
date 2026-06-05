import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';

const TEST_DIR = '/tmp/methodology_cache_test';
const METHODOLOGY_DIR = `${TEST_DIR}/methodology/pedagogical`;

describe('MethodologyLoader caching', () => {
  beforeAll(async () => {
    await fs.mkdir(METHODOLOGY_DIR, { recursive: true });
    await fs.writeFile(
      `${METHODOLOGY_DIR}/hermeneutic_guidance.md`,
      '# Test Hermeneutic Guidance\n\nTest content.',
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

  it('returns same content on repeated calls without re-reading file', async () => {
    const { MethodologyLoader } = await import('../src/core/methodology_loader.js');
    const loader = new MethodologyLoader();

    const readFileSpy = vi.spyOn(fs, 'readFile');
    const callsBefore = readFileSpy.mock.calls.length;

    const result1 = await loader.loadHermeneuticGuidance();
    const readAfterFirst = readFileSpy.mock.calls.length;

    const result2 = await loader.loadHermeneuticGuidance();
    const readAfterSecond = readFileSpy.mock.calls.length;

    expect(result1).toBe(result2);
    // Second call should NOT trigger another fs.readFile
    expect(readAfterSecond - readAfterFirst).toBeLessThanOrEqual(0);

    readFileSpy.mockRestore();
  });

  it('caches resolved paths to avoid repeated fs.access calls', async () => {
    const { MethodologyLoader } = await import('../src/core/methodology_loader.js');
    const loader = new MethodologyLoader();

    const accessSpy = vi.spyOn(fs, 'access');
    const callsBefore = accessSpy.mock.calls.length;

    await loader.loadHermeneuticGuidance();
    const accessAfterFirst = accessSpy.mock.calls.length;

    await loader.loadHermeneuticGuidance();
    const accessAfterSecond = accessSpy.mock.calls.length;

    // Second call should NOT trigger more fs.access calls
    expect(accessAfterSecond - accessAfterFirst).toBeLessThanOrEqual(0);

    accessSpy.mockRestore();
  });
});
