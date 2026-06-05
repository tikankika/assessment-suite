---
title: "Quality Assurance Method (for `reflect_uncertainty`)"
version: 1.0
status: Draft (split from phase7_meta_reflection_method.md v1.1, 2026-05-05)
type: methodology
target_path: methodology/cross_phase/quality_assurance_method.md (when approved)
authors:
  - Niklas Karlsson
  - Cowork-Claude / Code-Claude (collaborative drafting)
theoretical_grounding:
  - Sadler (1989) — formative assessment, criteria-referenced judgment, subjectivity in marking
  - Moss (1994, 2003) — hermeneutic assessment, inconsistency as informative
  - Black & Wiliam (1998) — formative assessment as professional judgment
  - Bloom (1956) — taxonomy of educational objectives (when distinguishing levels in borderline cases)
related_tools:
  - reflect_uncertainty (`packages/assessment-mcp/src/tools/reflect_uncertainty.ts`)
  - UncertaintyReviewer (`packages/assessment-mcp/src/reflection/uncertainty_reviewer.ts`)
related_methodology:
  - 00_foundation.md §3.7–3.9 (audience discipline)
  - meta_reflection_method.md (sister cross-phase methodology)
  - descriptive_statistics_method.md (sister cross-phase methodology)
  - phase6_assessment_method.md (where uncertainty most commonly arises)
language: English (parity with other methodology files)
---

# Quality Assurance Method (for `reflect_uncertainty`)

This is one of three cross-phase reflection-tool methodologies. The tools (`reflect_insights`, `reflect_uncertainty`, `reflect_aspect_analysis`) live in `packages/assessment-mcp/src/reflection/` and are designed to be used across multiple assessment phases — see `cross_phase/README.md`.

This document covers `reflect_uncertainty` and its output: structured review documents in `05_uncertainty_review/` for `bedömningsansvarig` review.

---

## 1. Purpose

`reflect_uncertainty` creates a structured review document when the teacher is uncertain about a specific assessment and needs `bedömningsansvarig` review (in Swedish education: an external assessor for borderline cases).

The tool's role: **structure the uncertainty so it can be resolved efficiently**. It does not decide. It does not propose an answer. It surfaces the specific point of doubt with the evidence and decision options, so the bedömningsansvarig can make a defensible judgment without going back to source files.

The output is a single review document per uncertainty case, written to `05_uncertainty_review/`. Each document is self-contained — a bedömningsansvarig should be able to act on it without external lookup.

---

## 2. Theoretical Foundation

### 2.1 Subjectivity in criteria-referenced assessment (Sadler)

Sadler (1989) — *Formative assessment and the design of instructional systems* — argued that even criteria-referenced assessment cannot eliminate subjectivity. The *application* of criteria to specific student work involves professional judgment. Two assessors reading the same student response can reach different defensible conclusions.

Sadler's distinction is important here: **uncertainty in marking is not failure of methodology**. It is intrinsic to qualitative assessment of complex student work. The methodology's role is not to eliminate uncertainty, but to **make it visible and actionable**.

`reflect_uncertainty` operationalises this. When the teacher cannot confidently apply criteria to a specific case, the tool captures the specific point of difficulty so a second assessor can engage with it directly.

### 2.2 Inconsistency as information (Moss)

Moss (1994, 2003) developed an interpretive approach to assessment validity where **reliability in the traditional psychometric sense is not the only — or always the best — warrant**. When assessment involves complex, context-dependent performances, an interpretive approach that seeks coherence across the full body of evidence can be more valid than one that treats each response as an independent measurement.

Moss's contribution to quality assurance: **inconsistency between assessor judgments is not noise to be averaged away — it is informative**. When two assessors disagree on a specific case, the disagreement reveals something about either the criteria, the student response, or the assessment instrument. The methodology should preserve the disagreement as data, not erase it.

`reflect_uncertainty` preserves this: the document records the teacher's tentative judgment, the specific point of doubt, and the alternative interpretations under consideration. The bedömningsansvarig's resolution does not erase the original uncertainty — it adds a layer of judgment that documents how the case was resolved.

