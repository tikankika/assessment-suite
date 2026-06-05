---
title: "Cross-Phase Reflection Tools — methodology overview"
target_path: methodology/cross_phase/README.md (when approved)
created: 2026-05-05
type: methodology-readme
language: English
---

# Cross-Phase Reflection Tools

This folder contains methodology documents for **cross-phase reflection tools** — tools that support teacher reflection and meta-analysis across multiple assessment phases, not bound to any single phase.

The tools live in `packages/assessment-mcp/src/reflection/` and were moved from `packages/assessment-mcp/src/core/` to reflect their cross-phase nature.

---

## The three reflection tools

| Tool | Purpose | Methodology document |
|------|---------|----------------------|
| `reflect_insights` | Save teacher meta-observations (patterns, pedagogical insights, technical concerns, summaries) to `Teacher_Insights.md` | [meta_reflection_method.md](meta_reflection_method.md) |
| `reflect_uncertainty` | Create structured quality-review documents in `05_uncertainty_review/` for `bedömningsansvarig` review | [quality_assurance_method.md](quality_assurance_method.md) |
| `reflect_aspect_analysis` | Generate per-aspect descriptive statistics from completed Phase 6 assessments | [descriptive_statistics_method.md](descriptive_statistics_method.md) |

---

## Why three separate methodologies

The three tools share certain properties — cross-phase use, audience-discipline relevance, MCP role as scaffolding — but they are **functionally distinct**:

- `reflect_insights` is **pedagogical reflection** (theoretical grounding: Schön, Boud, Black & Wiliam, Larrivee)
- `reflect_uncertainty` is **quality assurance** (theoretical grounding: Sadler on subjectivity, Moss on hermeneutic assessment)
- `reflect_aspect_analysis` is **descriptive statistics** (theoretical grounding: Tukey on EDA, Cronbach & Meehl on observation/interpretation)

These are different bodies of theory and different practitioner traditions. Forcing them into a single methodology document would either (a) over-claim that they share theoretical grounding they do not, or (b) reduce to a generic "reflection tools" document that under-serves each tool's specific context.

A separate methodology per tool gives:

- Per-tool depth — each tool gets the theoretical grounding that fits its purpose
- Direct access — when working with a specific tool, open its specific methodology
- Scalable — if new reflection tools are added, they get their own methodology
- Disciplined separation — each document has a focused scope

---

## What is shared across the three

Despite the functional separation, certain elements are common to all three methodologies:

- **Cross-phase use** — all three can be invoked from multiple phases (Phase 3, 6, 7, 8, plus role-specific use)
- **MCP role: scaffolding, not generation** — tools save or compute; teachers and Claude Desktop interpret
- **Audience discipline (`00_foundation.md` §3.7–3.9)** — applies to all three, with documented exceptions (e.g., uncertainty reviews require student IDs by necessity)
- **Workflow logging convention** — all three log as Phase 6 sub-actions even though they are cross-phase

These shared elements are referenced from each methodology rather than duplicated, to keep the documents focused and consistent.

---

## Relationship to phase-specific methodologies

The cross-phase reflection tools complement, but do not replace, phase-specific methodologies. The relationship by phase:

| Phase | Phase-specific methodology | Cross-phase tools used |
|-------|----------------------------|-------------------------|
| Phase 6 (analytic assessment) | `phase6_assessment_method.md` | All three reflection tools (most common phase of use) |
| Phase 9 (hermeneutic synthesis) | `phase9_generalization_method.md` | `reflect_insights` (during synthesis); occasional `reflect_aspect_analysis` for context |
| Phase 13 (class summary) | `phase13_teacher_summary_method.md` | `reflect_insights` (consumed as raw material); `reflect_aspect_analysis` (informs DEL 1 statistics) |
| Phase 7 ("comprehensive reports") | (no formal methodology — operative phase that uses cross-phase tools comprehensively) | All three, in batch mode |

Phase 7 is treated here as an **operative phase** where reflection tools are used in comprehensive mode after Phase 6 is complete. There is no separate `phase7_method.md` because Phase 7's content is fully described by the cross-phase tool methodologies — Phase 7 is *when* they are used comprehensively, not *what* they specifically do.

---

## Historical note

These three methodologies were initially drafted as a single unified document `methodology/pedagogical/phase7_meta_reflection_method.md` (v1.1, commit `5e7bae9` on 2026-05-05). After review, the unified document was split into the three current files because:

1. The unified document misclassified the tools as Phase 7-specific, when reflection/README.md had documented their cross-phase nature since January 2026.
2. The three tools have distinct theoretical groundings that are better served by separate methodologies.
3. Long-term readability — opening a specific tool's methodology directly is more efficient than navigating a 7000-word unified document.

The original `phase7_meta_reflection_method.md` is no longer canonical. References that previously pointed there now point to the appropriate cross-phase methodology document.

The previous file `methodology/teacher_insights_guide.md` (which preceded the v1.1 unified document) was archived to `methodology/_archive/teacher_insights_guide.md` in commit `5e7bae9`. Its content was integrated into v1.1 and is now distributed across the three methodologies — primarily into `meta_reflection_method.md`.

---

## See also

- `methodology/00_foundation.md` §3.7–3.9 — audience-discipline framework
- `methodology/pedagogical/` — phase-specific assessment methodologies
- `Teacher_MCP/methodology/bridges/student_data_to_teacher.md` — downstream consumer of `Teacher_Insights.md`

---

*Cross-phase reflection tools README v1.0 — created 2026-05-05 alongside the three method documents (Spår 6).*
