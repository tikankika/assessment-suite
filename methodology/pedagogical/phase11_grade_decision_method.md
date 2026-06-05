# Phase 11: Betygsbeslut — Den summativa handlingen

**Version:** 1.0 — Rewritten from scratch
**Status:** Draft — Theoretical grounding added, Phase 10 overlap resolved
**Teoretisk grund:** Kane (2006) interpretation/use, Messick (1989) konsekvensvaliditet, Sadler (1989)
**Datum:** 2026-03-30
**Författare:** Niklas Karlsson

---

## Purpose

Phase 11 is where the assessment process becomes summative. Everything before it — Phase 6 through Phase 10 — builds an evidence base. Phase 11 is the *decision*: given all that evidence, what grade does this student receive?

This is the most consequential action in the pipeline. A grade follows the student — into transcripts, applications, self-concept. The rigour of the decision must match its consequences (Messick 1989).

### When Phase 11 runs

Phase 11 is **conditional**. It runs only when the assessment actually determines a grade:

| Assessment level | Phase 11 | Rationale |
|-----------------|----------|-----------|
| Minitest | Off | No grading consequence |
| Prov | Off | Not sole grading basis |
| Stort prov | Rare — only on teacher request | May contribute to grading but is not the sole basis |
| Tenta/prövning | Full | The assessment determines the grade |

See `assessment_purpose_method.md` for how the teacher declares this.

**Critical rule:** If Phase 11 is off, no grade-like language should appear anywhere in the pipeline. Phase 10 produces *indications*, not grades. The distinction matters: a student who sees "GODKÄNT" on a formative test treats it as a grade regardless of the system's intent.

### What Phase 11 is NOT

- It is not a calculation. A grade is not the output of a formula applied to criterion scores.
- It is not automatic. The teacher makes the decision; AI structures the evidence.
- It is not Phase 10 repeated. Phase 10 produces criterion-level *indications with confidence levels*. Phase 11 *resolves* those indications into a decision — handling uncertainty, applying compensation rules, and exercising professional judgment where evidence is ambiguous.

---

## Theoretical Foundation

### Kane: the interpretation/use inference

Kane (2006) describes the final inference in a validity argument as *interpretation/use* — the step where assessment evidence is used to make a decision. This is the one place in the pipeline where Kane's framework is directly and correctly applicable: Phase 11 makes the claim that the accumulated evidence warrants a specific grade.

The strength of this inference depends on the quality of everything upstream:
- If Phase 6 (scoring) was rigourous, the evidence base is solid
- If Phase 9 (synthesis) was faithful to the evidence, the patterns are trustworthy
- If Phase 10 (extrapolation) was honest about confidence, the criterion indications are calibrated

Phase 11 does not add new evidence. It applies judgment to existing evidence.

### Messick: consequences demand rigour

Messick (1989) argues that the consequences of assessment use are a facet of validity. A grade decision with lasting consequences requires stronger warrants than an informal indication. Phase 11 must therefore:
- Make the reasoning explicit — why this grade and not an adjacent one
- Acknowledge uncertainty — where the evidence is insufficient
- Document the decision — so it can be reviewed if challenged

### Sadler: quality as professional perception

Sadler (1989) argues that quality judgment is ultimately a holistic perception, not a sum of parts. A student who scores well on every criterion in isolation may still produce work that lacks coherence. Conversely, a student who appears weak on individual criteria may demonstrate integrated understanding. Phase 11 is where this holistic view enters — after the analytic work of Phase 6-10.

---

## The Decision Process

Phase 11 follows a three-step process. It assumes Phase 10 has been completed.

### STEG 1: Evidenssammanfattning (Evidence Summary)

**What it does:** Compiles Phase 10 criterion indications into a single view.

**Present to the teacher:**

```
| Kriterium | Indikation | Konfidensgrad | Kommentar |
|-----------|-----------|---------------|-----------|
| [K1]      | [Level]   | [High/Med/Low]| [Brief]   |
| [K2]      | [Level]   | [High/Med/Low]| [Brief]   |
```

Plus: Phase 10 STEG 3 summary and uncertainties.

**The AI does NOT propose a grade in STEG 1.** It presents the evidence and asks: "Hur läser du den här bilden?"

### STEG 2: Tolkningsbeslut (Interpretive Decisions)

**What it does:** Addresses the questions that Phase 10 identified but left to Phase 11.

**Three required decisions:**

**a) Kompensation:** Phase 10 STEG 2 established the compensation model (compensatory vs conjunctive). Phase 11 *applies* it to this specific student:
- If compensatory: do the student's strengths compensate for their weaknesses sufficiently?
- If conjunctive: are all required criteria met?
- If mixed: which criteria are conjunctive (must be met) and which allow compensation?

**b) Osäkerhetshantering:** For criterion indications with low confidence:
- Is the uncertainty consequential? (A low-confidence "B" for a minor criterion may not matter; a low-confidence "E/F boundary" for a key criterion matters a lot)
- How should uncertainty be resolved? Options: give the student the benefit of the doubt (generous interpretation, §3.2), request additional evidence, or document the uncertainty in the grade rationale

**c) Helhetsbedömning:** After the analytic evidence is reviewed — does the grade "feel right" when the teacher considers the student's work as a whole? This is Sadler's holistic check. If it doesn't feel right, the teacher should articulate why — this may reveal that the criteria aren't capturing something important, or that the weighting needs adjustment.

