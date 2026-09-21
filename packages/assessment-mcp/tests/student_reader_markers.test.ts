import { describe, it, expect } from 'vitest';
import { StudentReader } from '../src/core/student_reader.js';

// Question files carry Phase 5 markers around each student's section and,
// after assessment, a Phase 6 block. What is returned as the student's answer
// must be the answer text only.

const reader = new StudentReader();

const QFILE_WITH_MARKERS = `---
ASSESSMENT-STATUS:
  File: Q001_alla_elever.md
---

<!-- PHASE5_STUDENT_START student_id="elev_a" question_id="Q001" -->
## Elev elev_a (12 ord)

**Svar:**

Fagocytos är när en cell omsluter och bryter ner en patogen.

<!-- PHASE5_ANSWER
student_id: elev_a
question_id: Q001
total_words: 12
sub_questions: [none]
-->
<!-- PHASE5_STUDENT_END -->

---

<!-- PHASE5_STUDENT_START student_id="elev_b" question_id="Q001" -->
## Elev elev_b (3 ord)

Celler äter bakterier.

<!-- PHASE5_ANSWER
student_id: elev_b
question_id: Q001
total_words: 3
sub_questions: [none]
-->
<!-- PHASE6_ASSESSMENT_START student_id="elev_b" -->
### BEDÖMNING: elev_b

**A1a:** ✓ **1p** - Anger nedbrytning.

**TOTALPOÄNG: 1/1p**
**→ Nästa steg:** Förklara hur.

<!-- PHASE6_ASSESSMENT
student_id: elev_b
total_points: 1
max_points: 1
-->
<!-- PHASE6_ASSESSMENT_END -->
<!-- PHASE5_STUDENT_END -->

---
`;

describe('student answers read from a question file with markers', () => {
  const students = reader.parseStudentsFromContent(QFILE_WITH_MARKERS);

  it('finds both students', () => {
    expect(students.map((s) => s.id)).toEqual(['elev_a', 'elev_b']);
  });

  it('returns the answer text without Phase 5 markers or separators', () => {
    expect(students[0].answer).toBe('**Svar:**\n\nFagocytos är när en cell omsluter och bryter ner en patogen.');
  });

  it('returns the answer without the assessment block and marks the student assessed', () => {
    expect(students[1].answer).toBe('Celler äter bakterier.');
    expect(students[1].assessed).toBe(true);
    expect(students[0].assessed).toBe(false);
  });
});
