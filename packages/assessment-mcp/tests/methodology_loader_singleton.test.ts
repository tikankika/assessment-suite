import { describe, it, expect } from 'vitest';
import { methodologyLoader, MethodologyLoader } from '../src/core/methodology_loader.js';

/**
 * Perf #5: tools must share ONE MethodologyLoader so its file/path caches live
 * for the process. Previously each tool did `new MethodologyLoader()`, so the
 * cache was born empty and discarded per call — it never spanned calls.
 * (Cache behaviour itself is covered by methodology_loader_cache.test.ts.)
 */
describe('methodologyLoader shared singleton (perf #5)', () => {
  it('exports a ready-to-use MethodologyLoader instance', () => {
    expect(methodologyLoader).toBeInstanceOf(MethodologyLoader);
  });

  it('is the same instance on every import, so its cache persists', async () => {
    const again = (await import('../src/core/methodology_loader.js')).methodologyLoader;
    expect(again).toBe(methodologyLoader);
  });
});
