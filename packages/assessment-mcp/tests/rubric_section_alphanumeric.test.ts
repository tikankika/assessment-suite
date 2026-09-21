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

  // The question number must identify one question. A heading that merely
  // contains the digit belongs to another question, and the exact identifier
  // must decide instead.
  it('does not take a sub-question heading for its parent question', async () => {
    const rubric = [
      '## Fråga 6A: Delfråga (1p)', '', '**6Aa:** något', '',
      '## Fråga 6: Diffusion (2p)', '', '**6a:** diffusion förklaras', '',
    ].join('\n');
    const section = await parser.extractFullSectionFromContent(
      rubric, question({ question_title: 'no such title', rubric_id: undefined, number: 6 }),
    );
    expect(section).toContain('Fråga 6: Diffusion');
    expect(section).not.toContain('Delfråga');
  });

  it('prefers the exact identifier when parts repeat the same number', async () => {
    const rubric = [
      '## Fråga A1: Första delen (1p)', '', '**Identifier:** A1', '', '**A1a:** del A', '',
      '## Fråga B1: Andra delen (2p)', '', '**Identifier:** B1', '', '**B1a:** del B', '',
    ].join('\n');
    const section = await parser.extractFullSectionFromContent(
      rubric, question({ question_title: 'no such title', rubric_id: 'B1', number: 1 }),
    );
    expect(section).toContain('Fråga B1');
    expect(section).not.toContain('Fråga A1');
  });

  // A rubric may quote an example answer in a fenced block. A line inside the
  // fence that starts with "#" is quoted text, not the next question.
  it('does not end the section inside a fenced example answer', async () => {
    const fence = '```';
    const rubric = [
      '## Fråga 3: Titel (2p)', '', 'Exempelsvar:', '',
      fence, '# rubrik i elevsvar', 'mer text', fence, '',
      '**3a:** aspekt som måste visas', '',
      '## Fråga 4: Nästa (1p)', '', '**4a:** nästa aspekt', '',
    ].join('\n');
    const section = await parser.extractFullSectionFromContent(
      rubric, question({ question_title: 'no such title', rubric_id: undefined, number: 3 }),
    );
    expect(section).toContain('**3a:**');
    expect(section).not.toContain('Fråga 4');
  });

  it('returns only question 1 from the fabricated example rubric', async () => {
    const section = await parser.extractFullSection(EXAMPLE_RUBRIC, question({}));
    expect(section).toContain('Fråga A1');
    expect(section).not.toContain('Fråga A2');
    expect(section.length).toBeLessThan(2000);
  });
});
