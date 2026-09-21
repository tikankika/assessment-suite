import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

// Without project methodology the assessment must not start on an instruction
// written into the code, and the override the error offers must work even when
// the installation methodology is missing too.
describe('assessmentStart without any methodology documents', () => {
  let root: string;
  let assessmentStart: typeof import('../src/tools/phase6_start.js').assessmentStart;
  const saved = process.env.METHODOLOGY_PATH;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'phase6-start-no-methodology-'));
    await fs.mkdir(path.join(root, 'project', 'reports'), { recursive: true });
    await fs.writeFile(path.join(root, 'project', 'reports', 'student-a.md'), '# Report\n\nText.\n');
    await fs.writeFile(path.join(root, 'project', 'rubric.md'), '# Rubric\n');
    await fs.mkdir(path.join(root, 'empty-methodology'));
    process.env.METHODOLOGY_PATH = path.join(root, 'empty-methodology');
    // The shared loader reads METHODOLOGY_PATH when the module is first imported.
    ({ assessmentStart } = await import('../src/tools/phase6_start.js'));
  });

  afterAll(async () => {
    if (saved === undefined) delete process.env.METHODOLOGY_PATH;
    else process.env.METHODOLOGY_PATH = saved;
    await fs.rm(root, { recursive: true, force: true });
  });

  it('stops with an error that names the missing methodology', async () => {
    await expect(
      assessmentStart({
        student_files_dir: path.join(root, 'project', 'reports'),
        project_path: path.join(root, 'project'),
        rubric_path: path.join(root, 'project', 'rubric.md'),
      }),
    ).rejects.toThrow('methodology/pedagogical/00_foundation.md');
  });

  // The error above tells the teacher to call again with the override. Taking
  // that decision must start the assessment, including when the installation
  // methodology cannot be condensed either.
  it('starts when the teacher decides to continue, and says what is missing', async () => {
    const result = await assessmentStart({
      student_files_dir: path.join(root, 'project', 'reports'),
      project_path: path.join(root, 'project'),
      rubric_path: path.join(root, 'project', 'rubric.md'),
      continue_without_methodology: true,
    });
    const warnings = JSON.stringify(result);
    expect(warnings).toContain('chose to continue without');
    expect(warnings).toContain('00_foundation.md');
  });
});
