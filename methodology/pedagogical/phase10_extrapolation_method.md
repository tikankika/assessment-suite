# Phase 10: Extrapolering till Kurskriterier

**Version:** 1.1 — Assessment Purpose integration
**Status:** Draft — Updated 2026-03-30 with proportionality integration and known issues
**Teoretisk grund:** Kane (2006), Hirsh (2019), Sadler (1989), Jönsson (2010)
**Datum:** 2026-03-08 (reviderad 2026-03-30)
**Författare:** Niklas Karlsson

---

## Purpose

Phase 10 takes the student-level generalization from Phase 9 and maps it to the course's formal assessment criteria — ILOs (Intended Learning Outcomes), betygskriterier, or kunskapskrav depending on the educational context (higher education, gymnasiet, vuxenutbildning).

In Kane's (2006) validity framework, this is the **extrapolation inference** — moving from what the student demonstrated on the exam (the generalized score) to claims about what the student can do in the broader target domain defined by the course criteria:

> "The extrapolation inference extends the interpretation of test performance to the target domain of performances about which we want to draw conclusions." (Kane, 2006, p. 27)

This is the most interpretive step in the assessment process. Phase 6 is relatively constrained (rubric → answer → score). Phase 9 aggregates but stays close to the data. Phase 10 asks: *given what the student demonstrated on this specific exam, what can we infer about their standing against the course criteria?*

The danger here is over-claiming: concluding that a student has "achieved ILO 3" based on one exam question that partially addresses it. Phase 10 must be explicit about the strength and limits of each extrapolation.

This document replaces the previous `phase10_extrapolation_methodology.md` (4KB, placeholder) and integrates relevant principles from `phases9-12_ai_assisted_methodology.md` (archived).

---

## Theoretical Foundation

### The extrapolation inference

Kane (2006) identifies extrapolation as the inference most vulnerable to validity threats, because it claims that performance in one context (the exam) tells us something about performance in another context (the course domain):

> "To the extent that the test tasks are not representative of the criterion, or the testing conditions differ substantially from the conditions of interest, the extrapolation may be weak." (Kane, 2006, p. 28)

This has concrete implications:
- An exam that only tests factual recall cannot support extrapolation to criteria about analytical ability
- An exam taken under time pressure may not represent what a student can do with adequate time
- Written exam performance may not predict laboratory, oral, or project performance

Phase 10 must acknowledge these limitations explicitly. Each criterion match includes a **confidence level** that reflects how well the exam evidence supports the extrapolation.

### Criterion interpretation

Sadler (1989) emphasizes that criteria are not self-interpreting. The same criterion ("the student demonstrates understanding of central concepts") can mean different things to different assessors. Phase 10 addresses this by requiring the teacher to interpret what each criterion means *in the context of this course and exam*, rather than applying criteria mechanically.

Jönsson (2010) extends this argument specifically to Swedish educational assessment, noting that betygskriterier at gymnasienivå are intentionally broad to allow professional judgement. This means Phase 10 cannot be fully automated — the teacher's interpretation of what "med säkerhet" or "utvecklat resonemang" means in their subject is essential.

### Scope limitation — one exam, not summative grading

Phase 10 produces an **exam-based criterion indication**, not a final grade. A single exam covers a subset of the course's ILOs and provides evidence at a specific moment in time. The student's standing against the full set of course criteria requires evidence from multiple assessment occasions.

Phase 10 output should therefore use language that reflects this limitation:
- ✅ "Provsvaren indikerar C–A-nivå på kriterium 1"
- ✅ "Provet ger starkt stöd för att eleven uppfyller ILO2"
- ❌ "Eleven uppfyller kriterium 1 på A-nivå"
- ❌ "Betyg: C"

---

## Assessment Purpose Integration

Phase 10 reads the Assessment Purpose document (see `assessment_purpose_method.md`) to determine its depth level:

- **Full:** All three steps (STEG 1–3) as described below. Standard for stort prov and tenta/prövning.
- **Short:** A single step producing criterion indications with confidence levels, but without full interpretive analysis (STEG 2 is abbreviated). Standard for prov.
- **Off:** Phase 10 does not run. Standard for minitest.

If no Assessment Purpose document exists, Phase 10 defaults to **full** (backward compatibility).

### Short mode

When Assessment Purpose declares "short," Phase 10 produces STEG 1 (criteria matching) and STEG 3 (summary), but abbreviates STEG 2:

- Compensation and weighting decisions are noted briefly, not elaborated
- Generalizability limits are stated in one sentence
- Output is roughly half the length of full mode

### Known issue: STEG 2 uniformity (2026-03-30)

Review of an earlier course run revealed that STEG 2 (Critical interpretations) was *identical* across all 14 students — compensation, weighting, and generalizability decisions were policy-level statements, not individual-level judgments. This is technically correct (these are course-level decisions), but means STEG 2 adds no per-student value. For future revisions: consider whether STEG 2 should be a one-time class-level decision rather than repeated per student.

---

## The Extrapolation Process (Full Mode)

Phase 10 in full mode follows a three-step process.

