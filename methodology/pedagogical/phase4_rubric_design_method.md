# Phase 4: Rubrikdesign — Att Bygga Bedömningsanvisningar

**Version:** 1.0 — Initial
**Status:** Draft — Based on Review 19 analysis of COURSE_ENV rubric and Phase 4 tool output
**Teoretisk grund:** Jönsson (2010), Sadler (1989), Biggs & Collis (1982)
**Datum:** 2026-03-08
**Författare:** Niklas Karlsson

---

## Purpose

Phase 4 produces the **bedömningsanvisning** (rubric) — the document that defines what will be assessed, how, and against which criteria. The rubric is the single most consequential artefact in the Assessment Suite: every subsequent phase depends on it. Phase 6 assesses against it. Phase 9 generalizes from it. Phase 10 extrapolates from it. Phase 12/14 communicates based on it.

A good rubric produces consistent, transparent, formative assessments. A poor rubric produces assessments that are inconsistent, opaque, or misleading — regardless of how well the other phases function.

This document describes the principles and process of rubric design. For tool-specific instructions (how to use Phase 4A, 4B, 4C), see the corresponding tool guides: `phase4a_rubric_construction.md`, `phase4b_rubric_validation.md`, `phase4c_save.md`.

---

## Prerequisites

Before starting rubric design, the following phases must be complete:

- **Phase 2B** (question detection) — questions are identified in `exam_config.yaml`
- **Phase 2C** (answer boundaries) — answer boundaries identified, sample answers visible
- **Phase 2D** (student discovery) — students are registered

### Why this order?

Rubric construction *after* questions and answers are identified gives the teacher concrete material to work from. Building a rubric in the abstract — before seeing the actual exam questions and student responses — leads to criteria that are disconnected from what students actually produce. The sequence ensures the rubric is grounded in the exam as it exists, not as it was imagined.

---

## Theoretical Foundation

### Why analytic rubrics

The Assessment Suite uses **analytic rubrics** — rubrics that break each question into separately assessed aspects. This is a deliberate methodological choice, not a default:

Jönsson (2010) identifies two types of rubrics: holistic (one overall judgement per question) and analytic (separate judgements per aspect). The analytic approach has specific advantages:

> "Analytisk bedömning ger en mer nyanserad och detaljerad bild av prestationen [...] gör det möjligt att identifiera styrkor i vissa aspekter och utvecklingsmöjligheter i andra." (Jönsson, 2010)

For the Assessment Suite, analytic rubrics are essential because:
1. **Phase 6 requires them** — aspect-by-aspect assessment only works if aspects are defined
2. **Formative feedback depends on them** — "you need to improve on aspect 1b" is actionable; "you need to improve your answer" is not
3. **Consistency requires them** — when multiple students are assessed, aspect-level assessment reduces assessor drift (Sadler, 1989)

### Criteria must be interpretable by the student

Sadler (1989) argues that criteria only function formatively if the student can understand them:

> "The indispensable conditions for improvement are that the student comes to hold a concept of quality roughly similar to that held by the teacher." (Sadler, 1989, p. 121)

This means rubric criteria should be written in language that is specific enough for the student to understand what is expected. "Korrekt definition av hållbar utveckling" is more useful than "godkänd nivå på aspekt 1a".

### Cognitive alignment

Each question in an exam operates at a specific cognitive level. The rubric should reflect this. A question that asks students to *name* something (recall) requires different criteria than one that asks them to *analyse* something (higher-order thinking).

The SOLO taxonomy (Biggs & Collis, 1982) provides a framework for aligning question type with rubric criteria:

| Question type | SOLO level | Rubric criteria focus |
|--------------|-----------|----------------------|
| Name/list | Unistructural | Correct elements listed |
| Describe/explain | Multistructural | Multiple correct elements with descriptions |
| Analyse/compare | Relational | Connections between elements, integration |
| Evaluate/synthesize | Extended Abstract | Original application, critical perspective |

A rubric for a recall question (1–2p) needs simple, checkable criteria. A rubric for an analysis question (6–8p) needs multi-level criteria that distinguish between basic, developed, and advanced responses.

---

## Design Principles