### 2.3 Formative assessment as professional judgment (Black & Wiliam)

Black & Wiliam (1998) emphasized that effective formative assessment depends on the teacher's professional judgment — not on standardized scoring rubrics applied mechanically. Their later work on the *theory* of formative assessment (Black & Wiliam 2009) developed this into a model where teacher learning is the central mechanism.

`reflect_uncertainty` is the **professional-judgment-respecting** complement to mechanical assessment. When a Phase 6 score cannot be confidently assigned, the tool surfaces the borderline rather than forcing a defensive scoring decision.

This connects to broader Swedish assessment practice: the bedömningsansvarig role exists precisely because some cases require a second, external judgment. The tool supports the role by structuring the case for efficient review.

---

## 3. The Tool — `reflect_uncertainty`

### 3.1 Trigger

The teacher signals uncertainty about an individual assessment. Claude Desktop helps articulate the specific point of uncertainty — *which aspect? which option among rubric levels? which interpretation of student wording?* — and calls `reflect_uncertainty`.

The trigger is specific: a single borderline case at a single Q × student × aspect intersection. It is **not** a vague *"I'm not sure about this assessment overall."* Vague uncertainty needs to be made specific before the tool is useful.

### 3.2 Inputs

The tool's inputs identify the case and the source of doubt. From the implementation (`uncertainty_reviewer.ts`):

| Field | Purpose |
|-------|---------|
| `q_file_path` | Identifies the question and assessment context |
| `student_id` | Identifies which student's response is uncertain |
| `aspect_of_concern` | The specific rubric aspect where the teacher is uncertain |
| `current_grade` | The teacher's current tentative judgment |
| `borderline_between` | The two (or more) levels under consideration |
| `comparison_students` | Optional: other students whose responses inform the comparison |
| `reason` | The teacher's articulation of why this is uncertain |
| `assessor_info` | From session state — who is the current assessor |

### 3.3 Output

A structured document in `05_uncertainty_review/`, one file per uncertainty case. The document contains:

- The student's verbatim answer (full text — the bedömningsansvarig reads what the student wrote)
- The relevant rubric or criteria for the aspect of concern
- The current Phase 6 assessment as recorded
- The specific point of uncertainty (which aspect, which levels, why)
- Decision options for the bedömningsansvarig (e.g., "raise to next level," "keep current," "lower to previous level," "request student clarification") with rationale per option
- Optional: comparison students' responses for reference
- Assessor metadata (who flagged the uncertainty, when)

### 3.4 MCP role: structured surfacing

The tool does not decide. It does not propose a single answer. It surfaces the case in a structured form so that the bedömningsansvarig can make an efficient, defensible judgment.

This is consistent with the broader principle: AI handles structure, humans hold meaning. The structure is the document layout and the decision options. The meaning is what the bedömningsansvarig adds when they resolve the case.

---

## 4. Output Format and Audience-Discipline

### 4.1 Audience: teacher-internal quality-review document

`reflect_uncertainty` outputs are **fundamentally different** from `Teacher_Insights.md` in audience and discipline:

- `Teacher_Insights.md` is teacher-internal but **export-bound** (consumed by Teacher_MCP via the bridge → Anthropic). Stripped of all individual identifiers.
- `05_uncertainty_review/` documents are teacher-internal **and not exported**. They contain student IDs and full student answers by necessity — the bedömningsansvarig must know which student is being discussed.

This means the audience-discipline rules in `00_foundation.md` §3.7–3.9 apply differently:

- **Student IDs are required**, not forbidden. The bedömningsansvarig needs to identify the student to make a decision. The Phase 9 profile may be consulted if relevant.
- **Verbatim student text is required.** Paraphrase is not acceptable for quality-review purposes — the bedömningsansvarig must read what the student actually wrote.
- **Comparison students may be named** when the comparison is the basis for the uncertainty (e.g. when two students wrote essentially the same answer but reached different levels — was that justified?).

### 4.2 What is still off-limits