### STEG 1: Kriteriematchning (Criteria matching)

**What it does:** Maps Phase 9 observations to each relevant course criterion or ILO. For each criterion, identifies which exam evidence supports or undermines it.

**Input required:**
- Phase 9 generalization document (from `09_qualitative/`)
- Course criteria / ILOs (from exam_config.yaml or course syllabus)
- Phase 8 quantitative data (from `08_quantitative/`)

**For each criterion:**

```
### [Criterion ID]: [Short description]

**Relevant exam evidence:** [Which questions and results address this criterion?]
**What the evidence shows:** [Observation — what did the student demonstrate?]
**Assessment:** [Judgement — what level does this indicate?]
**Confidence:** high / medium / low
**Confidence rationale:** [Why this confidence level?]
```

**Confidence levels:**
- **High:** Multiple questions address this criterion, results are consistent, and the exam format is appropriate for assessing it
- **Medium:** Limited exam evidence (1–2 questions), or results are inconsistent, or the exam format partially addresses the criterion
- **Low:** Minimal or indirect evidence — the exam barely touches this criterion

**Quality check for STEG 1:**
- Is each criterion addressed, or is it explicitly noted as "not assessable from this exam"?
- Does the evidence cited actually support the judgement? (Not just "scored high therefore achieved")
- Is the confidence level defensible?

### STEG 2: Kritiska tolkningar (Critical interpretations)

**What it does:** Addresses the interpretive questions that determine how we read the overall picture.

Three required interpretation areas:

**Kompensation (Compensation):** Can strong performance in one area compensate for weak performance in another? This is a question the criteria themselves often do not answer explicitly. The teacher must decide:
- Does the course use a compensatory model (overall performance matters) or a conjunctive model (each criterion must be met independently)?
- If compensatory: how much can strong performance on criterion 2 compensate for weak performance on criterion 1?

**Vägning (Weighting):** Are all criteria weighted equally, or do some carry more weight? The teacher's interpretation of the course's assessment structure determines this.

**Generaliserbarhet (Generalizability):** How far can we extrapolate from this exam? If the student shows strong analytical ability on exam questions, does this generalize to analytical ability in the subject more broadly? What other evidence would strengthen or weaken this inference?

**Output format:**
```
### Kompensation
[Can strengths compensate for weaknesses? Teacher's decision with rationale.]

### Vägning
[Are criteria weighted equally? How does this affect the overall picture?]

### Generaliserbarhet
[How far can we extrapolate? What are the limits?]
```

**Quality check for STEG 2:**
- Are the interpretive decisions explicit (not implicit)?
- Does the teacher make the decisions, not AI?
- Are the limits of generalizability stated clearly?

### STEG 3: Sammanfattning och indikation (Summary and indication)

**What it does:** Synthesizes STEG 1 and STEG 2 into a single summary statement with a criterion-level indication for Phase 11.

**Output format:**
```
### Sammanfattning
[2–3 sentences: overall extrapolation — what does this exam tell us about
the student's standing against the course criteria?]

### Kriterieindikation
**Kriterium 1:** [Level indication] — [brief rationale]
**Kriterium 2:** [Level indication] — [brief rationale]

### Osäkerheter
- [What this exam does NOT tell us]
- [What additional evidence would clarify the picture]

### Rekommendation för Phase 11
[Concise indication for the grading decision — NOT a grade recommendation]
```

**Important boundary with Phase 11:** Phase 10 produces *criterion-level indications* and *uncertainties*. It does not make the grading decision. The grading decision (weighing criteria, resolving uncertainties, applying the grading scale) belongs to Phase 11.

**Quality check for STEG 3:**
- Does the summary follow from STEG 1 and STEG 2, or does it introduce new claims?
- Are the criterion indications expressed as indications (not as grades)?
- Are uncertainties genuine (not boilerplate)?
- Does the Phase 11 recommendation leave room for the teacher's final judgement?

---

## Output Format

### Complete document structure

```markdown
# EXTRAPOLERING — [student_id]

**Kurs:** [course_code]
**Prov:** [exam_name]
**Student:** [student_id]
**Datum:** [ISO date]
**Teoretisk grund:** Kane (2006) extrapolering, Sadler (1989)

---

## SAMMANFATTNING FRÅN PHASE 9
[Brief summary of the Phase 9 generalization]

---

## KRITERIEMATCHNING
[STEG 1 output — one subsection per criterion]

---

## KRITISKA TOLKNINGAR
[STEG 2 output — kompensation, vägning, generaliserbarhet]

---

## SAMMANFATTNING OCH INDIKATION
[STEG 3 output — summary, criterion indications, uncertainties,
Phase 11 recommendation]

---

*Genererat: [ISO timestamp]*
*Phase 10 Complete — Ready for Phase 11 (Betygsbeslut)*
```

### Metadata

The output file is named `Student_[id]_extrapolation.md` and placed in `10_extrapolation/`.

---

## Human-AI Collaboration

### The dialogue process