**Teacher dialogue:** "Baserat på evidensen och dina tolkningsbeslut — vilket betyg föreslår du? Vad motiverar det?"

### STEG 3: Betygsbeslut med motivering (Grade Decision with Rationale)

**What it does:** Documents the decision.

**The teacher states the grade.** AI documents:

```markdown
## BETYGSBESLUT

**Betyg:** [Grade]

### Motivering
[2–3 sentences: which criterion evidence supports this grade, how uncertainty was handled]

### Kompensation
[Brief: how strengths/weaknesses were weighed]

### Osäkerheter
[Brief: what the evidence does NOT fully support; what would change the grade]
```

**Quality criteria for the decision:**
- The grade is traceable to criterion indications in Phase 10
- The rationale is explicit enough that another teacher could understand the reasoning
- Uncertainty is documented, not hidden
- The holistic check has been performed

---

## Borderline Cases

Borderline students — those near the boundary between two grades — require special attention. This is where Phase 11 earns its existence as a separate phase.

**How to handle borderline cases:**

1. **Identify the borderline explicitly:** "Evidensen stöder antingen [C] eller [D]. Avgörande faktor: [criterion X]."

2. **Apply generous interpretation (§3.2):** When evidence is ambiguous, read it in the student's favor — and document the generous interpretation.

3. **Consider the full evidence chain:** Re-read Phase 9 for this student. Are there patterns that the criterion indications don't capture? Does the qualitative profile support the higher or lower grade?

4. **Document the decision fully:** A borderline grade decision needs more documentation than a clear one. The rationale should explain *why* the boundary falls where it does for this student.

5. **Never split the difference mechanically:** "B/C → C" is not a valid approach. The teacher must articulate which specific evidence tips the scale.

---

## Output Format

```markdown
# BETYGSBESLUT — [student_id]

**Kurs:** [course_code]
**Prov:** [exam_name]
**Student:** [student_id]
**Datum:** [ISO date]

---

## EVIDENSSAMMANFATTNING (från Phase 10)

[Criterion indications table]

---

## TOLKNINGSBESLUT

### Kompensation
[How compensation was applied]

### Osäkerhetshantering
[How uncertainty was resolved]

### Helhetsbedömning
[Holistic check result]

---

## BETYGSBESLUT

**Betyg:** [Grade]

**Motivering:** [Explicit rationale, 2–3 sentences]

**Osäkerheter:** [What the evidence does not fully support]

---

*Phase 11 Complete — Teacher confirmed*
```

Output file: `11_grading/Student_{id}_grade_decision.md`

---

## Human-AI Collaboration

### What AI contributes

- **Evidence compilation:** AI organises Phase 10 indications into a clear overview
- **Consistency check:** AI flags if the proposed grade is inconsistent with the criterion indications (e.g., "You're proposing B, but criterion 3 indicates D with high confidence — can you explain?")
- **Documentation:** AI structures the rationale in a format that is transparent and reviewable

### What the teacher contributes

- **The decision itself:** AI never proposes a grade. The teacher states the grade.
- **Interpretive judgment:** Compensation, uncertainty resolution, and holistic assessment are professional judgments that only the teacher can make.
- **Accountability:** The grade is the teacher's professional assessment. The documentation makes the reasoning visible, but the responsibility is the teacher's.

---

## Quality Criteria

1. **Evidence-based:** The grade is traceable to Phase 10 criterion indications
2. **Explicitly reasoned:** Another teacher could read the rationale and understand why this grade, not an adjacent one
3. **Uncertainty-honest:** Low-confidence indications are acknowledged, not ignored
4. **Holistically checked:** The teacher has confirmed the grade against their overall impression of the student's work
5. **Teacher-decided:** AI compiled evidence and flagged inconsistencies, but the teacher made the call

---

## Relationship to Other Methodology Files

| File | Relationship |
|------|-------------|
| `phase10_extrapolation_method.md` | **Upstream (primary):** Phase 10 provides criterion indications that Phase 11 resolves into a grade. Phase 10 STEG 2 (compensation/weighting) decisions are *applied*, not re-decided, in Phase 11. |
| `phase9_generalization_method.md` | **Upstream (for borderline cases):** Phase 9 knowledge profiles may be consulted for holistic assessment. |
| `assessment_purpose_method.md` | **Gate:** Phase 11 only runs when Assessment Purpose declares it. |
| `00_foundation.md` | **Principles:** §3.2 (generous interpretation) applies to borderline cases. |

---

## References (Preliminary)

> **Note:** Primary sources not yet read in full. References preliminary.

- Kane, M. T. (2006). Validation. In R. L. Brennan (Ed.), *Educational Measurement* (4th ed., pp. 17–64). American Council on Education/Praeger. — *Interpretation/use inference; the warrant for decisions based on assessment evidence.*
- Messick, S. (1989). Validity. In R. L. Linn (Ed.), *Educational Measurement* (3rd ed., pp. 13–103). American Council on Education/Macmillan. — *Consequential validity; decision rigour must match stakes.*
- Sadler, D. R. (1989). Formative assessment and the design of instructional systems. *Instructional Science*, 18, 119–144. — *Quality as holistic professional perception, not sum of parts.*
