import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { phase3Validate } from '../src/tools/phase3_validate.js';

/**
 * Tests for phase3_validate fixes:
 * - Bug 1: Sub-question markers derived from answer_boundaries
 * - Bug 2: Preamble text before first marker is allowed
 */

let testDir: string;

async function setupProject(opts: {
  examConfig: string;
  originalContent: string;
  annotatedContent: string;
  studentId?: string;
}) {
  testDir = join(tmpdir(), `phase3_validate_test_${Date.now()}`);
  const studentId = opts.studentId || 'test1';

  // Create directory structure
  await fs.mkdir(join(testDir, '02_markdown', 'student_answers'), { recursive: true });
  await fs.mkdir(join(testDir, '03_material', 'student_answers'), { recursive: true });

  // Write project_state.json (required for state tracking)
  await fs.writeFile(
    join(testDir, 'project_state.json'),
    JSON.stringify({ current_phase: 3 })
  );

  // Write exam_config.yaml
  await fs.writeFile(join(testDir, 'exam_config.yaml'), opts.examConfig);

  // Write original student file
  await fs.writeFile(
    join(testDir, '02_markdown', 'student_answers', `${studentId}.md`),
    opts.originalContent
  );

  // Write annotated student file
  await fs.writeFile(
    join(testDir, '03_material', 'student_answers', `${studentId}.md`),
    opts.annotatedContent
  );

  return testDir;
}

afterEach(async () => {
  if (testDir) {
    try {
      await fs.rm(testDir, { recursive: true });
    } catch {}
  }
});

describe('Bug 1: Sub-question markers from answer_boundaries', () => {
  const CONFIG_WITH_SUBS = `
questions:
  - id: Q001
    number: 1
    question_title: Test Question
    points: null
answer_boundaries:
  global:
    language: swedish
  questions:
    Q001:
      question_header: '1.'
      answer_start_type: sub_question
      answer_start_marker: 'a)'
      sub_questions:
        a: Sub A text
        b: Sub B text
      answer_end_type: next_question
`;

  const ORIGINAL = `
1.

a) Svar A

b) Svar B
`;

  it('expects sub-question markers derived from answer_boundaries', async () => {
    // Annotated file WITH sub-question markers
    const annotated = `0001 <!-- student: test1 -->
0002
<!-- phase3_q001_start -->
0003 1.
0004
<!-- phase3_q001a_start -->
0005 a) Svar A
0006
<!-- phase3_q001a_end -->
<!-- phase3_q001b_start -->
0007 b) Svar B
0008
<!-- phase3_q001b_end -->
<!-- phase3_q001_end -->`;

    await setupProject({
      examConfig: CONFIG_WITH_SUBS,
      originalContent: ORIGINAL,
      annotatedContent: annotated,
    });

    const result = await phase3Validate({ project_path: testDir, student_id: 'test1' }) as any;
    const checks = result.results[0].checks;

    // Marker completeness should pass — it now expects sub-question markers
    expect(checks.marker_completeness.passed).toBe(true);
    // Expected count should include sub-markers: q001_start, q001_end, q001a_start, q001a_end, q001b_start, q001b_end = 6
    expect(result.results[0].expected_marker_count).toBe(6);
  });

  it('fails when sub-question markers are missing', async () => {
    // Annotated file WITHOUT sub-question markers (only question-level)
    const annotated = `0001 <!-- student: test1 -->
0002
<!-- phase3_q001_start -->
0003 1.
0004
0005 a) Svar A
0006
0007 b) Svar B
0008
<!-- phase3_q001_end -->`;

    await setupProject({
      examConfig: CONFIG_WITH_SUBS,
      originalContent: ORIGINAL,
      annotatedContent: annotated,
    });

    const result = await phase3Validate({ project_path: testDir, student_id: 'test1' }) as any;
    const checks = result.results[0].checks;

    // Should FAIL because sub-question markers are missing
    expect(checks.marker_completeness.passed).toBe(false);
    expect(checks.marker_completeness.details).toContain('q001a');
  });
});