Even within a quality-review document, certain content does not belong:

- **Third-party names unrelated to the assessment.** *"My colleague [name redacted] disagreed with my marking"* does not belong in the review document — the case is between the teacher and the bedömningsansvarig.
- **Information about students unrelated to the assessment.** Personal circumstances, behavioral notes — these may be relevant in other teacher-internal documents but not in a structured quality-review document focused on a specific assessment case.
- **Speculation about what the student "really meant"** beyond what the text supports. The review is about what the response demonstrates; if the demonstration is unclear, that is the uncertainty itself.

### 4.3 Document structure (preliminary)

```markdown
# Uncertainty Review — <Q-id> × <Student-id> × <Aspect>

**Created:** <ISO timestamp>
**Assessor:** <who flagged this>
**Status:** Open | Resolved by <bedömningsansvarig> on <date>

## Student response (verbatim)

> [Full text of student's answer, exact quote]

## Relevant criterion

[The specific rubric aspect under consideration, full text]

## Current Phase 6 assessment

| Aspect | Level | Justification (current) |
|--------|-------|--------------------------|
| <aspect_of_concern> | <current_grade> | [Brief teacher rationale] |

## Specific uncertainty

The teacher is uncertain whether the student's response demonstrates <level X> or <level Y>.

**Reason for uncertainty:** [Teacher's articulation]

## Decision options

### Option A: <e.g., "Raise to level Y">
**Rationale:** [Why this might be defensible]
**Implication:** [What follows if chosen]

### Option B: <e.g., "Keep at level X">
**Rationale:** [Why this might be defensible]
**Implication:** [What follows if chosen]

### Option C: <e.g., "Request clarification from student">
**Rationale:** [When this is appropriate]
**Implication:** [Process implications]

## Comparison context (optional)

[If `comparison_students` was provided: brief reference to similar cases that inform this judgment]

## Resolution

[To be filled in by bedömningsansvarig]
```

### 4.4 Why uncertainty reviews are NOT exported

Per § 4.1, these documents contain student IDs and verbatim student text. They are **not** appropriate for export to Teacher_MCP, kursarkiv, or any other downstream destination. They live in `05_uncertainty_review/` within the assessment project and remain there.

When the assessment project is archived (after grading is final), the `05_uncertainty_review/` folder is part of the assessment record but is not part of the export pipeline. It is the teacher's and the bedömningsansvarig's internal quality documentation.

---

## 5. Cross-Phase Usage

`reflect_uncertainty` is most commonly used during Phase 6 (analytic assessment), but it is **not** Phase 6-specific. Per `reflection/README.md`:

| Phase / Role | Use case |
|--------------|----------|
| **Phase 6** | **Flag uncertain assessments during scoring workflow** (most common) |
| Phase 7 | Generate comprehensive uncertainty reviews (batch processing of accumulated borderline cases) |
| Bedömningsansvarig | Review and approve/adjust borderline cases (consumes the documents created above) |

Phase 7 use case: at end of Phase 6 assessment, Claude Desktop can call `reflect_uncertainty` for each case where the teacher noted uncertainty during the workflow. This produces a batch of review documents for the bedömningsansvarig to process together.

---

## 6. Quality Criteria

A high-quality uncertainty review has the following properties:

**Specific point of uncertainty.** *"I'm not sure about this assessment"* is too vague to act on. *"For aspect F2 on Q7, I am uncertain between level C and level D — the student's reasoning shows multistructural understanding (typical of C) but their use of domain vocabulary is at relational level (typical of D)"* is specific and reviewable.

**Structured options for resolution.** A good uncertainty review presents the bedömningsansvarig with discrete decision options with rationale per option — not an open-ended *"what should I do?"* The options should reflect what the teacher has actually considered; if other options exist, they should be explicit.

**Traceable to evidence.** The student's verbatim answer, the relevant rubric, and the current assessment must all be present in the review document. The bedömningsansvarig should be able to make a decision without going back to the source files.

