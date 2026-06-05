# ADR-007: Folder-Phase Alignment & Constants Centralization

**Status:** Accepted (Implementation Complete)
**Date:** 2026-03-01
**Author:** Niklas Karlsson + Claude
**Related:** ADR-002 (Tool Naming), ADR-006 (Phase Renumbering), RFC-018 (Folder Restructuring), RFC-028 (Course Material Import)

---

## Context and Problem Statement

The Assessment Suite pipeline uses numbered directories (01–14) to organise project data by phase. After RFC-018 and RFC-028, the folder numbers align with their corresponding phase numbers. However, folder name strings were hardcoded across ~40 source files in both TypeScript and Python packages. This makes renaming fragile and creates a maintenance burden when the structure evolves.

Additionally, legacy folder names exist in production projects that need migration support, and `14_aterkoppling_till_elev` (Swedish) was inconsistent with the otherwise English naming convention.

---

## Decision Drivers

* Folder numbers should be self-documenting — `06_analytic_assessment` clearly maps to Phase 6
* A single rename required changes in 40+ files, making refactoring error-prone
* Production projects may use legacy folder names that should be migrated automatically
* Both MCP packages (TypeScript + Python) need synchronized folder names
* Folder names should be consistently English (ADR-007 decision: rename `14_aterkoppling_till_elev`)

---

## Considered Options

### Option 1: Document-Only ADR

**Description:** Document the folder-phase mapping but leave hardcoded strings as-is.

**Pros:**
- Zero code changes, no risk of regressions

**Cons:**
- Does not solve the maintenance problem
- Future renames remain error-prone

### Option 2: ADR + Centralize Constants

**Description:** Document the mapping AND extract all folder name strings into shared constants files (one per language).

**Pros:**
- Single source of truth for folder names
- Future renames become one-line changes
- Import statements make dependencies explicit

**Cons:**
- Large initial changeset
- Risk of typos during mechanical replacement

---

## Decision Outcome

**Chosen Option:** Option 2 — ADR + Centralize Constants

### Rationale

The one-time cost of replacing hardcoded strings is small compared to the ongoing risk of inconsistent folder names. The replacement is purely mechanical and can be verified with grep.

---

## Folder-Phase Mapping

### Phase Folders (created by respective phases)

| Folder | Phase | Purpose | Created by |
|--------|-------|---------|------------|
| `01_original` | Phase 1 | Original uploaded files (PDF/images) | Phase 1 setup |
| `02_markdown` | Phase 2 | Converted markdown files | Phase 2A convert |
| `03_material` | Phase 3 | Course material (teacher places files manually) | Phase 1 setup |
| `04_rubric` | Phase 4 | Rubric configuration | Phase 1 setup |
| `05_answers_by_question` | Phase 5 | Q-files (answers split by question) | Phase 5 |
| `06_analytic_assessment` | Phase 6 | Analytic assessment (dated copies with per-student assessments) | Phase 1 setup |
| `07_analytic_student` | Phase 7 | Student-centric analytic reports (`Analytic_{student}.md`) | Phase 7 |
| `08_quantitative` | Phase 8 | Quantitative analysis & aggregation (JSON + summary) | Phase 8 (on-demand) |
| `09_qualitative` | Phase 9 | Qualitative generalization (`Student_{id}_generalization.md`) | Phase 9 (on-demand) |
| `10_extrapolation` | Phase 10 | Criteria mapping / extrapolation | Phase 10 (on-demand) |
| `11_grading` | Phase 11 | Grade decision documents | Phase 11 (on-demand) |
| `12_feedback` | Phase 12 | Formative teacher feedback (Lundahl 3-step model) | Phase 12 (on-demand) |
| `13_teacher_summary` | Phase 13 | Teacher summary report (class-level formative assessment) | Phase 13 (on-demand) |
| `14_student_feedback` | Phase 14 | Student-facing feedback summary (simplified for students) | Phase 14 (on-demand) |

### Non-Phase Folders

| Folder | Purpose | Created by |
|--------|---------|------------|
| `complete_assessment` | Progressive student reports (`Complete_{student}.md`). Phase 7 creates the file; Phases 9–14 append sections. | Phase 7 |
| `methodology` | Methodology documents (copied from monorepo) | Phase 1 setup |

### Project Root Files (not folders)

