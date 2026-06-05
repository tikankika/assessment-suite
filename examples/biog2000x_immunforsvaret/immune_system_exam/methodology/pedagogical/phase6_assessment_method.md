# Phase 6: Analytisk Aspektbedömning

**Version:** 1.0 - Initial
**Status:** Draft - Based on Review 16 analysis of actual output from three courses
**Teoretisk grund:** Jönsson (2010), Biggs & Collis (1982), Sadler (1989), Hattie & Timperley (2007)
**Datum:** 2026-03-08
**Författare:** Niklas Karlsson

---

## Purpose

Phase 6 is where analytic assessment happens — the process of systematically evaluating each student's answer against the rubric, aspect by aspect, and producing a transparent assessment with forward-looking feedback.

This is the highest-stakes process in the Assessment Suite. Every subsequent phase (generalization, extrapolation, grading, feedback) depends on the quality and consistency of Phase 6 assessments. It is also the process where AI and teacher collaborate most intensively: AI proposes assessments that the teacher reviews, adjusts, and approves.

This document describes the method that Phase 6 actually implements. It does not describe general assessment theory (see `bedomningsmetod_generell_v2.md`) or the AI's overall role (see `instruktioner_ai_bedomning_v2.md`). It describes **what happens, how, and why**.

---

## Theoretical Foundation

### Analytic assessment

Phase 6 implements **analytic assessment** as described by Jönsson (2010): evaluating multiple aspects of a student's performance separately rather than making a single holistic judgement. This approach has specific advantages for formative purposes:

> "Analytisk bedömning ger en mer nyanserad och detaljerad bild av prestationen [...] gör det möjligt att identifiera styrkor i vissa aspekter och utvecklingsmöjligheter i andra [...] skapar goda förutsättningar för formativ bedömning." (Jönsson, 2010)

The decision to assess aspect-by-aspect rather than holistically is not pragmatic — it is methodological. Analytic assessment produces the differentiated information needed for meaningful feedback. A holistic "2/3 points" tells the student nothing about what was strong and what needs work. An analytic assessment that shows ✓✓✓ on naming but ✗ on function tells the student exactly where to focus.

#### Known risks of analytic assessment

Analytic assessment is not without pitfalls. Jönsson (2010) and others identify three:

1. **Fragmentation:** Breaking a response into aspects can obscure the whole. A student who writes a coherent, well-structured argument may score poorly on individual aspects if the rubric does not capture "coherence" as an aspect. Phase 9 (generalization) exists partly to counteract this — it looks across aspects and questions to recover the holistic picture.

2. **Aspect inflation:** Simpler, more easily measurable aspects (e.g., "names three examples") tend to dominate rubrics because they are easier to define and assess. More complex aspects (e.g., "demonstrates integrated understanding") are harder to operationalize and may receive less weight than they deserve. The SOLO mapping helps here: if all aspects in a rubric are at the Unistructural level, the rubric is probably too simple for the question's cognitive demand.

3. **Mechanical application:** When AI proposes assessments, there is a risk that the process becomes mechanical — checking boxes rather than engaging with the student's thinking. The teacher's role is to resist this: to read the student's answer as a *whole* before reviewing the aspect-level proposal, and to flag cases where the analytic breakdown misses something important.

### Criterion-referenced assessment

All Phase 6 assessment is **criterion-referenced** (Sadler, 1989): student performance is evaluated against explicit criteria defined in the rubric, not against other students' performance and not against the assessor's intuitions. Sadler's foundational argument:

> "The indispensable conditions for improvement are that the student comes to hold a concept of quality roughly similar to that held by the teacher, is able to monitor continuously the quality of what is being produced during the act of production itself, and has a repertoire of alternative moves or strategies from which to draw at any given point." (Sadler, 1989, p. 121)

This has direct implications for Phase 6: the assessment must be written so that the student can understand both the criteria and how their work relates to those criteria. Transparency is not a nice-to-have — it is a validity requirement.

#### Pre-defined vs. emergent criteria

Sadler (2009) also argues that criteria which *emerge* in the encounter with a unique student performance can be more accurate than criteria defined in advance — because no pre-set rubric can anticipate every form a valid answer might take. This is a serious objection. The Assessment Suite takes the position that **pre-defined criteria are preferred** for the following reasons: they ensure consistency across students, they make the assessment transparent and contestable, and they enable meaningful comparison. However, generous interpretation (see below) is the mechanism by which the system accommodates Sadler's concern: when a student's answer is valid in a way the rubric did not anticipate, the teacher can award credit with documentation rather than being forced to withhold it because the rubric is silent. The rubric constrains but does not imprison.