describe('Bug 2: Preamble text before first marker', () => {
  const CONFIG_SIMPLE = `
questions:
  - id: Q001
    number: 1
    question_title: Test
    points: null
answer_boundaries:
  global:
    language: swedish
  questions:
    Q001:
      question_header: '1.'
      answer_start_type: after_text
      answer_start_marker: ''
      answer_end_type: marker
      answer_end_marker: ''
`;

  const ORIGINAL = `
Prov, energi och miljö
----------------------------------------------

1.

Mitt svar här.
`;

  it('allows preamble text before first marker', async () => {
    const annotated = `0001 <!-- student: test1 -->
0002
0003 Prov, energi och miljö
0004 ----------------------------------------------
0005
<!-- phase3_q001_start -->
0006 1.
0007
0008 Mitt svar här.
0009
<!-- phase3_q001_end -->`;

    await setupProject({
      examConfig: CONFIG_SIMPLE,
      originalContent: ORIGINAL,
      annotatedContent: annotated,
    });

    const result = await phase3Validate({ project_path: testDir, student_id: 'test1' }) as any;
    const checks = result.results[0].checks;

    // "No text outside markers" should PASS — preamble is allowed
    expect(checks.no_text_outside_markers.passed).toBe(true);
  });

  it('allows inter-question metadata (Besvarad, page numbers)', async () => {
    const configTwoQs = `
questions:
  - id: Q001
    number: 1
    question_title: Q1
    points: null
  - id: Q002
    number: 2
    question_title: Q2
    points: null
answer_boundaries:
  global:
    language: swedish
  questions:
    Q001:
      question_header: '1.'
      answer_start_type: after_text
      answer_start_marker: ''
      answer_end_type: next_question
    Q002:
      question_header: '2.'
      answer_start_type: after_text
      answer_start_marker: ''
      answer_end_type: marker
      answer_end_marker: ''
`;

    const original = `
1.
Svar 1

Besvarad.

2.
Svar 2
`;

    const annotated = `0001 <!-- student: test1 -->
0002
<!-- phase3_q001_start -->
0003 1.
0004 Svar 1
0005
<!-- phase3_q001_end -->
0006 Besvarad.
0007
<!-- phase3_q002_start -->
0008 2.
0009 Svar 2
0010
<!-- phase3_q002_end -->`;

    await setupProject({
      examConfig: configTwoQs,
      originalContent: original,
      annotatedContent: annotated,
    });

    const result = await phase3Validate({ project_path: testDir, student_id: 'test1' }) as any;
    const checks = result.results[0].checks;

    // Should PASS — "Besvarad." between questions is exam metadata
    expect(checks.no_text_outside_markers.passed).toBe(true);
  });

  it('allows epilogue text after last marker', async () => {
    const annotated = `0001 <!-- student: test1 -->
0002
<!-- phase3_q001_start -->
0003 1.
0004
0005 Mitt svar här.
0006
<!-- phase3_q001_end -->
0007 Besvarad.
0008 ---
0009 ## Page 6`;

    await setupProject({
      examConfig: CONFIG_SIMPLE,
      originalContent: ORIGINAL,
      annotatedContent: annotated,
    });

    const result = await phase3Validate({ project_path: testDir, student_id: 'test1' }) as any;
    const checks = result.results[0].checks;

    // Epilogue (after last q_end) should be allowed
    expect(checks.no_text_outside_markers.passed).toBe(true);
  });
});

describe('Text preservation with student header', () => {
  it('passes when only difference is added student header + blank line', async () => {
    const config = `
questions:
  - id: Q001
    number: 1
    question_title: Test
    points: null
answer_boundaries:
  global:
    language: swedish
  questions:
    Q001:
      question_header: '1.'
      answer_start_type: after_text
      answer_start_marker: ''
      answer_end_type: marker
`;

    // Original: starts with content directly
    const original = `1.

Mitt svar.
`;

    // Annotated: has student header + blank line prepended (from phase3_prepare)
    // Note: _add_line_indices produces "0002 " (with trailing space) for empty lines
    const annotated = '0001 <!-- student: test1 -->\n' +
      '0002 \n' +
      '<!-- phase3_q001_start -->\n' +
      '0003 1.\n' +
      '0004 \n' +
      '0005 Mitt svar.\n' +
      '0006 \n' +
      '<!-- phase3_q001_end -->';

    await setupProject({
      examConfig: config,
      originalContent: original,
      annotatedContent: annotated,
    });

    const result = await phase3Validate({ project_path: testDir, student_id: 'test1' }) as any;
    const checks = result.results[0].checks;

    expect(checks.text_preservation.passed).toBe(true);
  });
});

describe('Text preservation with numeric-prefix student text', () => {
  it('passes when student text starts with 4+ digits like "1991 med..."', async () => {
    const config = `
questions:
  - id: Q001
    number: 1
    question_title: Test
    points: null
answer_boundaries:
  global:
    language: swedish
  questions:
    Q001:
      question_header: '1.'
      answer_start_type: after_text
      answer_start_marker: ''
      answer_end_type: marker
`;

    // Original: student answer starts with "1991" which looks like a line index
    const original = `1.

1991 med 25 öre per kilo avfall infördes en skatt.
`;

    // Annotated: has student header + line indices + markers
    const annotated = '0001 <!-- student: test1 -->\n' +
      '0002 \n' +
      '<!-- phase3_q001_start -->\n' +
      '0003 1.\n' +
      '0004 \n' +
      '0005 1991 med 25 öre per kilo avfall infördes en skatt.\n' +
      '0006 \n' +
      '<!-- phase3_q001_end -->';

    await setupProject({
      examConfig: config,
      originalContent: original,
      annotatedContent: annotated,
    });

    const result = await phase3Validate({ project_path: testDir, student_id: 'test1' }) as any;
    const checks = result.results[0].checks;

    // text_preservation must PASS — "1991" is student text, not a line index
    expect(checks.text_preservation.passed).toBe(true);
  });
});

describe('Auto-graded questions skipped', () => {
  it('does not expect markers for auto-graded questions', async () => {
    const config = `
questions:
  - id: Q001
    number: 1
    question_title: Normal
    points: null
  - id: Q002
    number: 2
    question_title: Auto Graded
    points: null
answer_boundaries:
  global:
    language: swedish
  questions:
    Q001:
      question_header: '1.'
      answer_start_type: after_text
      answer_start_marker: ''
      answer_end_type: marker
    Q002:
      auto_graded: true
      skip_boundary_detection: true
`;

    const original = `1. Svar`;
    const annotated = `0001 <!-- student: test1 -->
0002
<!-- phase3_q001_start -->
0003 1. Svar
<!-- phase3_q001_end -->`;

    await setupProject({
      examConfig: config,
      originalContent: original,
      annotatedContent: annotated,
    });

    const result = await phase3Validate({ project_path: testDir, student_id: 'test1' }) as any;

    // Only Q001 markers expected (2), not Q002
    expect(result.results[0].expected_marker_count).toBe(2);
    expect(result.results[0].checks.marker_completeness.passed).toBe(true);
  });
});