**Bounded scope.** A single uncertainty review addresses one specific borderline case (one Q × one student × one aspect, possibly with comparison students). If the teacher is uncertain about three students' assessments on the same question, that is three separate review documents — not a "general uncertainty" entry.

**Resolution-ready.** The document should make resolution efficient. Bedömningsansvarig time is finite; a well-structured review takes 5–10 minutes to read and decide. A poorly-structured review takes 30 minutes and may require teacher clarification, defeating the purpose.

---

## 7. Configuration and Operation

### 7.1 Tool registration

`reflect_uncertainty` is registered in `packages/assessment-mcp/src/server.ts`. Locate by searching for the tool name; line numbers shift as the file evolves.

The tool description in `server.ts` is what Claude Desktop sees at tool-discovery time. It must reference this methodology document and clarify that the tool surfaces uncertainty for review — it does not resolve it.

### 7.2 Files generated

One review document per uncertainty case, written to `<assessment_project>/05_uncertainty_review/`. Naming pattern includes student ID and question ID for traceability (e.g., `Q7_10001_aspect-F2.md`).

### 7.3 Workflow logging

The tool logs to `workflow_log.jsonl` via `logWorkflowAction`. The action type is `uncertainty_review_create` and is logged as a Phase 6 sub-action — uncertainty most commonly arises during Phase 6 even though the tool is cross-phase.

### 7.4 Resolution flow

When the bedömningsansvarig reviews and resolves a case, the resolution is added to the document (in the "Resolution" section) and the document's status changes from "Open" to "Resolved". This update may be done manually by the bedömningsansvarig or via a future tool. The status field allows the workflow to track open cases.

---

## 8. Relationship to Other Methodology Files

| File | Relationship |
|------|-------------|
| `meta_reflection_method.md` | **Sister methodology** for `reflect_insights`. Different theoretical grounding (Schön, Boud — reflective practice). Different output discipline (insights are export-safe; uncertainty reviews are teacher-internal-with-IDs). Both are cross-phase reflection-tool methodologies. |
| `descriptive_statistics_method.md` | **Sister methodology** for `reflect_aspect_analysis`. Different theoretical grounding (descriptive statistics). Different output (statistics, not review documents). |
| `00_foundation.md` §3.7–3.9 | **Audience-discipline framework.** Uncertainty review documents are an exception to the export-safe pattern: they require student IDs by necessity for the bedömningsansvarig role. The framework applies, but with this documented exception. |
| `phase6_assessment_method.md` | **Most common phase of use.** Uncertainty most commonly arises during Phase 6 analytic assessment. Phase 6 methodology may direct the teacher to use `reflect_uncertainty` when scoring confidence is below a threshold. |

---

## 9. References

### Primary theoretical sources

- Sadler, D. R. (1989). Formative assessment and the design of instructional systems. *Instructional Science, 18*(2), 119–144.
- Moss, P. A. (1994). Can there be validity without reliability? *Educational Researcher, 23*(2), 5–12.
- Moss, P. A. (2003). Reconceptualizing validity for classroom assessment. *Educational Measurement: Issues and Practice, 22*(4), 13–25.
- Black, P. & Wiliam, D. (1998). Inside the black box. *Phi Delta Kappan, 80*(2), 139–148.
- Black, P. & Wiliam, D. (2009). Developing the theory of formative assessment. *Educational Assessment, Evaluation and Accountability, 21*(1), 5–31.

### Implementation references


### Related methodology files

- `methodology/00_foundation.md` §3.7–3.9 — audience-discipline framework (with documented exception for uncertainty reviews)
- `methodology/cross_phase/meta_reflection_method.md` — sister methodology
- `methodology/cross_phase/descriptive_statistics_method.md` — sister methodology
- `methodology/pedagogical/phase6_assessment_method.md` — most common phase of use

---

*Quality Assurance Method v1.0 — split from phase7_meta_reflection_method.md v1.1 on 2026-05-05.*
*Cross-phase tool methodology. Tool `reflect_uncertainty` lives in `packages/assessment-mcp/src/tools/`; logic in `reflection/uncertainty_reviewer.ts`.*