### The quality symbol system and SOLO taxonomy

Phase 6 uses a symbol system (✓✓✓ / ✓✓ / ✓ / ⚠ / ✗) that has emerged from practice across three courses (COURSE_ENV, COURSE_AI, COURSE_BIO). This system maps implicitly to the SOLO taxonomy (Biggs & Collis, 1982), which describes qualitative differences in learning outcomes:

| Symbol | Meaning | SOLO level | Typical assessment |
|--------|---------|------------|-------------------|
| ✓✓✓ | Complete, developed, integrated | Relational / Extended Abstract | Full points for this aspect |
| ✓✓ | Correct, acceptable | Multistructural | Approved — meets criterion |
| ✓ | Partially correct, basic level | Unistructural | Basic — one correct element |
| ⚠ | Uncertain, requires interpretation | Borderline | Context-dependent |
| ✗ | Incorrect or missing | Prestructural | 0 points for this aspect |
| - | Not applicable | — | Aspect not relevant for this student |

The SOLO connection matters for two reasons. First, it grounds the symbols in established theory rather than ad hoc convention. Second, it provides a shared vocabulary for discussing quality differences — a symbol of ✓ means something qualitatively different from ✓✓, not just "fewer points."

Biggs and Collis (1982) define the levels as follows:

- **Prestructural:** The student has not engaged with the task in a meaningful way. The response shows no understanding of the relevant concepts.
- **Unistructural:** The student has grasped one relevant aspect but misses others. The response is correct but limited.
- **Multistructural:** The student handles several relevant aspects but does not integrate them. The response lists correct elements without connecting them.
- **Relational:** The student integrates multiple aspects into a coherent whole. The response shows understanding of how parts relate.
- **Extended Abstract:** The student generalizes beyond the given context or applies understanding to new situations.

Not every aspect in every question will span the full SOLO range. A simple identification question (name three endocrine glands) operates mainly at the Unistructural/Multistructural boundary. A discussion question (analyse the relationship between biodiversity and ecosystem stability) can reach Relational and Extended Abstract. The symbols adapt to the question's cognitive demand.

### Forward-looking feedback

Every Phase 6 assessment ends with a "Nästa steg" (Next step) field. This implements Hattie and Timperley's (2007) feedback model, which identifies three feedback questions:

1. **Where am I going?** (Feed up) — What are the goals? → Addressed by the rubric and aspect structure
2. **How am I going?** (Feed back) — How does my work relate to the goals? → Addressed by the aspect-level assessment
3. **Where to next?** (Feed forward) — What do I need to do to improve? → Addressed by "Nästa steg"

Hattie and Timperley (2007, p. 90) found that feed-forward — information about what to do next — is the most powerful type of feedback for learning. The "Nästa steg" field is therefore not an optional appendix but a core component of the assessment.

The feedback must be:

- **Specific** to the student's actual response (not generic)
- **Actionable** — the student should be able to act on it
- **Calibrated to level** — a student who scored 0 needs different guidance than one who scored near-full

---

## Assessment Principles

### Content over form

When a student's answer is factually correct but poorly formulated, the content takes precedence. This principle separates subject knowledge from linguistic ability and is fundamental to valid assessment of subject-specific competence.

**Priority ranking** (highest to lowest):
1. **Correct content** — Is the answer factually right?
2. **Subject-specific concepts** — Does the student use relevant terminology?
3. **Reasoning development** — Is the answer appropriately developed for the point value?
4. **Perfect formulation** — Is the language polished?

When in doubt, a higher-priority element overrides a lower one. A factually correct answer with poor formulation passes; a beautifully written answer with factual errors does not.

**Apply when:**
- The student shows correct understanding despite spelling errors, grammatical issues, or non-standard formulations
- The student uses alternative formulations or synonyms that are factually correct
- The question asks for subject knowledge, not language proficiency
- The point value is low (1-2p) and the answer demonstrates basic understanding

**Do not apply when:**
- The formulation is so unclear that the intended meaning cannot be determined
- The question explicitly requires correct use of terminology
- The imprecise formulation reveals a conceptual misunderstanding (not just a language issue)
- Important aspects are missing entirely (not a formulation issue — a content issue)
- The question requires developed reasoning (3p+) but the student writes only one sentence (not a form issue — an effort/depth issue)