Phase 10 is the most teacher-dependent phase in the Assessment Suite. AI can match exam evidence to criteria and identify relevant questions, but the interpretive decisions (compensation, weighting, generalizability) require the teacher's professional judgement.

The dialogue follows three steps:

1. **AI presents STEG 1** (criteria matching with evidence and confidence levels) → Teacher reviews each match, adjusts confidence levels, adds context
2. **AI presents STEG 2** (interpretive questions) → Teacher makes the decisions on compensation, weighting, and generalizability
3. **AI presents STEG 3** (summary and indication) → Teacher confirms or adjusts the overall picture

### What AI contributes

- **Systematic mapping:** AI ensures every criterion is addressed and every relevant question is considered
- **Evidence retrieval:** AI pulls specific results from Phase 6 and Phase 9, saving the teacher from re-reading
- **Confidence assessment:** AI proposes confidence levels based on evidence coverage, giving the teacher a starting point

### What the teacher contributes

- **Criterion interpretation:** What does "med säkerhet" mean in this subject? What level of reasoning constitutes "utvecklat"?
- **Compensation decisions:** Does this course allow strong performance on one criterion to offset weak performance on another?
- **Contextual knowledge:** What other assessment occasions exist? How does this exam fit into the full assessment picture?
- **Scope judgement:** Is it reasonable to extrapolate from this particular exam to the broader criterion?

### Teacher annotations in Phase 10

| Intervention | Type | Example |
|-------------|------|---------|
| Teacher interprets a criterion | `rubric_clarification` | "'Med säkerhet' means correct terminology AND correct context" |
| Teacher decides on compensation | `calibration_note` | "In this course, criterion 1 and 2 can compensate each other" |
| Teacher limits extrapolation | `context_addition` | "This exam only covers half of ILO3, lab assessment covers the rest" |
| Teacher adjusts indication level | `score_adjustment` | "C-level, not B — the exam evidence is not strong enough for B" |

---

## Quality Criteria

### For individual extrapolations

1. **Evidence-based:** Every criterion indication is linked to specific exam evidence via Phase 9
2. **Confidence-marked:** Each criterion match has an explicit confidence level with rationale
3. **Scope-honest:** The document states what the exam does and does not assess
4. **Interpretively transparent:** Compensation and weighting decisions are stated, not assumed
5. **Not a grade:** The output is an indication, not a grade decision

### For the full cohort

1. **Consistent criterion interpretation:** The same criteria are interpreted the same way across students
2. **Consistent confidence calibration:** High/medium/low confidence means the same thing across students
3. **Pattern visibility:** If many students show the same criterion weakness, this should be visible across extrapolations

### What Phase 10 does NOT do

- It does not assign a final grade. That is Phase 11.
- It does not produce student-facing feedback. That is Phase 12/14.
- It does not aggregate across students for class-level analysis. That is Phase 13.
- It does not claim more than the exam evidence supports.
- It does not compare students to each other. Each Phase 10 document is criterion-referenced and stands as if the student were the only one in the cohort.

### Audience and concrete prohibitions

Phase 10 is a **teacher-internal document**. It is read by the teacher; students do not read Phase 10. However, Phase 10 feeds into Phase 12, which feeds into Phase 14 (student-facing). Therefore the same audience-discipline applies as elsewhere in the pipeline.

**Do not write in Phase 10:**

- Comparative phrases ("klassens högsta", "den enda eleven", "few students at this criterion level")
- References to other students by ID or description
- SOLO/Relational/Extended Abstract terminology (criterion levels are E/D/C/B/A; SOLO mapping, if useful internally, belongs in `process_memo`)
- Invalid grade extensions ("A+" is not part of the Swedish gymnasium scale)
- "Lärarreflektion" or similar lärar-internal sections in the document body (use `process_memo` or `Teacher_Insights.md` for these)

See §3.7 of `00_foundation.md` for the full audience-discipline framework.

---

## Relationship to Other Methodology Files

| File | Relationship |
|------|-------------|
| `phase9_generalization_method.md` | **Upstream:** Phase 9 produces the student-level generalization that Phase 10 maps to criteria. The "Kritiska frågor för Phase 10" section in Phase 9 output directly feeds Phase 10 analysis. |
| `phase6_assessment_method.md` | **Upstream (indirect):** Phase 6 produces the question-level data that Phase 9 generalizes and Phase 10 extrapolates from. |
| Course syllabus / ILOs | **Reference:** Phase 10 requires access to the course's formal assessment criteria. |
| `exam_config.yaml` | **Configuration:** May contain criterion definitions and question-criterion mappings. |

---

## References

- Hirsh, Å. (2019). *Formativ undervisning: Utveckla klassrumspraktiker med lärande i fokus*. Natur & Kultur.
- Jönsson, A. (2010). *Lärande bedömning* (3rd ed.). Gleerups.
- Kane, M. T. (2006). Validation. In R. L. Brennan (Ed.), *Educational Measurement* (4th ed., pp. 17–64). American Council on Education/Praeger.
- Sadler, D. R. (1989). Formative assessment and the design of instructional systems. *Instructional Science*, 18, 119–144.
