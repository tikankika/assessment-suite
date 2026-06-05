---
title: "Descriptive Statistics Method (for `reflect_aspect_analysis`)"
version: 1.0
status: Draft (split from phase7_meta_reflection_method.md v1.1, 2026-05-05)
type: methodology
target_path: methodology/cross_phase/descriptive_statistics_method.md (when approved)
authors:
  - Niklas Karlsson
  - Cowork-Claude / Code-Claude (collaborative drafting)
theoretical_grounding:
  - Tukey (1977) — exploratory data analysis, "looking at data"
  - Cronbach & Meehl (1955) — distinction between observation and interpretation
  - Bjork (1994) — desirable difficulties (when interpreting distribution shape)
related_tools:
  - reflect_aspect_analysis (`packages/assessment-mcp/src/tools/reflect_aspect_analysis.ts`)
  - AspectAnalyzer (`packages/assessment-mcp/src/reflection/aspect_analyzer.ts`)
related_methodology:
  - 00_foundation.md §3.7–3.9 (audience discipline)
  - meta_reflection_method.md (sister cross-phase methodology — receives append output)
  - quality_assurance_method.md (sister cross-phase methodology)
  - phase4_rubric_design_method.md (defines aspects; per-aspect statistics presuppose aspects exist)
language: English (parity with other methodology files)
---

# Descriptive Statistics Method (for `reflect_aspect_analysis`)

This is one of three cross-phase reflection-tool methodologies. The tools (`reflect_insights`, `reflect_uncertainty`, `reflect_aspect_analysis`) live in `packages/assessment-mcp/src/reflection/` and are designed to be used across multiple assessment phases — see `cross_phase/README.md`.

This document covers `reflect_aspect_analysis` and its output: per-aspect descriptive statistics from Phase 6 assessments.

---

## 1. Purpose

`reflect_aspect_analysis` generates descriptive statistics per assessment aspect from completed Phase 6 assessments. It **observes**; it does not interpret.

The tool's role: **compute the numbers; let the methodology and the teacher interpret them**. Mean, median, range, distribution per aspect — these are observations. *"This distribution suggests bimodal understanding"* is interpretation; that belongs in dialogue with Claude Desktop, possibly saved as a `summary`-type insight via `reflect_insights` (sister tool).

The tool's output is statistics in one of three formats (`summary`, `detailed`, `json`), optionally appended to `Teacher_Insights.md` as a summary-type insight under specific export-safety constraints.

---

## 2. Theoretical Foundation

### 2.1 Exploratory data analysis (Tukey)

Tukey (1977) — *Exploratory Data Analysis* — argued that statistics should serve looking at data, not just confirming hypotheses. His approach prioritized **simple summaries that reveal structure** (means, medians, ranges, distributional shape) over complex models that obscure it.

`reflect_aspect_analysis` follows Tukey's approach. It produces straightforward descriptive statistics — not inferential statistics, not modelling. The teacher and Claude Desktop look at the numbers and decide what they mean. The tool's job is to make the looking efficient.

This contrasts with assessment-validity-as-psychometrics traditions where reliability coefficients and factor analyses are produced as automatic outputs. Such outputs would over-claim what the data supports in classroom assessment contexts (small N, qualitative criteria). Tukey-style descriptive observation is more defensible.

### 2.2 Observation before interpretation (Cronbach & Meehl, foundation principle)

`00_foundation.md` §3.1 articulates *"observation before interpretation"* as a core methodology principle. This applies directly here: the tool observes (counts, computes ratios, identifies distributional shape) but does not interpret (claim what the distribution means about teaching, students, or the question itself).

The principle is rooted in measurement theory's distinction between observed score and inferences drawn from it (Cronbach & Meehl 1955 on construct validity). `reflect_aspect_analysis` produces observed scores; the inferential work happens in dialogue and is saved (if at all) via `reflect_insights`.

### 2.3 Distributional shape as informative (Bjork)

Bjork's (1994) *desirable difficulties* literature argues that the *shape* of a score distribution can be more informative than central tendency alone. A bimodal distribution — students either fully understood or did not — has different pedagogical implications than a normal distribution centered on partial credit.

`reflect_aspect_analysis` reports distribution explicitly (e.g., *"0p: 2, 1p: 5, 2p: 8"*) rather than just mean and standard deviation. This makes distributional shape visible to the teacher's eye without requiring statistical sophistication.

---

## 3. The Tool — `reflect_aspect_analysis`

### 3.1 Trigger

Manual invocation by Claude Desktop on the teacher's request: *"Generate aspect analysis for Q3."*

The tool requires that Phase 6 assessment is complete for the relevant Q-file. It will refuse to run if no assessed students are found.

### 3.2 Inputs

| Field | Purpose |
|-------|---------|
| `q_file_path` | Identifies the Q-file to analyze |
| `output_format` | One of: `summary` (default), `detailed`, `json` |
| `include_students` | Whether per-student data is shown in output (default: false) |
| `append_to_insights` | Whether to append the result to `Teacher_Insights.md` as a `summary`-type insight (default: false) |

