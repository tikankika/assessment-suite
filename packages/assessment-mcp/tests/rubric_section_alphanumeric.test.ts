import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { RubricParser } from '../src/shared/rubric_parser.js';
import type { QuestionConfig } from '../src/shared/exam_config_reader.js';

// A rubric whose question headings carry alphanumeric identifiers, as the
// fabricated example does ("## Fråga A1: …"). The section shown to the
// teacher must end where the next question begins, not at the end of the file.

const parser = new RubricParser();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE_RUBRIC = path.resolve(
  HERE, '../../../examples/biog2000x_immunforsvaret/immune_system_exam/01_original/rubric.md',
);

const ALPHANUMERIC_RUBRIC = `# Bedömningsanvisningar

# Del A: Faktafrågor

## Fråga A1: Fagocytos (1p)

**Identifier:** A1

**A1a:** Definition (1p)
Cellen omsluter och bryter ner.

## Fråga A2: Mastceller (2p)

**Identifier:** A2

**A2a:** Histamin (1p)
Frisätter histamin.

# Del B: Förklara

## Fråga B1: Vaccination (3p)

**B1a:** Minnesceller (3p)
`;

const question = (overrides: Partial<QuestionConfig>): QuestionConfig => ({
  id: 'Q001', number: 1, question_title: 'Fagocytos', rubric_id: 'A1', points: 1, ...overrides,
});

describe('rubric section with alphanumeric question identifiers', () => {
  it('ends at the next question when found by title', async () => {
    const section = await parser.extractFullSectionFromContent(ALPHANUMERIC_RUBRIC, question({}));
    expect(section).toContain('Fråga A1');
    expect(section).toContain('A1a');
    expect(section).not.toContain('Fråga A2');
    expect(section).not.toContain('Del B');
  });

  it('ends at the next question when found by identifier only', async () => {
    const section = await parser.extractFullSectionFromContent(
      ALPHANUMERIC_RUBRIC, question({ question_title: 'no such title', rubric_id: 'A2', number: 2 }),
    );
    expect(section).toContain('Fråga A2');
    expect(section).not.toContain('Fråga A1');
    expect(section).not.toContain('Del B');
  });

  it('ends at a higher-level heading when the question is last in its part', async () => {
    const section = await parser.extractFullSectionFromContent(
      ALPHANUMERIC_RUBRIC, question({ question_title: 'Mastceller', rubric_id: 'A2', number: 2 }),
    );
    expect(section).toContain('A2a');
    expect(section).not.toContain('Del B');
    expect(section).not.toContain('B1a');
  });

  it('returns only question 1 from the fabricated example rubric', async () => {
    const section = await parser.extractFullSection(EXAMPLE_RUBRIC, question({}));
    expect(section).toContain('Fråga A1');
    expect(section).not.toContain('Fråga A2');
    expect(section.length).toBeLessThan(2000);
  });
});