This principle is documented explicitly in each assessment where it is applied, using the phrase "Innehåll före form" or "Generös tolkning" followed by the specific reasoning.

### Generous interpretation

When a student's answer is ambiguous — it could be interpreted as correct or incorrect depending on reading — the assessment gives the student the benefit of the doubt. This is not leniency. It is a principled position: in formative assessment, the goal is to identify what the student knows, not to find reasons to withhold credit.

Sadler (2009) discusses the inherent indeterminacy of applying preset criteria to diverse student work, arguing that some degree of interpretation is unavoidable. The generous interpretation principle makes this interpretation explicit and consistent.

**Generous interpretation is documented** every time it is applied: the assessment states what was ambiguous, how it was interpreted, and why.

### Error identification

When a student's answer contains factual errors, the assessment identifies the error explicitly and provides the correct information. This serves a formative purpose: the student learns not only that something was wrong, but what is right.

Example from practice (COURSE_BIO):
> **1c:** ✗ **0p** — Hypotalamus: 'producerar adrenalin vid stressituationer' — FELAKTIGT, adrenalin produceras av binjurarna. Sköldkörteln: 'producerar noradrenalin, återhämtning' — FELAKTIGT, sköldkörteln producerar T3/T4 som reglerar ämnesomsättningen.

The correction is brief, factual, and directly addresses the student's specific misunderstanding.

---

## The Assessment Format

### Per-student assessment block

Each student receives an assessment block with the following structure:

```markdown
### BEDÖMNING: [student_id]

**[aspekt_id] ([kort beskrivning]):** [symbol] **[poäng]p** - [motivering med hänvisning till elevsvaret]
**[aspekt_id] ([kort beskrivning]):** [symbol] **[poäng]p** - [motivering]

**TOTALPOÄNG: X/Yp**
**→ Nästa steg:** [individualiserad, specifik, framåtriktad återkoppling]
```

### Aspect identification

Aspects are derived from the rubric for each question. They are named with the question number and a letter (e.g., 1a, 1b, 1c) followed by a short description in parentheses. The description should be specific enough that the student understands what is being assessed.

Examples from practice:
- `1a (Definition)` — Can the student define sustainable development?
- `1b (Tre dimensioner)` — Can the student name and describe the three dimensions?
- `8a (Miljöhot 1)` — Can the student identify a first environmental threat from NOx?

### Point assignment

Points are assigned per aspect. The sum of aspect points equals the total points for the question. Half-points (0.5p) are used when the student demonstrates partial understanding within an aspect.

### Metadata block

Each assessment includes a machine-readable metadata block:

```html
<!-- PHASE6_ASSESSMENT
student_id: [id]
total_points: [X]
max_points: [Y]
assessed_by: [name]
assessed_at: [ISO timestamp]
format_version: 2
-->
```

The `assessed_by` field must identify who conducted or approved the assessment. A value of "unknown" indicates a traceability gap that should be addressed.

---

## Human-AI Collaboration

### The assessment process

Phase 6 operates as a **human-in-the-loop** process. This means:

1. **AI reads** the student's answer and the rubric section for the current question
2. **AI produces** a complete assessment proposal — aspect structure, symbols, points, comments, and "Nästa steg"
3. **The teacher reviews** the proposal and either approves it or requests adjustments
4. **The assessment is saved** with metadata recording the assessor and timestamp
5. **Adjustments are logged** via `teacher_annotation` for research purposes

This is not a dialogic process in the sense of DEL 3A in `instruktioner_ai_bedomning_v2.md`. It is closer to what that document calls "Direkt analytisk bedömning" (DEL 3B), with the critical addition that the teacher reviews and can modify every assessment before it is saved.

### What AI contributes

AI's contribution is consistency and structure. Given a rubric with defined aspects, AI applies the same analytical framework to every student's answer. This addresses two known problems in human assessment:

1. **Drift** — the tendency for assessment standards to shift over time, especially when grading many papers (Sadler, 1989)
2. **Halo effects** — the tendency for overall impression of a student to colour assessment of individual aspects

AI does not solve these problems — a teacher must still review each assessment — but it provides a consistent starting point that makes drift and halo effects more visible when they occur.

### What the teacher contributes

The teacher's contribution is judgement, context, and authority. Specifically:

- **Subject expertise:** AI may misidentify factual errors or miss correct answers that use non-standard terminology
- **Student context:** The teacher knows what was taught, what examples were used in class, and what level of detail was expected
- **Borderline decisions:** When a student's answer falls between quality levels, the teacher makes the call
- **Generosity calibration:** The teacher decides how generously to interpret ambiguous answers, maintaining consistency across students
- **Final authority:** Every assessment is the teacher's assessment. AI's proposal is a proposal.