### 3.3 Outputs by format

**`summary`** — concise overview suitable for dialogue interpretation:

```
Q3 Aspect Analysis (14 students assessed)

Aspect F2 (concept understanding):
  Mean: 1.4/3, Median: 1, Range: 0–3
  Distribution: 0p: 4, 1p: 6, 2p: 3, 3p: 1

Aspect F4 (application):
  ...
```

**`detailed`** — fuller breakdown with per-aspect distributional data:

```
Q3 Aspect Analysis (14 students assessed)

==== Aspect F2: Concept Understanding (max 3) ====

Statistics:
  Students assessed: 14
  Mean: 1.43
  Median: 1.0
  Range: 0 – 3
  Standard deviation: 0.88

Distribution:
  0p: 4 students (29%)
  1p: 6 students (43%)
  2p: 3 students (21%)
  3p: 1 student (7%)

[If include_students=true: per-student listing here]

Notable observations:
  - Bimodal pattern not present
  - Skewed toward lower scores
  - One student at maximum

==== Aspect F4: ... ====
```

**`json`** — programmatic format for downstream tools:

```json
{
  "question_id": "Q3",
  "students_assessed": 14,
  "aspects": [
    {
      "id": "F2",
      "name": "Concept understanding",
      "max_points": 3,
      "mean": 1.43,
      "median": 1.0,
      "range": [0, 3],
      "std": 0.88,
      "distribution": {"0": 4, "1": 6, "2": 3, "3": 1}
    }
  ]
}
```

### 3.4 MCP role: mechanical analysis

Per the file's own documentation: *"Returns raw statistics. Pedagogical interpretation left to methodology/LLM."* The tool computes; the teacher and Claude interpret.

This is consistent with the broader principle: AI handles structure (the statistics), humans hold meaning (what the statistics imply for teaching).

---

## 4. Critical Export-Safety Rule

### 4.1 The interaction between `include_students` and `append_to_insights`

When `append_to_insights=true`, the formatted output that ends up as `content` in `Teacher_Insights.md` **must not contain student IDs**. This is required because `Teacher_Insights.md` is consumed by Teacher_MCP via the bridge `student_data_to_teacher.md`, and Teacher_MCP forwards content to Anthropic via Claude Desktop conversation.

The technical mechanism: `formatDetailed(analysis, include_students)` produces the output string. When `include_students=true`, that string contains per-student IDs. When the output is appended to the insights file, those IDs become part of the persistent body text — and reach Anthropic on every Teacher_MCP read.

### 4.2 Implementation: enforce automatically (Approach A)

The methodology requires that the implementation **forces `include_students=false` automatically when `append_to_insights=true`**. This is the recommended approach because it removes the need for the user to remember the constraint; the tool simply does the right thing.

The alternative (refuse the combination with an error message) is acceptable but worse UX — it requires the user to retry the call.

This is implementation work for the BUILD phase. Until the constraint is enforced in code, it is the responsibility of Claude Desktop's prompt-side reasoning. The methodology document is the authoritative specification.

### 4.3 When `include_students=true` is appropriate

`include_students=true` is appropriate when **the data does not persist** — i.e., when `append_to_insights=false` and the analysis is used in dialogue only.

Use cases for `include_students=true`:

- Phase 6 assessment dialogue: *"Show me which students got 0 on aspect F2 — let me look at their answers."*
- Borderline case investigation: per-student data informs whether a `reflect_uncertainty` call is warranted
- Quick reference during Phase 9 hermeneutic synthesis

In these cases, the data is shown to the teacher in the conversation but is not saved to a file.

### 4.4 Aggregate level matches purpose

A high-quality aspect analysis chooses the right aggregate level for its purpose:

