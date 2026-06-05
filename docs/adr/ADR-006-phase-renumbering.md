# ADR-006: Phase Renumbering — Mechanical Extraction (Phase 2) and Rubric Work (Phase 4)

**Status:** Approved
**Date:** 2026-02-28
**Author:** Niklas Karlsson + Claude
**Related:** RFC-028 (Course Material Import & Rubric Construction)

---

## Context

The current phase numbering reflects the order in which tools were built, not the order in which they should execute. Phase 4A–4E contains five sub-phases that serve two distinct purposes:

- **Mechanical extraction** (4A questions, 4D boundaries, 4E students): automated data extraction from exam and student files, no teacher judgement required
- **Rubric work** (4B validation, 4C report/save): rubric parsing and configuration saving, depends on a rubric existing

Production experience shows that rubric construction benefits from seeing questions and student responses first (RFC-028). The current numbering forces an illogical execution order: 4A → 4B → 4C → 4D → 4E, when the effective order is 4A → 4D → 4E → rubric construction → 4B → 4C.

Additionally, the directory structure has two gaps (03, 04) left by RFC-018. RFC-028 fills these with `03_material/` and `04_rubric/`.

---

## Decision

Renumber phases to align with execution order and conceptual grouping.

### Phase 2: Mechanical Extraction

All automated extraction steps that require no teacher judgement. These run sequentially after Phase 1 setup.

| Current tool | New tool name | Function |
|-------------|---------------|----------|
| `convert_to_markdown` | `phase2a_convert` | PDF to markdown conversion |
| `phase4a_questions` | `phase2b_questions` | Question detection in exam text |
| `phase4d_boundaries` | `phase2c_boundaries` | Answer boundary detection in student files |
| `phase4e_students` | `phase2d_students` | Student ID discovery and registration |

**Execution order:** 2a → 2b → 2c → 2d (linear, no branching)

**Note:** `convert_to_markdown` currently has no phase prefix. It gains one for consistency.

### Phase 3: Course Material Import

No tools. `03_material/` is created by Phase 1. Teacher places course materials there manually or via `course_content_path` parameter. See RFC-028.

### Phase 4: Rubric Construction & Verification

| Current tool | New tool name | Function |
|-------------|---------------|----------|
| — | *(methodology only)* | 4a: Rubric construction (teacher-led, three entry points) |
| `phase4b_rubric` | `phase4b_rubric` | 4b: Rubric parsing — extracts aspects, validates points |
| `phase4c_report` | `phase4c_save` | 4c: Save configuration to exam_config.yaml |

**Execution order:** 4a (methodology) → 4b → 4c

Phase 4a is methodology-driven, not a tool. The methodology document (`methodology/phase4_rubric_construction.md`) governs this step.

### Phases 5+ unchanged

| Phase | Name | Change |
|-------|------|--------|
| 5 | Split by Question | No change |
| 6 | Analytic Assessment | No change |
| 7 | Student Reports | No change |
| 8 | Parse & Aggregate | No change |
| 9–14 | Extended phases | No change |

---

## Consequences

### Files to rename

**Tool source files (assessment-mcp):**

| Current | New |
|---------|-----|
| `src/tools/phase4a_questions.ts` | `src/tools/phase2b_questions.ts` |
| `src/tools/phase4d_boundaries.ts` | `src/tools/phase2c_boundaries.ts` |
| `src/tools/phase4e_students.ts` | `src/tools/phase2d_students.ts` |
| `src/tools/phase4b_rubric.ts` | unchanged |
| `src/tools/phase4c_report.ts` | `src/tools/phase4c_save.ts` |

**Methodology documents:**

| Current | New |
|---------|-----|
| `methodology/phase4a_question_detection.md` | `methodology/phase2b_question_detection.md` |
| `methodology/phase4b_rubric_validation.md` | unchanged |
| `methodology/phase4c_student_report.md` | `methodology/phase4c_save.md` |
| `methodology/phase4d_answer_boundaries.md` | `methodology/phase2c_answer_boundaries.md` |
| — | `methodology/phase4_rubric_construction.md` (new, RFC-028) |

**Tool registration in `server.ts`:**
- Tool names in `ListToolsRequestSchema` handler
- Case labels in `CallToolRequestSchema` handler
- Import statements

**Other references:**
- `ROADMAP.md` — phase descriptions
- `README.md` — pipeline description
- `CHANGELOG.md` — historical references (do NOT rewrite history)
- `project_state.json` — phase status tracking
- Existing methodology documents that reference Phase 4A/4D
- `docs/` — API docs, user guide, getting started

### Migration for existing projects

Existing projects have `project_state.json` with phase keys like `"4_question_detection"`. Options:

1. **Accept both old and new keys** — state manager reads either format
2. **Migration script** — update existing project_state.json files
3. **Ignore** — old projects keep old keys, new projects get new keys

Recommendation: option 1 (accept both). Minimal code, no migration needed.

### convert_to_markdown gains a prefix

`convert_to_markdown` (assessment-data-mcp, Python) becomes `phase2a_convert`. This is the only change to the Python MCP server. The tool is registered in `server.py` — a single name change.

---

## Risks

### Scope of rename

The rename touches tool names, file names, imports, methodology documents, and documentation. A single missed reference breaks the build or produces confusing output. Mitigation: systematic grep for all old names before closing the implementation.

### CHANGELOG history

Historical entries reference old phase numbers. These should NOT be rewritten — they document what happened at the time. Future entries use new numbering.

### Cowork and Claude Desktop sessions

Cached MCP tool lists in active sessions will show old tool names until the session is refreshed. Not a code risk, but a user confusion risk.

---

## Implementation order

1. Rename source files and update imports
2. Update tool registration in `server.ts` (both ListTools and CallTool)
3. Rename methodology documents
4. Update `phase1_setup.py` folder list (add `03_material/`, `04_rubric/`)
5. Update `convert_to_markdown` → `phase2a_convert` in Python server
6. Update state manager to accept both old and new phase keys
7. Build and verify (`npm run build`)
8. Update ROADMAP.md, README.md
9. Grep for remaining references to old names
