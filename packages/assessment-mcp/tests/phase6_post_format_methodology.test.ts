import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { loadPostFormatMethodology } from '../src/tools/phase6_post_format.js';

// A packaged installation may point METHODOLOGY_PATH at a teacher-maintained
// folder. The format-detection tool must read from it like the shared loader,
// and treat an empty value (an optional MCPB setting left blank) as unset.
describe('phase6_post_format methodology source', () => {
  let tmp: string;
  const saved = process.env.METHODOLOGY_PATH;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'post-format-methodology-'));
  });

  afterEach(async () => {
    if (saved === undefined) delete process.env.METHODOLOGY_PATH;
    else process.env.METHODOLOGY_PATH = saved;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('reads the detection instructions from METHODOLOGY_PATH when set', async () => {
    await fs.mkdir(path.join(tmp, 'technical'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'technical', 'phase6_post_format_detection.md'),
      '# Custom detection instructions\n',
      'utf-8',
    );
    process.env.METHODOLOGY_PATH = tmp;

    const content = await loadPostFormatMethodology();

    expect(content).toBe('# Custom detection instructions\n');
  });

  it('falls back to the repository methodology when METHODOLOGY_PATH is empty', async () => {
    process.env.METHODOLOGY_PATH = '';

    const content = await loadPostFormatMethodology();

    expect(content.startsWith('# Phase 6-post: Assessment Format Detection')).toBe(true);
  });
});