### The calibration effect

A distinctive feature of the Phase 6 process is that reviewing AI's proposals has a calibrating effect on the teacher. When AI proposes an assessment that differs from what the teacher expected, it forces the teacher to articulate why — either adjusting their own standard or explaining why AI's proposal is wrong. This makes the teacher's implicit assessment criteria more explicit, which Jönsson (2010) identifies as a key benefit of analytic assessment:

> "Analytisk bedömning [...] gör bedömningen mer transparent — både för lärare och elev." (Jönsson, 2010)

The calibration effect is most pronounced during the first few assessments of a question, after which both teacher and AI have established a shared understanding of the quality levels for that specific question.

### Teacher annotations

During assessment, the teacher may intervene in ways that carry methodological significance. These interventions are logged silently using `teacher_annotation` with the following types:

| Intervention | Type | Example |
|-------------|------|---------|
| Teacher clarifies how a criterion should be interpreted | `rubric_clarification` | "Elevation needs to mention future generations" |
| Teacher finds an error in the rubric | `rubric_correction` | "Max points should be 3, not 2" |
| Teacher requests generous interpretation | `generous_interpretation` | "Accept 'atmosphere' as environmental threat" |
| Teacher adjusts proposed score | `score_adjustment` | "Give 2p instead of 1.5p — shows understanding" |
| Teacher adds domain knowledge | `context_addition` | "We used the road metaphor in class" |
| Teacher wants to revise a previous assessment | `retroactive_change` | "Go back to student X, same issue" |
| Teacher comments on consistency | `calibration_note` | "This is equivalent to student Y's answer" |

These annotations are logged **silently** — the teacher is not asked "shall I log this?" The logging must not disrupt the assessment flow.

---

## Quality Criteria

### For individual assessments

Each assessment should satisfy:

1. **Traceability:** Every point awarded or withheld is linked to a specific part of the student's answer
2. **Transparency:** A third party (another teacher, the student, a reviewer) should be able to understand why this score was given
3. **Consistency:** Similar answers across students receive similar assessments (check by reviewing the full Q-file after completion)
4. **Formative value:** The "Nästa steg" gives the student actionable information about what to do next
5. **Factual correctness:** Error identifications are accurate; correct information is provided

### For the full Q-file (all students on one question)

After completing assessment of all students for a question:

1. **Score distribution:** Does the distribution make sense given the class? Extreme distributions (all full marks, or all zero) warrant review
2. **Aspect consistency:** Is the same level of detail and stringency applied to aspect 1a across all students?
3. **Generous interpretation consistency:** Where generous interpretation was applied for one student, was it applied for similar cases in other students?
4. **"Nästa steg" differentiation:** Do weak, medium, and strong students receive appropriately different feedback?

### What this method does NOT do

- It does not assign grades. Phase 6 produces aspect-level assessments and points, not letter grades or E/C/A levels.
- It does not generalize beyond the specific question. Whether a student "understands sustainable development" is a Phase 9/10 question, not a Phase 6 question.
- It does not compare students to each other. Assessment is criterion-referenced, not norm-referenced.

### Concrete prohibitions for the assessment text

The criterion-referenced principle implies the following concrete rules for the per-aspect motivation and the "Nästa steg" — both of which may be read by the student.

**Do not write:**

- Comparative phrases: "klassens högsta", "klassens mest", "den enda eleven", "first in class", "few students reach this"
- Invalid grades: "A+", "B-", percentage-based grade equivalents (the official Swedish gymnasium scale is E/D/C/B/A)
- References to other students by ID or description (e.g. "konsistent med kalibreringen från en annan elev")
- SOLO or other research terminology in the student-readable assessment text. If SOLO mapping is useful for teacher calibration, keep it in `process_memo`, not in the Q-file body
- Sections labelled "Lärarreflektion", "Mönster — [studentID]", "Pedagogisk hypotes", "Kommentar — klassens..." — teacher-internal observations belong in `process_memo` or `Teacher_Insights.md`, not in the per-student bedömning
- Research-framework headings such as "Hattie & Timperley (2007) — tre återkopplingsfrågor", "Feed Up / Feed Back / Feed Forward" labels (the underlying Swedish questions are fine; the framework labels are not)
- Bedömt av-signatures with names of assessors (kept as machine-readable metadata only, not in the human-readable text)

