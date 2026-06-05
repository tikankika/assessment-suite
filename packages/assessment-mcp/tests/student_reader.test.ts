import { describe, it, expect } from 'vitest';
import { StudentReader } from '../src/core/student_reader.js';

const reader = new StudentReader();

// Standard Q-file format
const STANDARD_QFILE = `---
ASSESSMENT-STATUS:
  File: Q6_alla_elever.md
---

## Elev 100001 (47 ord)

Gasutbyte sker genom diffusion i alveolerna.
Syre diffunderar in och koldioxid ut.

---

## Elev AbcDef2002 (0 ord)

[Ingen svar]

---

## Elev 100300_200300 (23 ord)

Kort svar med underscore i ID.
`;

describe('StudentReader.parseStudentsFromContent', () => {
  it('parses standard Q-file correctly', () => {
    const students = reader.parseStudentsFromContent(STANDARD_QFILE);
    expect(students).toHaveLength(3);
    expect(students[0].id).toBe('100001');
    expect(students[0].wordCount).toBe(47);
    expect(students[1].id).toBe('AbcDef2002');
    expect(students[2].id).toBe('100300_200300');
  });

  it('supports underscore in student IDs', () => {
    const students = reader.parseStudentsFromContent(STANDARD_QFILE);
    const underscoreStudent = students.find(s => s.id === '100300_200300');
    expect(underscoreStudent).toBeDefined();
    expect(underscoreStudent!.answer).toContain('Kort svar');
  });

  it('preserves student answer text', () => {
    const students = reader.parseStudentsFromContent(STANDARD_QFILE);
    expect(students[0].answer).toContain('Gasutbyte sker genom diffusion');
    expect(students[0].answer).toContain('Syre diffunderar');
  });

  it('skips YAML frontmatter', () => {
    const students = reader.parseStudentsFromContent(STANDARD_QFILE);
    // Should not include YAML as a student
    expect(students.every(s => s.id !== 'ASSESSMENT-STATUS')).toBe(true);
  });

  it('marks assessed students via BEDÖMNING section', () => {
    const content = `## Elev 111 (10 ord)

Answer text.

### BEDÖMNING: 111
**Aspekt A:** ✓✓ **2p** - Good
**TOTALPOÄNG: 2/3p**
---

## Elev 222 (15 ord)

Another answer.
`;
    const students = reader.parseStudentsFromContent(content);
    expect(students[0].assessed).toBe(true);
    expect(students[1].assessed).toBe(false);
  });

  it('handles empty file gracefully', () => {
    const students = reader.parseStudentsFromContent('');
    expect(students).toHaveLength(0);
  });

  it('handles file with only frontmatter', () => {
    const students = reader.parseStudentsFromContent('---\nkey: value\n---\n');
    expect(students).toHaveLength(0);
  });

  it('handles zero word count', () => {
    const content = '## Elev 999 (0 ord)\n\n[Ingen svar]\n';
    const students = reader.parseStudentsFromContent(content);
    expect(students).toHaveLength(1);
    expect(students[0].wordCount).toBe(0);
  });

  it('marks student as assessed when BEDÖMNING is in their section', () => {
    const content = `## Elev 111 (10 ord)

Answer text here.

### BEDÖMNING: 111
Assessment content
---
`;
    const students = reader.parseStudentsFromContent(content);
    expect(students[0].assessed).toBe(true);
    expect(students[0].answer).toContain('Answer text here');
  });

  it('detects BEDÖMNING via pre-scan (BUGFIX 2026-01-19)', () => {
    // Pre-scan finds BEDÖMNING headers with student IDs anywhere in file
    const content = `## Elev 111 (10 ord)

Answer A.

### BEDÖMNING: 111
Assessment for 111
---

## Elev 222 (10 ord)

Answer B.
`;
    const students = reader.parseStudentsFromContent(content);
    expect(students.find(s => s.id === '111')!.assessed).toBe(true);
    expect(students.find(s => s.id === '222')!.assessed).toBe(false);
  });

  it('assigns correct sequential indices', () => {
    const students = reader.parseStudentsFromContent(STANDARD_QFILE);
    expect(students[0].index).toBe(0);
    expect(students[1].index).toBe(1);
    expect(students[2].index).toBe(2);
  });
});
