---
title: "Meta-Reflection Method (for `reflect_insights`)"
version: 1.0
status: Draft (split from phase7_meta_reflection_method.md v1.1, 2026-05-05)
type: methodology
target_path: methodology/cross_phase/meta_reflection_method.md (when approved)
authors:
  - Niklas Karlsson
  - Cowork-Claude / Code-Claude (collaborative drafting)
theoretical_grounding:
  - Schön (1983, 1987) — reflective practice
  - Boud, Keogh & Walker (1985) — returning to experience
  - Black & Wiliam (1998, 2009) — formative assessment as teacher learning
  - Larrivee (2000) — levels of reflection
  - Ericsson & Simon (1980/1993) — verbal protocol analysis
related_tools:
  - reflect_insights (`packages/assessment-mcp/src/tools/reflect_insights.ts`)
  - InsightsWriter (`packages/assessment-mcp/src/reflection/insights_writer.ts`)
related_methodology:
  - 00_foundation.md §3.7–3.9 (audience discipline)
  - quality_assurance_method.md (sister cross-phase methodology)
  - descriptive_statistics_method.md (sister cross-phase methodology)
  - phase13_teacher_summary_method.md (downstream consumer of insights)
related_bridges:
  - Teacher_MCP/methodology/bridges/student_data_to_teacher.md
language: English (parity with other methodology files)
---

# Meta-Reflection Method (for `reflect_insights`)

This is one of three cross-phase reflection-tool methodologies. The tools (`reflect_insights`, `reflect_uncertainty`, `reflect_aspect_analysis`) live in `packages/assessment-mcp/src/reflection/` and are designed to be used across multiple assessment phases (Phase 3, 6, 7, 8) — see `cross_phase/README.md`.

This document covers `reflect_insights` and its output `Teacher_Insights.md`.

---

## 1. Purpose

`reflect_insights` captures the teacher's emerging meta-observations *during* assessment work — patterns, pedagogical observations, technical concerns, and summary observations that inform future teaching but are not part of the assessment data itself.

The tool's role: **save what the teacher decides is worth saving**. It does not prompt for insights. It does not generate insights autonomously. The intelligence lies in the dialogue between teacher and Claude Desktop; the tool is mechanical scaffolding.

The output `Teacher_Insights.md` accumulates over an assessment project. It is appended to as the work progresses; it is not a summary written at the end.

---

## 2. Theoretical Foundation

### 2.1 Reflection-on-action: capturing what would otherwise fade

Schön (1983, 1987) distinguishes between *reflection-in-action* — the intuitive adjustment in the moment, the professional improvisation based on experience — and *reflection-on-action*, the distanced interpretation afterward. Phase 6 assessment is reflection-in-action: the teacher reads a student answer, recognizes patterns, makes a scoring judgment. `reflect_insights` captures **reflection-on-action while still warm**.

Boud, Keogh & Walker (1985) emphasize three moments often missed in reflective practice: *returning to experience* (going back to the event), *attending to feelings* (noting affective responses as data), and *re-evaluating experience* (reinterpreting in light of new perspective). The tool's value lies largely in capturing what would otherwise be lost — when assessment of all 22 students is complete, the teacher has forgotten which patterns emerged where unless they were externalized in the moment.

The verbal-protocol research (Ericsson & Simon, 1980/1993) supports this: speech close to the event captures qualitatively different cognitive content than retrospective written reflection. The dialogical mode — Claude Desktop surfaces, teacher confirms, MCP saves — is designed to externalize these "warm" reflections before they fade.

### 2.2 Levels of reflection: pushing toward depth

Larrivee (2000) distinguishes four levels of reflective practice: pre-reflective, surface, pedagogical, and critical. The tool's four insight categories support movement toward deeper levels:

- `pattern` — typically surface or pedagogical: *"5/8 students confused dendrites with axons. Why?"*
- `pedagogical` — pedagogical: *"This concept needs more emphasis next year."*
- `critical` — pedagogical or critical: *"The question wording was ambiguous; this affects validity."*
- `summary` — pedagogical, consolidating: *"Q3 showed bimodal distribution — students either fully understood or missed the core concept."*

The methodology actively pushes toward depth through anti-patterns (§ 4): observation alone is insufficient; insights must be grounded in evidence and oriented toward future action.

### 2.3 Formative assessment as teacher learning

Black & Wiliam (1998, 2009) argue that formative assessment is most powerful when it informs not just student feedback but **teaching practice itself**. Their *Inside the Black Box* established formative assessment as one of the most effective pedagogical interventions; their later work developed this into a theory where teacher learning is the central mechanism.

`reflect_insights` implements this dual loop:

- **Forward to assessment products.** Insights flow into Phase 13 (class summary) where appropriate. Phase 13 curates from the accumulated insights to produce the formal class report.
- **Forward to future teaching.** Insights flow into the lesson cycle via the Teacher_MCP bridge `student_data_to_teacher.md`. They become input to next-iteration lesson planning, course revision, and professional reflection.

This dual flow distinguishes `reflect_insights` from a purely post-hoc reflection log — its output is designed to be **operational**.

---

## 3. The Tool — `reflect_insights`

### 3.1 Trigger

During Phase 6 assessment, Claude Desktop spontaneously identifies a meta-observation worth recording. The teacher confirms ("save that"). Claude Desktop calls `reflect_insights`.

The tool **does not prompt** for insights. It is invoked when teacher and Claude have already arrived at an insight worth saving.

The trigger is **dialogical**, not phase-bound. Insights can emerge during:

- Phase 6 assessment (most common — patterns surface as student answers are read)
- Phase 9 hermeneutic synthesis (when patterns visible across one student's answers)
- Phase 13 class summary work (when class-level patterns are noted)
- Cross-phase work (when reading rubric, syllabus, or earlier course materials alongside current assessment)

### 3.2 Categories

Four insight types are valid:

| Type | Swedish header | What it is |
|------|----------------|------------|
| `pattern` | Mönster & Missförstånd | Recurring errors, common misconceptions, conceptual confusions across multiple students |
| `pedagogical` | Pedagogiska Insikter | Recommendations for future teaching, content that needs more emphasis, effective strategies identified |
| `critical` | Kritiska Observationer | Technical issues with the question, interpretation challenges, assessment validity concerns |
| `summary` | Sammanfattningar | Per-question or per-aspect overall observations; cross-question comparisons |

A fifth type — `trend` (student progression) — is **explicitly invalid**. Student progression data is automated by `Assessment_Status_Summary.md` and does not belong in `Teacher_Insights.md`.

### 3.3 Examples per category

**`pattern` — Mönster & Missförstånd:**

```
Several students (5/18) confuse cellular respiration with breathing.
This shows a fundamental misunderstanding of the difference between
organ-level and cellular-level processes.
```

**`pedagogical` — Pedagogiska Insikter:**

```
The distinction between osmosis and diffusion needs more emphasis.
Consider using a visual comparison diagram in future lectures.
```

**`critical` — Kritiska Observationer:**

```
Question wording caused confusion — 3 students interpreted
"explain the process" as "describe the steps" rather than
"explain why it happens."
```

**`summary` — Sammanfattningar:**

```
Q3 showed bimodal distribution: students either understood
completely (4-5p) or missed the core concept entirely (0-1p).
No students in the middle range.
```

### 3.4 Output

`Teacher_Insights.md` is created in the same folder as the Q-files (one file per assessment project). Insights are appended as the assessment progresses; the file accumulates over the assessment's lifetime.

The format is specified in § 4.

### 3.5 MCP role: SAVE ONLY

The implementation philosophy (in `insights_writer.ts:5`) is explicit: *"Claude Desktop generates insights dynamically during assessment. This class simply saves them — it does NOT generate insights."*

This separation of concerns is important: the methodology lives in the dialogue between teacher and Claude Desktop, not in the MCP code. The MCP is mechanical scaffolding.

This principle is consistent with Teacher_MCP's broader pedagogical architecture: *"AI:n hanterar ställningen och syntesen. Människan håller omdömet och meningen"* — the teacher thinks; the MCP structures.

---

## 4. Output Format and Anti-Patterns

The overarching principle is **export-safety by design**. `Teacher_Insights.md` is consumed by Teacher_MCP via the bridge `student_data_to_teacher.md`, and Teacher_MCP forwards content to Anthropic via Claude Desktop conversation. Anything saved here is, in effect, sent to Anthropic. Output rules are written with this destination in mind.

### 4.1 Frontmatter

YAML frontmatter at the top of the file (created on first write by `InsightsWriter.createNewFile`):

```yaml
---
type: teacher_insight
created: <ISO-8601 timestamp>
date: <YYYY-MM-DD>
course_code: <from exam_config.yaml, e.g., "COURSE_BIO">
course_instance: <from exam_config.yaml, e.g., "2026-prov5">
status: active
metadata_version: "1.0"
tags: [assessment, teacher-insight, <exam-tag>]
questions_analyzed: [Q011, Q012, ...]
provenance:
  tool: reflect_insights
  ai_assisted: true
---
```

The frontmatter is generated mechanically and contains no per-student data.

### 4.2 Insight entry format

Each appended insight follows this structure:

```markdown
### <YYYY-MM-DD HH:MM> - <Swedish category header>

*Frågor: Q013*    ← optional italic line, ONLY if related_questions present

<insight content as free text>

---
```

### 4.3 Anti-patterns: what does NOT belong in `Teacher_Insights.md`

The following must not appear in any field:

- **5-digit student IDs in body text.** Per-student data belongs in Phase 9 (per-student profile), not in aggregate insights. Aggregate counts ("5/8 students") are required; specific IDs are forbidden.
- **The `*Elever:`-line that `insights_writer.ts:78` currently emits.** This line was generated when `relatedStudents` was passed to the tool. It must no longer be emitted. (Implementation: deprecate the `related_students` schema field; ignore the field in `formatEntry()` for backward compatibility.)
- **Specific verbatim quotes from student answers.** Even anonymized, a unique error formulation can identify the student to a colleague who knows the class. Paraphrase or generalize: *"a common error was conflating dendrite structure with axon function"*, not *"one student wrote: 'dendriten är som en gren'"*.
- **Identifying combinations.** *"The student who lives in the countryside and confused EU ETS with energy tax"* can identify a specific person even without a name. If a description is sufficiently specific that a colleague familiar with the class could deduce who it is, it does not belong here.
- **Third-party names.** Colleagues, family members, school staff, other students by name — none of these belong here. The teacher's own prose may inadvertently include such names ("my colleague [name redacted] suggested…"); the methodology is to avoid this from the start, not to scrub afterward.

### 4.4 Anti-patterns: what is permitted (and important)

The following are permitted and central to the document's purpose:

- **Aggregate frequencies.** *"5/8 students confused X with Y"*, *"the majority of students reached the multistructural level"*, *"two-thirds got full marks"*.
- **Pattern descriptions without IDs.** *"There was a recurring pattern of treating the cell membrane as a barrier rather than a selective interface."*
- **Pedagogical recommendations.** *"Next year I should introduce osmosis with a comparison diagram before the formal definition."*
- **Question-level critique.** *"Q3's wording produced more interpretation problems than expected; consider rephrasing."*
- **Question references.** `Frågor: Q013` is acceptable in the italic line — questions are not student data.
- **Pedagogical terminology (SOLO, Hattie & Timperley, Sadler, Bloom, etc.).** Permitted and expected — this is the teacher's professional vocabulary for reflection. The downstream reader of `Teacher_Insights.md` (via the Teacher_MCP bridge) is still the teacher in dialogue with Claude Desktop, who understands these terms. Anthropic's API is a data processor, not a pedagogical reader.

### 4.5 Examples: good vs. not-an-insight

**Good insight (worth saving):**

```
5/18 students believe kidneys regulate oxygen levels. This reveals
confusion between kidney function (waste management) and lung function
(gas exchange). Teaching recommendation: Create a comparison table
of organ functions in the next lecture.
```

This is concrete, evidence-grounded, aggregate-formulated, and oriented toward action.

**Not an insight (automated data):** raw per-student scores. This is per-student progression data and belongs in `Assessment_Status_Summary.md`, not `Teacher_Insights.md`.

---

## 5. Cross-Phase Usage

`reflect_insights` is **not** specific to a single phase. The tool is used wherever pedagogical observations emerge from assessment work. Per `reflection/README.md`:

| Phase | Use case |
|-------|----------|
| Phase 3 (future) | Document syllabus alignment observations |
| **Phase 6** | **Save patterns discovered during assessment dialogue** (most common usage) |
| Phase 7 | Compile comprehensive teaching insights at end of assessment |
| Phase 8 (future) | Include in export reports |
| Phase 9 | Note patterns visible across one student's answers (during hermeneutic synthesis) |
| Phase 13 | Capture class-level pattern observations during teacher summary work |

The output file (`Teacher_Insights.md`) accumulates contributions from any phase that calls the tool. There is no phase-bound separation in the file — insights from Phase 6 and Phase 13 work coexist.

---

## 6. Quality Criteria

A high-quality insight has the following properties:

**Concrete, not vague.** *"Q3 was difficult"* is vague. *"5/8 students confused dendrite structure with axon function on Q3"* is concrete: it names the question, the count, and the specific conceptual confusion.

**Evidence-grounded.** Each claim is traceable to specific question results or specific patterns observed during assessment. *"Students struggle with cellular biology"* without evidence is unfalsifiable.

**Aggregate-formulated.** Per § 4.3, individual student IDs do not belong in `Teacher_Insights.md`. *"5/8 students confused X with Y"* — aggregate. *"one student confused X with Y"* — per-student, belongs in Phase 9.

**Future-oriented.** A good insight implies action: *"This concept needs more explicit treatment next year — perhaps a comparison diagram before the formal definition"*. Pure description without orientation toward action is incomplete.

**Non-duplicating.** Phase 6 (per-question assessments) and Phase 9 (per-student profiles) already capture per-question and per-student data. Insights add value when they synthesize across questions, identify cross-cutting patterns, or surface methodological observations that the structured Phase 6/9 outputs do not capture.

**Categorised correctly.** The four categories (`pattern`, `pedagogical`, `critical`, `summary`) are not interchangeable. Mis-categorisation reduces the document's usability for downstream Phase 13 curation.

---

## 7. Configuration and Operation

### 7.1 Tool registration

`reflect_insights` is registered in `packages/assessment-mcp/src/server.ts`. Locate by searching for the tool name; line numbers shift as the file evolves.

The tool description in `server.ts` is what Claude Desktop sees at tool-discovery time. It must reference this methodology document and include the audience-discipline anti-patterns from § 4.3.

### 7.2 Files generated

`Teacher_Insights.md` is created in the assessment project folder (same folder as Q-files), one file per project. It is appended to over the project's lifetime; it is not regenerated.

### 7.3 Workflow logging

The tool logs to `workflow_log.jsonl` via `logWorkflowAction`. The action type is `insight_save` and is logged as a Phase 6 sub-action (insights typically emerge during Phase 6, even though the tool is cross-phase).

### 7.4 Integration with `exam_config.yaml`

The first time `Teacher_Insights.md` is written for an assessment project, `InsightsWriter.createNewFile` reads `exam_config.yaml` to populate frontmatter with `course_code`, `course_instance`, and `questions_analyzed`. Graceful degradation if config is missing.

---

## 8. Relationship to Other Methodology Files

| File | Relationship |
|------|-------------|
| `quality_assurance_method.md` | **Sister methodology** for `reflect_uncertainty`. Different theoretical grounding (Sadler's subjectivity in assessment), different output format. Both are cross-phase reflection-tool methodologies. |
| `descriptive_statistics_method.md` | **Sister methodology** for `reflect_aspect_analysis`. Different theoretical grounding (descriptive statistics, exploratory data analysis). Aspect analysis can append to `Teacher_Insights.md` as a `summary`-type insight under specific constraints (`include_students=false`). |
| `00_foundation.md` §3.7–3.9 | **Audience discipline framework.** Anti-patterns in § 4.3 of this document are an application of §3.7–3.9 for cross-phase tools. |
| `phase13_teacher_summary_method.md` | **Downstream consumer.** Phase 13 curates insights from `Teacher_Insights.md` into the formal class summary. Quality dependency: Phase 13's class summary is bounded by Phase 7's insight quality. |
| `Teacher_MCP/methodology/bridges/student_data_to_teacher.md` | **Downstream bridge.** `Teacher_Insights.md` is a destination of this bridge. Format expectations from the bridge inform output rules in § 4. |

---

## 9. References

### Primary theoretical sources

- Schön, D. A. (1983). *The Reflective Practitioner: How Professionals Think in Action*. Basic Books.
- Schön, D. A. (1987). *Educating the Reflective Practitioner*. Jossey-Bass.
- Boud, D., Keogh, R. & Walker, D. (Eds.) (1985). *Reflection: Turning Experience into Learning*. Kogan Page.
- Black, P. & Wiliam, D. (1998). Inside the black box. *Phi Delta Kappan, 80*(2), 139–148.
- Black, P. & Wiliam, D. (2009). Developing the theory of formative assessment. *Educational Assessment, Evaluation and Accountability, 21*(1), 5–31.
- Larrivee, B. (2000). Transforming teaching practice. *Reflective Practice, 1*(3), 293–307.
- Ericsson, K. A. & Simon, H. A. (1980/1993). *Protocol Analysis: Verbal Reports as Data*. MIT Press.

### Implementation references

- Reflection tools were moved from `core/` to `reflection/` (2026-01-14) to clarify their cross-phase nature

### Related methodology files

- `methodology/00_foundation.md` §3.7–3.9 — audience-discipline framework
- `methodology/cross_phase/quality_assurance_method.md` — sister methodology
- `methodology/cross_phase/descriptive_statistics_method.md` — sister methodology
- `methodology/pedagogical/phase13_teacher_summary_method.md` — downstream consumer
- `Teacher_MCP/methodology/bridges/student_data_to_teacher.md` — downstream bridge

---

*Meta-Reflection Method v1.0 — split from phase7_meta_reflection_method.md v1.1 on 2026-05-05.*
*Cross-phase tool methodology. Tool `reflect_insights` lives in `packages/assessment-mcp/src/tools/`; storage logic in `reflection/insights_writer.ts`.*