### 1. Aspects with explicit criteria

Every question is divided into **named aspects** (1a, 1b, 1c...) with:
- A descriptive name (what this aspect assesses)
- A point value (how many points it's worth)
- A criterion (what the student must demonstrate for full points)

**Example (from COURSE_ENV):**
```
| Aspekt | Poäng | Kriterium |
|--------|-------|-----------|
| 1a Definition | 1p | Brundtland-definitionen eller liknande formulering |
| 1b Tre dimensioner | 1p | Namnger alla tre: social, ekologisk, ekonomisk |
```

### 2. Accepted alternatives

Students express knowledge in diverse ways. The rubric should anticipate common alternative formulations and state explicitly that they are accepted:

```
**Accepterade svar:** Ekologisk kan kallas "miljömässig". Social kan kallas "sociokulturell".
```

This reduces arbitrary penalization of students who use non-standard but correct terminology, and supports the "content over form" principle in Phase 6.

### 3. Misconception marking (⚠️)

The most powerful rubric feature in the Assessment Suite: explicitly marking common student misconceptions that should **not** receive credit.

```
**⚠️ M8:** Pollinering = stödjande (EJ försörjande). Om eleven skriver
pollinering som försörjande → 0p för det exemplet.
```

This serves three purposes:
1. **Phase 6 consistency:** AI and teacher both know what to flag as incorrect
2. **Formative feedback:** The misconception can be addressed in "Nästa steg"
3. **Class-level analysis (Phase 13):** If many students share a misconception, it signals a teaching issue

**Best practice:** Number misconceptions (M1, M2...) for cross-referencing. After Phase 6 is complete, review which misconceptions were most common.

### 4. Graduated criteria for complex questions

For questions worth more than 3 points, criteria should indicate what *partial credit* looks like — not just full credit or zero:

```
| Aspekt | Poäng | Kriterium |
|--------|-------|-----------|
| 13a Orsaker | 3p | 3p: Tre specifika hot med koppling till NOx |
|             |     | 2p: Två hot, eller tre utan tydlig koppling |
|             |     | 1p: Ett hot korrekt identifierat |
```

This makes half-point decisions less arbitrary in Phase 6.

### 5. Point allocation reflects question weight

The sum of aspect points must equal the question's total points. This is validated automatically in Phase 4B, but the *design* decision of how to distribute points is pedagogical:
- Give more points to aspects that assess higher-order thinking
- Give fewer points to recall aspects (unless recall is the point of the question)
- Ensure the total reflects the question's importance in the exam

---

## The Rubric Design Process

### Step 0: Inventory available material

Before designing the rubric, check what exists:

1. **`03_material/`** — Course materials? (syllabus, ILOs, presentations, lecture notes)
2. **`01_original/rubric.md`** — An existing rubric from the teacher or institution?
3. **`exam_config.yaml`** — Which questions exist? What are their point values?
4. **`02_markdown/student_answers/`** — Read 2–3 student answers per question to understand response patterns

This inventory determines which entry point to use.

### Three entry points

Different situations call for different starting points:

**A: From ILOs / course criteria** — When the course has explicit learning outcomes, start by mapping exam questions to ILOs, then derive aspects from what each question is intended to assess.

**B: From existing rubric** — When a rubric already exists (from previous exam, from colleague), start by validating it against the actual exam questions and adjusting for this specific exam.

**C: From content analysis** — When neither ILOs nor existing rubric exists, start by reading student answers (2–3 per question) and the exam questions themselves, then derive aspects from what the questions actually ask and what students actually demonstrate.

These are not mutually exclusive. A teacher can start from ILOs and refine by reading student answers.

### Process steps

1. **Inventory** — What materials exist? (syllabus, ILOs, existing rubric, student answers)
2. **Draft** — Write aspect tables for each question, following the design principles above
3. **Validate** — Phase 4B: check aspect sums, resolve conflicts, flag missing data
4. **Review against student answers** — Read 2–3 student answers per question. Does the rubric capture the variation in responses? Are there unexpected correct approaches not covered?
5. **Save** — Phase 4C: store in exam_config.yaml

### Iterative refinement

The rubric is not final after Phase 4. During Phase 6 (assessment), the teacher may discover:
- Aspects that are too vague ("the rubric doesn't tell me whether this counts")
- Accepted answers that weren't anticipated
- Misconceptions that should be marked
- Point allocations that don't match the difficulty

These adjustments are made via `rubric_edit` and logged for audit trail. The rubric is a living document during the assessment process.

---

## Output Format

### The rubric file

```markdown
# Bedömningsanvisningar — [Exam name]

**Kurs:** [course_code] | **Datum:** [date] | **Totalpoäng:** Xp

---

## Generella principer
[Common rules: content over form, partial credit, etc.]

---

## Fråga N (Xp) — [Title]
**[ILO] | [Cognitive level] | [Difficulty] | [Question type]**

> [The question text]

| Aspekt | Poäng | Kriterium |
|--------|-------|-----------|
| Na [Description] | Xp | [What the student must demonstrate] |
| Nb [Description] | Yp | [What the student must demonstrate] |

**Accepterade svar:** [Alternative formulations]
**⚠️ MN:** [Common misconception → consequence]

---
```

### exam_config.yaml integration

Phase 4B extracts rubric data into exam_config.yaml:
```yaml
questions:
  - id: Q001
    rubric_verified: true
    rubric_data:
      aspects:
        - id: "1a"
          name: "Definition"
          points: 1
          description: "Brundtland-definitionen"
      aspect_sum: 2
```

---

## Human-AI Collaboration

### What AI contributes

- **Consistency checking:** Validating that aspect points sum correctly, that all questions are covered
- **Pattern recognition:** Identifying common rubric structures across questions
- **Draft generation:** When building from content analysis (entry point C), AI can propose initial aspects based on question content

### What the teacher contributes

- **Criterion content:** What counts as correct? What are the expected answers?
- **Cognitive alignment:** Is this question testing recall or analysis?
- **Misconception knowledge:** What do students typically get wrong? What partial answers are common?
- **Point allocation:** How important is each aspect relative to others?
- **Final authority:** Every rubric decision is the teacher's decision

---

## Quality Criteria

### For the rubric as a whole

1. **Complete coverage:** Every question has aspects that sum to the question's total points
2. **Consistent granularity:** Similar questions have similar levels of detail in their criteria
3. **Assessable criteria:** Each criterion describes something observable in the student's answer (not something the teacher must infer)
4. **Accepted alternatives documented:** Common correct variations are explicitly listed
5. **Misconceptions marked:** At least for questions where experience shows common errors

### For individual question rubrics

1. **Aspects are distinct:** Each aspect assesses something different (no overlap)
2. **Criteria are specific:** A reader can determine whether a given answer meets the criterion
3. **Partial credit is possible:** For questions worth ≥3p, the rubric indicates what partial credit looks like
4. **Cognitive level is appropriate:** The criteria match the question's intended cognitive demand

### What Phase 4 does NOT do

- It does not assess student work (that is Phase 6)
- It does not determine grades (that is Phase 10/11)
- It does not produce student feedback (that is Phase 12/14)
- It does not compare students to each other

---

## Relationship to Other Methodology Files

| File | Relationship |
|------|-------------|
| `phase6_assessment_method.md` | **Downstream (primary consumer):** Phase 6 assesses against the rubric. Rubric quality directly determines Phase 6 quality. |
| `phase4a_rubric_construction.md` | **Tool guide:** Step-by-step workflow for building rubrics. This methodology file provides the *why*; 4A provides the *how*. |
| `phase4b_rubric_validation.md` | **Tool guide:** Detailed instructions for the Phase 4B validation tool. |
| `phase4c_save.md` | **Tool guide:** Student completion report — data quality check. |

---

## References

- Biggs, J. B., & Collis, K. F. (1982). *Evaluating the Quality of Learning: The SOLO Taxonomy (Structure of the Observed Learning Outcome)*. Academic Press.
- Jönsson, A. (2010). *Lärande bedömning* (3rd ed.). Gleerups.
- Sadler, D. R. (1989). Formative assessment and the design of instructional systems. *Instructional Science*, 18, 119–144.
