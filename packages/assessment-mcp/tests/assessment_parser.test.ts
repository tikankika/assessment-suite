import { describe, it, expect } from 'vitest';
import { AssessmentParser } from '../src/core/assessment_parser.js';

const parser = new AssessmentParser();

const QFILE_WITH_BEDÖMNING = `## Elev 111 (30 ord)

Answer about diffusion.

### BEDÖMNING:
**Diffusion:** ✓✓ **2p** - Good understanding
**TOTALPOÄNG: 2/3p**
**Kommentar:** Well done.
**→ Nästa steg:** Study osmosis.
---

## Elev 222 (25 ord)

Answer about ecology.

### BEDÖMNING:
**Ecology:** ✓ **1p** - Basic
**TOTALPOÄNG: 1/3p**
---
`;

describe('AssessmentParser.extractRawBedömningFromContent', () => {
  it('extracts correct BEDÖMNING for first student', () => {
    const result = parser.extractRawBedömningFromContent(QFILE_WITH_BEDÖMNING, '111');
    expect(result).not.toBeNull();
    expect(result).toContain('### BEDÖMNING:');
    expect(result).toContain('Diffusion');
    expect(result).toContain('2/3p');
  });

  it('extracts correct BEDÖMNING for second student', () => {
    const result = parser.extractRawBedömningFromContent(QFILE_WITH_BEDÖMNING, '222');
    expect(result).not.toBeNull();
    expect(result).toContain('Ecology');
    expect(result).not.toContain('Diffusion');
  });

  it('does NOT cross student boundaries', () => {
    const result = parser.extractRawBedömningFromContent(QFILE_WITH_BEDÖMNING, '111');
    // Should NOT contain student 222's data
    expect(result).not.toContain('Ecology');
    expect(result).not.toContain('## Elev 222');
  });

  it('returns null for student without BEDÖMNING', () => {
    const content = `## Elev 111 (30 ord)\n\nAnswer.\n\n## Elev 222 (20 ord)\n\nAnother.\n`;
    const result = parser.extractRawBedömningFromContent(content, '111');
    expect(result).toBeNull();
  });

  it('returns null for non-existent student', () => {
    const result = parser.extractRawBedömningFromContent(QFILE_WITH_BEDÖMNING, '999');
    expect(result).toBeNull();
  });

  it('handles ANALYTIC ASSESSMENT header', () => {
    const content = `## Elev 111 (10 ord)\n\nAnswer.\n\n### ANALYTIC ASSESSMENT:\n**A:** ✓ **1p**\n---\n`;
    const result = parser.extractRawBedömningFromContent(content, '111');
    expect(result).not.toBeNull();
    expect(result).toContain('ANALYTIC ASSESSMENT');
  });

  it('handles missing --- separator (bounded by next student)', () => {
    const content = `## Elev 111 (10 ord)\n\nAnswer.\n\n### BEDÖMNING:\n**A:** ✓ **1p**\n\n## Elev 222 (10 ord)\n\nOther.\n`;
    const result = parser.extractRawBedömningFromContent(content, '111');
    expect(result).not.toBeNull();
    expect(result).toContain('BEDÖMNING');
    // Note: without ---, bedömningEnd = nextStudentIndex, slice includes up to that line
    // This is a known edge case — assessments should always have --- separator
  });

  it('handles student with underscore ID', () => {
    const content = `## Elev 100300_200300 (10 ord)\n\nAnswer.\n\n### BEDÖMNING:\n**A:** ✓ **1p**\n---\n`;
    const result = parser.extractRawBedömningFromContent(content, '100300_200300');
    expect(result).not.toBeNull();
  });

  it('extracts BEDÖMNING when the header includes the student id (writer output)', () => {
    // The writer emits `### BEDÖMNING: <studentId>` (id appended), e.g. from
    // formatBedömning / writeFreetextAssessment. The parser must match this,
    // not only the bare `### BEDÖMNING:` header used in hand-written fixtures.
    const content = `## Elev 111 (30 ord)\n\nAnswer.\n\n### BEDÖMNING: 111\n**Diffusion:** ✓✓ **2p** - Good\n**TOTALPOÄNG: 2/3p**\n---\n`;
    const result = parser.extractRawBedömningFromContent(content, '111');
    expect(result).not.toBeNull();
    expect(result).toContain('Diffusion');
    expect(result).toContain('2/3p');
  });

  it('handles ANALYTIC ASSESSMENT header with id appended', () => {
    const content = `## Elev 222 (10 ord)\n\nAnswer.\n\n### ANALYTIC ASSESSMENT: 222\n**A:** ✓ **1p**\n---\n`;
    const result = parser.extractRawBedömningFromContent(content, '222');
    expect(result).not.toBeNull();
    expect(result).toContain('ANALYTIC ASSESSMENT');
  });
});

describe('AssessmentParser.parseBedömning', () => {
  it('parses structured assessment data', () => {
    const raw = `### BEDÖMNING:
**Diffusion:** ✓✓ **2p** - Good understanding
**Gasutbyte:** ✓ **1p** - Basic
**TOTALPOÄNG: 3/5p**
**Kommentar:** Decent effort.
**→ Nästa steg:** More detail needed.
---`;
    const result = parser.parseBedömning(raw);
    expect(result).not.toBeNull();
    expect(result!.totalPoints).toBe(3);
    expect(result!.maxPoints).toBe(5);
    expect(result!.aspects).toHaveLength(2);
  });

  it('returns null for empty input', () => {
    expect(parser.parseBedömning('')).toBeNull();
  });
});
