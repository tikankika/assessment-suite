# ADR-002: Tool Naming Standardization with Phase Prefixes

**Status:** Accepted
**Date:** 2025-12-31
**Deciders:** Niklas Karlsson
**Technical Story:** Tool naming inconsistency across MCP packages

---

## Context and Problem Statement

The Assessment Suite has 18 MCP tools spread across two packages (pre-assessment-mcp and assessment-mcp). Tool names have evolved organically, resulting in inconsistent naming: some tools have phase prefixes (e.g., `phase4a_question_detection`), others use domain prefixes (e.g., `assessment_start`), and some have no prefix (e.g., `explore_directory`). This makes it difficult to understand which phase a tool belongs to and creates cognitive overhead when using Claude Desktop.

---

## Decision Drivers

* **Clarity:** Users need to immediately understand which phase a tool belongs to
* **Consistency:** All tools should follow the same naming convention
* **Discoverability:** Phase-based sorting in Claude Desktop tool list
* **Maintainability:** Clear mapping between file names and tool names

---

## Considered Options

### Option 1: Tool Names Only (No File Renames)

**Description:**
Update only the tool name strings in the MCP server registration, keeping original file names.

**Pros:**
- Minimal file changes
- No risk of breaking imports

**Cons:**
- Mismatch between file names and tool names
- Harder to navigate codebase
- Future developers confused by inconsistency

---

### Option 2: Full Standardization (Tool Names + File Names)

**Description:**
Rename both tool names and source files to follow `phase{N}_{short_name}` pattern.

**Pros:**
- Complete consistency between files and tools
- Easy to navigate codebase
- Clear phase ownership of each file
- Git history preserved with `git mv`

**Cons:**
- More changes required
- Breaking change for existing workflows
- Requires import updates across files

---

## Decision Outcome

**Chosen Option:** Option 2 - Full Standardization

### Rationale

The benefits of full consistency outweigh the one-time migration cost. With `git mv`, file history is preserved, and the improved developer experience justifies the effort. The assessment pipeline is still in active development, making this an ideal time for the change.

---

## Naming Convention

### Phase-Specific Tools
**Pattern:** `phase{N}_{short_name}` or `phase{N}{letter}_{short_name}`

Tools that belong to a specific phase in the assessment pipeline.

### Cross-Phase Tools
**Pattern:** `{domain}_{action}` (no prefix)

Tools used across multiple phases. The absence of a phase prefix indicates cross-phase usage.

---

### Complete Renaming Map

#### Phase-Specific Tools

| Phase | Old Tool Name | New Tool Name | Package |
|-------|---------------|---------------|---------|
| 1 | `explore_directory` | `phase1_explore` | pre-assessment-mcp |
| 1 | `setup_project` | `phase1_setup` | pre-assessment-mcp |
| 2 | `phase2_convert_to_markdown` | `phase2_convert` | pre-assessment-mcp |
| 4A | `phase4a_question_detection` | `phase4a_questions` | assessment-mcp |
| 4B | `phase4b_rubric_validation` | `phase4b_rubric` | assessment-mcp |
| 4C | `phase4c_student_report` | `phase4c_report` | assessment-mcp |
| 4D | `phase4d_answer_boundaries` | `phase4d_boundaries` | assessment-mcp |
| 5 | `phase5_create_qfiles` | `phase5_qfiles` | pre-assessment-mcp |
| 6 | `assessment_start` | `phase6_start` | assessment-mcp |
| 6 | `assessment_read_next` | `phase6_read_next` | assessment-mcp |
| 6 | `assessment_write` | `phase6_write` | assessment-mcp |
| 6 | `assessment_write_free` | `phase6_write_free` | assessment-mcp |
| 6 | `assessment_status` | `phase6_status` | assessment-mcp |
| 6 | `assessment_get` | `phase6_get` | assessment-mcp |
| 7 | `insights_save` | `phase7_insights` | assessment-mcp |

#### Cross-Phase Tools

| Domain | Tool Name | Usage | Package |
|--------|-----------|-------|---------|
| rubric | `rubric_read` | Read rubric content (Phase 4B, 6) | assessment-mcp |
| rubric | `rubric_edit` | Edit rubric aspects (Phase 4B, 6) | assessment-mcp |
| json | `json_write` | Write JSON to filesystem (any phase) | assessment-mcp |

#### System Tools

| Tool Name | Purpose | Package |
|-----------|---------|---------|
| `init` | Initialize/reset server state | assessment-mcp |

---

## Consequences

### Positive Consequences

* Clear phase ownership visible in Claude Desktop tool list
* Easy navigation: file name = tool name
* Consistent pattern for future tools (Phase 3, Phase 8, etc.)
* Improved onboarding for new developers

### Negative Consequences

* Breaking change for existing workflows and saved prompts
* One-time migration effort across two packages
* Methodology documentation needs updates

### Mitigation Strategies

* Provide migration guide in CHANGELOG
* Use feature branch for implementation
* Update all methodology files before merge
* Clear documentation of old → new mapping

---

## Validation

1. TypeScript build succeeds (`npm run build`)
2. All tools appear in Claude Desktop with new names
3. Test one tool from each phase: phase1_setup, phase2_convert, phase4a_questions, phase5_qfiles, phase6_start, phase7_insights

---

## Related Decisions

* [ADR-001: Hybrid Python-TypeScript Architecture](ADR-001-hybrid-python-typescript-architecture.md)

---

## Implementation Notes

### Files to Rename

**pre-assessment-mcp (4 files):**
```
explore_directory.py → phase1_explore.py
setup_project.py → phase1_setup.py
convert_to_markdown.py → phase2_convert.py
phase5_create_qfiles.py → phase5_qfiles.py
```

**assessment-mcp (14 files):**
```
# Phase-specific tools
phase4a_question_detection.ts → phase4a_questions.ts
phase4b_rubric_validation.ts → phase4b_rubric.ts
phase4c_student_report.ts → phase4c_report.ts
phase4d_answer_boundaries.ts → phase4d_boundaries.ts
assessment_start.ts → phase6_start.ts
assessment_read_next.ts → phase6_read_next.ts
assessment_write.ts → phase6_write.ts
assessment_write_free.ts → phase6_write_free.ts
assessment_status.ts → phase6_status.ts
assessment_get.ts → phase6_get.ts
insights_save.ts → phase7_insights.ts

# Cross-phase tools (domain-based, no prefix)
rubric_read.ts → rubric_read.ts (unchanged)
rubric_edit.ts (new)
write_json_file.ts → json_write.ts
```

---

## References

* [ROADMAP.md](../../ROADMAP.md) - Phase definitions

---

**Status:** Accepted (Updated)
**Last Updated:** 2026-01-01
**Next Review:** When Phase 3 or Phase 8 is implemented

### Revision History
- **2025-12-31:** Initial adoption - phase-prefixed naming
- **2026-01-01:** Added cross-phase tools (domain-based naming without prefix)
