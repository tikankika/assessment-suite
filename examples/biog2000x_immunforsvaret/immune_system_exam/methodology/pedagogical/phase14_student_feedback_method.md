# Phase 14: Elevåterkoppling — Dokumentet Eleven Får

**Version:** 1.1 — Assessment Purpose integration + length enforcement
**Status:** Draft — Updated 2026-03-30 with proportionality, per-question assessments, length constraints
**Teoretisk grund:** Hattie & Timperley (2007), Sadler (1989)
**Datum:** 2026-03-08 (reviderad 2026-03-30)
**Författare:** Niklas Karlsson

---

## Purpose

Phase 14 produces the document that the **student actually receives**. It is not a new analysis — it is a selection and rewriting of Phase 12 (the teacher's working document) for a student audience.

The teacher decides what to include, what to leave out, and how to phrase it. AI produces a draft; the teacher edits until satisfied.

### Why Phase 14 is separate from Phase 12

Phase 12 is the teacher's internal document: complete, analytical, sometimes technical. It may contain:
- Criterion-level analysis the student wouldn't understand
- Calibration notes about how this student compares to the class
- Detailed strategy rationales that the teacher needs but the student doesn't

Phase 14 extracts the parts that serve the student's learning and presents them in language the student can act on.

| Aspect | Phase 12 (teacher) | Phase 14 (student) |
|--------|-------------------|-------------------|
| Audience | Teacher | Student |
| Tone | Professional, analytical | Direct, encouraging, honest |
| Detail level | Full criterion analysis | Selected highlights |
| Language | May use assessment terminology | Plain language |
| Purpose | Documentation + basis for Phase 14 | Formative: help the student improve |

### Input source

Phase 14's **sole input** is Phase 12. It does not read directly from Phase 7, 8, 9, or 10. This ensures that the student receives a curated subset of a complete analysis, not a parallel analysis from different sources.

If Phase 12 does not exist, Phase 14 cannot be produced.

---

## Assessment Purpose Integration

Phase 14 reads the Assessment Purpose document (see `assessment_purpose_method.md`) to determine its depth level. Phase 14 *always* runs — students always receive feedback.

- **Full:** Complete feedback with per-question assessments, strengths, development areas, and strategies. Standard for prov, stort prov, and tenta/prövning.
- **Short:** Briefer narrative (strengths + development areas + 2–3 tips) but **per-question assessments are always included**. Standard for minitest.

If no Assessment Purpose document exists, Phase 14 defaults to **full** (backward compatibility).

### Per-question assessments

**Per-question assessments are always included regardless of pipeline level.** The student has the right to see how each question was assessed. These come from Phase 6 output and are presented in the results table (see Output Format). This is not optional — even a minitest includes the per-question breakdown.

### Length constraints

**Known issue (2026-03-30):** Review of an earlier course run revealed Phase 14 producing 170+ lines per student — far exceeding the "one page" specification. This happened because per-question assessments were presented as narrative paragraphs rather than a compact table, and the feedback narrative was not constrained.

**Enforced limits:**
- **Full mode:** Narrative feedback (excluding per-question table) should fit on one page (~300 words). Per-question assessments are presented as a table, not as narrative paragraphs.
- **Short mode:** Narrative feedback ~150 words. Per-question table included.

The per-question table is *in addition to* the narrative — it is a separate section that the student can consult but is not required to read for the main message.

---

## The Selection Process

### What to include

The teacher selects from Phase 12 based on:

1. **What the student can act on.** Development areas where the student has agency — not systemic issues, not things that require resources the student doesn't have.

2. **What won't overwhelm.** Research consistently shows that too much feedback is counterproductive. Phase 14 should contain 2–3 strengths and 2–3 development areas with strategies — not an exhaustive list.

3. **What the student needs to hear.** Sometimes the most important feedback is encouragement (for a struggling student) or a challenge (for a strong student who coasted).

### What to leave out

- Criterion/ILO-level analysis (unless the student is familiar with the terminology)
- Calibration notes about the class
- Technical assessment rationales ("generös tolkning tillämpad")
- Detailed Phase 9 pattern language
- Anything that would confuse more than help

### Rewriting principles

1. **Write directly to the student** — use "du"
2. **Start with strengths** — the student should see what they did well before what needs work
3. **Be concrete** — "I Q13 visade du att du kan koppla resiliens till artrikedom" not "Du har god analysförmåga"
4. **Be honest** — don't praise where praise isn't warranted. A student who scored 20% should not be told "bra jobbat!" but can be told "du visar förståelse för X — det är en grund att bygga vidare på"
5. **Be actionable** — every development area should come with something the student can *do*
6. **Be brief** — the entire document should fit on one page

---

## Output Format

### Complete document structure

```markdown
# Återkoppling: [exam_name]

Hej [student_id],

Här är en sammanfattning av ditt resultat och tips för hur du kan utvecklas vidare.

## Ditt resultat

**Totalpoäng:** X/Yp (Z%)

| Fråga | Poäng | Max |
|-------|-------|-----|
| [Q1 — short title] | X | Y |
| ... | ... | ... |

## Det här gick bra

- [Strength 1 — concrete, with reference to specific question/answer]
- [Strength 2]

## Det här kan du utveckla

- [Development area 1 — concrete, non-judgemental]
- [Development area 2]

## Tips för att komma vidare

### [Development area 1]
[1–2 concrete strategies, written as actions: "Testa att...", "Öva på..."]

### [Development area 2]
[1–2 concrete strategies]

---

## Bedömning per fråga

| Fråga | Poäng | Max | Kort kommentar |
|-------|-------|-----|----------------|
| [Q1 — title] | X | Y | [One sentence from Phase 6] |
| [Q2 — title] | X | Y | [One sentence from Phase 6] |
| ... | ... | ... | ... |

---

*Lycka till! /[Teacher name]*
```

### Metadata

Output file: `14_student_feedback/Student_{id}_elevfeedback.md`

---

## Human-AI Collaboration

### The process

1. **`phase14_start`** — AI reads Phase 12 document and generates a complete draft
2. **Teacher reviews** — reads the draft, checks tone, content, accuracy
3. **`phase14_continue`** — Teacher approves ("ok") or requests changes ("ändra tonen i styrkor", "lägg till tips om kapitel 3")
4. **`phase14_complete`** — Final version saved

### What AI contributes

- **Draft generation:** AI selects the most student-relevant content from Phase 12 and rewrites it in student-friendly language
- **Tone calibration:** AI adapts the level of encouragement to the student's performance level
- **Structural consistency:** Every student gets the same document structure

### What the teacher contributes

- **Selection:** Is this the right content for this student?
- **Tone:** Does it sound right? Too harsh? Too soft? Too generic?
- **Personal touch:** Adding course-specific tips ("läs om detta i kapitel 5"), personal encouragement, or context the student needs
- **Final approval:** No document goes to a student without the teacher's explicit approval

---

## Quality Criteria

### For individual student documents

1. **Readable:** A student can read and understand the entire document without help
2. **Actionable:** The student can identify at least one concrete thing to do differently
3. **Honest:** Strengths are real strengths, not filler. Development areas are real, not sugarcoated beyond recognition
4. **Brief:** Fits on one page (approximately). The student should be able to read it in 3–5 minutes
5. **Strength-first:** The document opens with what the student did well
6. **Teacher-approved:** The teacher has explicitly approved every document

### For the full cohort

1. **Differentiated:** No two students receive identical feedback (beyond the structural template)
2. **Consistently honest:** Tone is calibrated similarly — a student at 40% shouldn't get more praise than a student at 80%
3. **Privacy-respecting:** No references to other students or class averages in the individual document

### Phase 12 → Phase 14 transformation rules

When deriving Phase 14 from Phase 12, the AI **must** apply these filters:

**1. Strip** any sentence containing class-relative phrases. Regex equivalents:

- `klass(en|ens)\b`, `i klassen`, `klassnittet`
- `den enda eleven`, `första eleven`, `näst[- ]bäst`
- `få elever`, `bland de (högst|bäst)`, `mest (sofistikerad|komplett|stringent|precis|exempelrik)` (and inflected forms)

**2. Rewrite** in-class ranking phrases into criterion-relative description:

| Before | After |
|--------|-------|
| "Klassens topp-elev" | "Visar A-nivå på alla tre förmågor" |
| "Den enda eleven som..." | "Du visar [specific competence]" |
| "Klassens mest kompletta svar" | "Ett mycket komplett svar" |
| "Få elever når denna nivå" | "En avancerad nivå" |

**3. Remove** entirely:

- Other student IDs (5-digit references to other students in the cohort)
- SOLO/Relational/Extended Abstract/Multistructural/Unistructural/Prestructural terminology
- "Lärarreflektion", "Pedagogisk hypotes", "Mönster — [studentID]" sections in their entirety
- "Hattie & Timperley (2007) — tre återkopplingsfrågor" research-framework headings (keep the underlying questions in plain Swedish)
- "Feed Up / Feed Back / Feed Forward" labels (replace with the Swedish question that follows the label)
- "Bedömt av [name + AI]" signatures (teacher-internal metadata)
- Invalid grades (`A+`, `B-`, percentage-based grade equivalents)

**4. Pre-save verification** (mirrors §3.8 of `00_foundation.md`):

- Document length: approximately one page (3–5 minute read)
- Sole input was Phase 12 (no direct copy-in from Phase 6, 7, 8, 9, 10)
- Only valid grade letters appear (E/D/C/B/A)
- No regex hit on any item in the strip list

The AI must run this verification before writing the file. If any check fails, the AI must either fix the output or surface the violation to the teacher with options (per §3.9 of `00_foundation.md`).

### What Phase 14 does NOT do

- It does not contain new analysis. All content comes from Phase 12.
- It does not assign or communicate grades. (If grading is communicated, that is a separate process.)
- It does not replace the teacher's direct communication with the student. It supplements it.

---

## Relationship to Other Methodology Files

| File | Relationship |
|------|-------------|
| `phase12_feedback_method.md` | **Upstream (sole source):** Phase 14 selects from and rewrites Phase 12. No other input source. |
| `phase6_assessment_method.md` | **Upstream (indirect):** Phase 6 "Nästa steg" provides question-level feedback. Phase 14 provides student-level feedback. They complement each other. |

---

## References

- Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of Educational Research*, 77(1), 81–112.
- Sadler, D. R. (1989). Formative assessment and the design of instructional systems. *Instructional Science*, 18, 119–144.