| File | Purpose | Written by |
|------|---------|------------|
| `exam_config.yaml` | Question definitions, rubric config, student list | Phase 2B, 2C, 2D, 4B, 4C |
| `project_state.json` | Phase completion status, session state | All phases |
| `sources.yaml` | Source file tracking | Phase 1 |
| `workflow_log.jsonl` | Audit trail of all tool actions | All phases |

### Important Notes

1. **Phase 1 creates folders 01–07 + complete_assessment + methodology.** Phases 08–14 create their folders on-demand when first run.
2. **Phase 3 has no tools.** The teacher places course materials in `03_material/` manually or via `course_content_path` parameter in Phase 1.
3. **Phase 2 outputs go to multiple locations:** 2A writes to `02_markdown/`, but 2B/2C/2D write to `exam_config.yaml` in the project root.
4. **`05_uncertainty_review/`** is used by the reflection module (`reflect_uncertainty` tool, RFC-009) and is NOT part of the standard phase structure. It shares the `05_` prefix with `05_answers_by_question` as an exception.

### Legacy Folder Names

| Legacy Name | Current Name | Migration |
|------------|--------------|-----------|
| `02_converted` | `02_markdown` | RFC-018 |
| `03_answers_by_question` | `05_answers_by_question` | RFC-018 |
| `03_student_answers` | `05_answers_by_question` | ADR-007 (production legacy) |
| `04_student_reports` | `07_analytic_student` | RFC-018 |
| `14_aterkoppling_till_elev` | `14_student_feedback` | ADR-007 (standardise to English) |

---

## Implementation

### Constants Files

**TypeScript:** `packages/assessment-mcp/src/shared/folder_constants.ts`
- `FOLDERS` object with all current folder names
- `LEGACY_FOLDERS` object with all legacy folder names
- `ALL_KNOWN_FOLDERS` array (used by `project_repair.ts`)

**Python:** `packages/assessment-data-mcp/src/assessment_data_mcp/constants/folders.py`
- Module-level constants mirroring the TypeScript definitions

### Migration Script

`packages/assessment-data-mcp/scripts/migrate_folder_structure.py` updated:
- `03_student_answers` → `05_answers_by_question` (ADR-007)
- `14_aterkoppling_till_elev` → `14_student_feedback` (ADR-007)

### Implementation Status

| Area | Status | Details |
|------|--------|---------|
| Constants files (TS + Python) | Done | Both files created and synchronized |
| TypeScript source replacement | Done | ~14 files import `FOLDERS`, all orchestrators/tools/server.ts updated |
| Python source replacement | Done | 9 files import from `constants.folders` (using relative imports `from ..constants.folders`) |
| Migration script | Done | Handles all 5 legacy folder names |
| `project_repair.ts` | Done | Uses `ALL_KNOWN_FOLDERS` instead of hardcoded array |
| Exception: `05_uncertainty_review` | Not centralized | Reflection module uses this non-standard folder; not in `FOLDERS` constant |

---

## Consequences

### Positive Consequences

* Future folder renames require changing one file per language
* Import statements make folder dependencies explicit and grep-able
* Legacy folder names are documented and handled by migration tooling
* `project_repair.ts` knownDirs derived from constants (always in sync)
* `14_aterkoppling_till_elev` standardised to English (`14_student_feedback`)

### Negative Consequences

* Template literals in tool descriptions slightly reduce readability
* `05_uncertainty_review` remains outside the constants system (known exception)

### Mitigation Strategies

Mechanical replacement verified by: (1) build succeeds, (2) all tests pass, (3) grep confirms only `folder_constants.ts`/`folders.py` contain hardcoded folder strings.

---

## Validation

1. `npm run build` — no compile errors
2. `npm test` — 14/14 tests pass (assessment-mcp)
3. `uv run pytest` — 168/168 tests pass (assessment-data-mcp)

---

## Related Decisions

* [ADR-002: Tool Naming Standardization](./ADR-002-tool-naming-standardization.md) — tool names mirror phase names which mirror folder names
* [ADR-006: Phase Renumbering](./ADR-006-phase-renumbering.md) — renumbered phases 2/4
* RFC-018: Folder Restructuring — original 03→05, 04→07 renaming
* RFC-028: Course Material Import — added 03_material, 04_rubric

---

**Status:** Accepted (Implementation Complete)
**Last Updated:** 2026-03-01