- For dialogue exploration: any format works; `include_students=true` may be appropriate
- For appending to insights: `include_students=false` (enforced)
- For LMS export (Phase 8 future use case): aggregate-only by definition (LMS doesn't need per-student details from this tool — it has its own per-student data)

---

## 5. Cross-Phase Usage

`reflect_aspect_analysis` is used across multiple phases. Per `reflection/README.md`:

| Phase | Use case |
|-------|----------|
| **Phase 6** | **During assessment to identify difficult aspects** — guides where the teacher should focus reflective work |
| Phase 7 | Comprehensive aspect analysis reports (batch processing of all Q-files) |
| Phase 8 | LMS export with per-aspect breakdowns (future) |

The tool is not bound to a single phase. It can be invoked whenever Phase 6 data is sufficient (i.e., at least some students assessed for the Q-file in question).

---

## 6. Quality Criteria

A high-quality aspect analysis output has the following properties:

**Correct format choice.** The `output_format` parameter (`summary` / `detailed` / `json`) should match the use case. `summary` for dialogue interpretation; `detailed` when per-aspect distribution matters; `json` when downstream tools or further analysis will consume the output programmatically.

**Aggregate level matches purpose.** Per § 4, `include_students` interacts with `append_to_insights`. The recommended implementation enforces this automatically; the methodology requires correctness.

**Pedagogical interpretation kept separate from statistics.** The tool returns observations. Pedagogical meaning — *"this distribution suggests bimodal understanding"*, *"this aspect needs more teaching emphasis"* — should be added in dialogue and saved (if worth saving) via `reflect_insights` as a `summary` or `pedagogical` insight. The statistics are observation; the interpretation is reflection. They live in separate categories.

**Refusal when input insufficient.** If no Phase 6 assessments exist for the Q-file, the tool refuses rather than producing output that misrepresents the data. This is consistent with `00_foundation.md` §3.1 (observation must be evidence-grounded; insufficient evidence means refuse rather than fabricate).

---

## 7. Configuration and Operation

### 7.1 Tool registration

`reflect_aspect_analysis` is registered in `packages/assessment-mcp/src/server.ts`. Locate by searching for the tool name; line numbers shift as the file evolves.

The tool description in `server.ts` is what Claude Desktop sees at tool-discovery time. It must reference this methodology document and clarify the export-safety rule (§ 4) — particularly the interaction between `include_students` and `append_to_insights`.

### 7.2 Files generated (depends on flags)

| Flags | File output |
|-------|-------------|
| `append_to_insights=false` (default) | None — output is the tool's return value, used in dialogue |
| `append_to_insights=true` | Appended to `<assessment_project>/Teacher_Insights.md` as a `summary`-type insight |

### 7.3 Workflow logging

The tool logs to `workflow_log.jsonl` via `logWorkflowAction`. The action type is `aspect_analysis_complete` and is logged as a Phase 6 sub-action.

### 7.4 Dependency on Phase 4 (rubric design)

Per-aspect statistics presuppose that aspects are defined. This requires Phase 4 (rubric design) to have completed for the Q-file. The tool reads the assessed Q-file directly; it does not consult Phase 4 output, but the Q-file's structure reflects Phase 4 decisions.

If aspects are renamed or re-defined between assessments (which should not happen mid-project but can during methodology iteration), the tool's output structure changes accordingly.

---

## 8. Relationship to Other Methodology Files

| File | Relationship |
|------|-------------|
| `meta_reflection_method.md` | **Sister methodology** for `reflect_insights`. Aspect analysis can append to `Teacher_Insights.md` as a `summary`-type insight under the export-safety constraint (§ 4). The two methodologies are tightly coupled at the append boundary. |
| `quality_assurance_method.md` | **Sister methodology** for `reflect_uncertainty`. Aspect analysis can inform whether to flag uncertainty: if a student's score on a specific aspect is far from the class distribution, that may warrant a closer look. |
| `00_foundation.md` §3.7–3.9 | **Audience-discipline framework.** § 4 of this methodology applies the audience discipline at the boundary where aspect analysis output crosses into export-safe territory. |
| `phase4_rubric_design_method.md` | **Defines aspects.** Aspect analysis is meaningful only when aspects are well-defined. Phase 4 methodology specifies aspect definition; this methodology specifies how their statistics are computed. |
| `phase6_assessment_method.md` | **Provides input data.** Aspect analysis reads Phase 6 assessments; without Phase 6 data, the tool refuses to run. |

---

## 9. References

### Primary theoretical sources

- Tukey, J. W. (1977). *Exploratory Data Analysis*. Addison-Wesley.
- Cronbach, L. J. & Meehl, P. E. (1955). Construct validity in psychological tests. *Psychological Bulletin, 52*(4), 281–302.
- Bjork, R. A. (1994). Memory and metamemory considerations in the training of human beings. In J. Metcalfe & A. Shimamura (Eds.), *Metacognition: Knowing about knowing*.

### Related foundational reading

- Black, P. & Wiliam, D. (1998). Inside the black box. *Phi Delta Kappan, 80*(2), 139–148. *(For the formative-assessment context in which descriptive statistics serve teaching, not measurement.)*

### Implementation references


### Related methodology files

- `methodology/00_foundation.md` §3.7–3.9 — audience-discipline framework
- `methodology/cross_phase/meta_reflection_method.md` — sister methodology (append boundary)
- `methodology/cross_phase/quality_assurance_method.md` — sister methodology
- `methodology/pedagogical/phase4_rubric_design_method.md` — defines aspects
- `methodology/pedagogical/phase6_assessment_method.md` — provides input data

---

*Descriptive Statistics Method v1.0 — split from phase7_meta_reflection_method.md v1.1 on 2026-05-05.*
*Cross-phase tool methodology. Tool `reflect_aspect_analysis` lives in `packages/assessment-mcp/src/tools/`; computation in `reflection/aspect_analyzer.ts`.*
