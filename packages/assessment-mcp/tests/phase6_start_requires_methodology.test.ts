import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { assessmentStart } from '../src/tools/phase6_start.js';

// Assessment must not start without its methodology documents. Continuing
// without them is an explicit decision by the teacher, passed as
// continue_without_methodology, and the response records what is missing.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE = path.resolve(HERE, '../../../examples/biog2000x_immunforsvaret/immune_system_exam');
const FOUNDATION = 'pedagogical/00_foundation.md';
const ASSESSMENT_METHOD = 'pedagogical/phase6_assessment_method.md';

let root: string;
let project: string;

async function copyExampleProject(): Promise<void> {
  await fs.cp(path.join(EXAMPLE, '01_original'), path.join(project, '01_original'), { recursive: true });
  await fs.cp(path.join(EXAMPLE, '05_answers_by_question'), path.join(project, '05_answers_by_question'), { recursive: true });
  for (const file of ['exam_config.yaml', 'sources.yaml']) {
    await fs.copyFile(path.join(EXAMPLE, file), path.join(project, file));
  }
}

async function writeMethodology(docs: string[]): Promise<void> {
  for (const doc of docs) {
    const target = path.join(project, 'methodology', doc);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(EXAMPLE, 'methodology', doc), target);
  }
}

const qFile = () => path.join(project, '05_answers_by_question', 'Q001_alla_elever.md');
const rubric = () => path.join(project, '01_original', 'rubric.md');

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'phase6-requires-methodology-'));
  project = path.join(root, 'immune_system_exam');
  await fs.mkdir(project);
  await copyExampleProject();
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('assessment start, question-file mode', () => {
  it('starts when both methodology documents are present', async () => {
    await writeMethodology([FOUNDATION, ASSESSMENT_METHOD]);
    const result = await assessmentStart({ q_file_path: qFile(), rubric_path: rubric(), create_copy: false });
    expect(result.methodology_documents).toEqual([FOUNDATION, ASSESSMENT_METHOD]);
  });

  it('stops, naming the missing document and the override, when one is missing', async () => {
    await writeMethodology([FOUNDATION]);
    await expect(
      assessmentStart({ q_file_path: qFile(), rubric_path: rubric(), create_copy: false }),
    ).rejects.toThrow(/methodology\/pedagogical\/phase6_assessment_method\.md[\s\S]*continue_without_methodology/);
  });

  it('stops when the project has no methodology folder', async () => {
    await expect(
      assessmentStart({ q_file_path: qFile(), rubric_path: rubric(), create_copy: false }),
    ).rejects.toThrow(/methodology\/pedagogical\/00_foundation\.md[\s\S]*methodology\/pedagogical\/phase6_assessment_method\.md/);
  });

  it('leaves the question file unchanged when it stops', async () => {
    await writeMethodology([FOUNDATION]);
    // Without a status block, a start that went ahead would write a new one.
    const original = await fs.readFile(qFile(), 'utf-8');
    await fs.writeFile(qFile(), original.replace(/^---\nASSESSMENT-STATUS:[\s\S]*?\n---\n/, ''));
    const before = await fs.readFile(qFile(), 'utf-8');
    expect(before).not.toContain('ASSESSMENT-STATUS');
    await expect(
      assessmentStart({ q_file_path: qFile(), rubric_path: rubric(), create_copy: false }),
    ).rejects.toThrow();
    expect(await fs.readFile(qFile(), 'utf-8')).toBe(before);
  });

  it('continues after the teacher decides to, and records what is missing', async () => {
    await writeMethodology([FOUNDATION]);
    const result = await assessmentStart({
      q_file_path: qFile(),
      rubric_path: rubric(),
      create_copy: false,
      continue_without_methodology: true,
    });
    expect(result.methodology_documents).toEqual([FOUNDATION]);
    expect(result.validationWarnings.join('\n')).toMatch(
      /continue without[\s\S]*methodology\/pedagogical\/phase6_assessment_method\.md/i,
    );
  });
});

describe('assessment start, per-student mode', () => {
  beforeEach(async () => {
    await fs.mkdir(path.join(project, 'reports'));
    await fs.writeFile(path.join(project, 'reports', 'student-a.md'), '# Report\n\nText.\n');
  });

  const start = (extra: Record<string, unknown> = {}) =>
    assessmentStart({
      student_files_dir: path.join(project, 'reports'),
      project_path: project,
      rubric_path: rubric(),
      ...extra,
    });

  it('stops, naming the missing document, when one is missing', async () => {
    await writeMethodology([ASSESSMENT_METHOD]);
    await expect(start()).rejects.toThrow(/methodology\/pedagogical\/00_foundation\.md[\s\S]*continue_without_methodology/);
  });

  it('continues after the teacher decides to', async () => {
    await writeMethodology([ASSESSMENT_METHOD]);
    const result = await start({ continue_without_methodology: true });
    expect(result.methodology_documents).toEqual([ASSESSMENT_METHOD]);
    expect(result.validationWarnings.join('\n')).toMatch(/methodology\/pedagogical\/00_foundation\.md/);
  });
});