**Do write:**

- Direct citations from the student's own answer
- Specific aspect-by-aspect motivation grounded in the rubric
- Forward-looking strategies grounded in the student's own work

See §3.7 of `00_foundation.md` for the full audience-discipline framework, and §3.8 for the pre-save validation checklist.

---

## Design Note: The Dialogic Alternative

The current Phase 6 process is **direct analytic assessment** — AI proposes a complete assessment that the teacher reviews. An earlier design (documented in the now-archived `instruktioner_ai_bedomning_v2.md`, DEL 3A) described a **dialogic method** where AI and teacher build the assessment together through structured conversation, aspect by aspect.

The dialogic method works as follows:

1. **Orientation:** AI and teacher agree on which aspects to assess and whether the purpose is formative, summative, or both.
2. **Aspect-by-aspect dialogue:** For each aspect, AI presents the rubric criteria, then *asks the teacher* how the student performed — "Vad ser du för styrkor här?", "Hur förhåller sig det till kraven på nivå C?" The teacher responds; AI summarizes and confirms.
3. **Holistic reflection:** After all aspects, AI asks: "When you look at the whole — does the analytic picture match your overall impression?" This catches cases where the aspect breakdown misses emergent quality.
4. **Summary and feedback:** AI drafts the complete assessment based on the teacher's responses.

The key difference is **who proposes**: in the direct method, AI proposes and the teacher reviews. In the dialogic method, the teacher articulates and AI structures.

**Why we use direct instead of dialogic:** With 20–30 students per question, the dialogic method is too slow. The direct method handles volume. However, the dialogic method has distinct value for:

- **Calibration:** The first 2–3 students on a new question benefit from dialogic mode. The teacher and AI establish shared understanding of quality levels before switching to direct mode for the remaining students. The current implementation captures this partially through the "calibration effect" described above, but it is informal — the teacher simply adjusts more in the beginning.
- **Difficult cases:** When a student's answer is genuinely ambiguous, switching to dialogic mode forces the teacher to articulate *why* it is ambiguous, which often resolves the ambiguity.
- **Teacher development:** For teachers new to analytic assessment, the dialogic method makes the entire reasoning process explicit. It functions as professional development, not just assessment support.

**Future consideration:** The Assessment Suite could implement an explicit mode switch — "dialogic for the first N students, then direct for the rest" — with the option to drop back into dialogic for any student the teacher flags as difficult. This is not currently implemented but the architecture supports it: `phase6_start` could accept a `mode: "dialogic"` parameter, and the conversation flow would follow the steps above instead of the current propose-review cycle.

---

## Relationship to Other Methodology Files

| File | Relationship to this document |
|------|------------------------------|
| `phase4_rubric_design_method.md` | **Upstream:** Phase 4 produces the rubric that Phase 6 assesses against. Rubric quality determines Phase 6 quality. |
| `phase6_post_format_detection.md` | **Downstream:** Detects the assessment format used in Phase 6 output for Phase 7 parsing. |
| `phase9_generalization_method.md` | **Downstream:** Phase 9 takes Phase 6 assessments as input and generalizes across questions. |
| `_archive/bedomningsmetod_generell_v2.md` | **Archived reference:** Described assessment types by cognitive level. Relevant content (SOLO mapping, cognitive alignment) is now integrated in this document and in `phase4_rubric_design_method.md`. |
| `_archive/instruktioner_ai_bedomning_v2.md` | **Archived context:** Described AI's role in two modes — dialogic (DEL 3A) and direct analytic (DEL 3B). Both are now documented in this file. DEL 5 (forskningsloggning) is captured in the Teacher Annotations section above. |

---

## References

- Biggs, J. B., & Collis, K. F. (1982). *Evaluating the Quality of Learning: The SOLO Taxonomy (Structure of the Observed Learning Outcome)*. Academic Press.
- Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of Educational Research*, 77(1), 81–112.
- Jönsson, A. (2010). *Lärande bedömning* (3rd ed.). Gleerups.
- Kane, M. T. (2006). Validation. In R. L. Brennan (Ed.), *Educational Measurement* (4th ed., pp. 17–64). American Council on Education/Praeger.
- Sadler, D. R. (1989). Formative assessment and the design of instructional systems. *Instructional Science*, 18, 119–144.
- Sadler, D. R. (2009). Indeterminacy in the use of preset criteria for assessment and grading. *Assessment & Evaluation in Higher Education*, 34(2), 159–179.
