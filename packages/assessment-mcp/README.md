# Assessment MCP (TypeScript)

> MCP server for AI-assisted educational assessment workflows

**Version:** 0.8.0
**Status:** Production Ready
**License:** PolyForm Noncommercial 1.0.0

---

## Overview

Assessment MCP provides TypeScript-based tools for exam analysis and student assessment:

- **Phase 4 (Exam Analysis):** Question detection, rubric validation, boundary detection
- **Phase 6 (Assessment):** Structured assessment with teacher verification
- **Phases 9-13 (Feedback):** Dialogue-based student feedback generation

**~35 MCP tools** for text parsing, assessment logic, and pedagogical analysis.

---

## Quick Install

```bash
cd packages/assessment-mcp
npm install && npm run build
```

### Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "assessment": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/assessment-suite/packages/assessment-mcp/dist/server.js"]
    }
  }
}
```

---

## Key Principles

- **Teacher authority is paramount** - All assessments require explicit teacher confirmation
- **File handler, not assessment tool** - MCP handles reads/writes, Claude proposes assessments
- **Persistent progress tracking** - YAML STATUS survives session restarts
- **Consistent output format** - Standardised BEDÖMNING sections for all students

---

## Tool Categories

### Phase 4: Exam Analysis (LOAD/SAVE pattern)
| Tool | Purpose |
|------|---------|
| `phase4a_question_detection` | Extract questions from exam |
| `phase4b_rubric_validation` | Validate rubric structure |
| `phase4c_completion_report` | Generate analysis report |
| `phase4d_boundary_detection` | Detect answer boundaries |
| `phase4e_student_discovery` | Identify students in files |

### Phase 6: Assessment
| Tool | Purpose |
|------|---------|
| `assessment_start` | Initialize assessment session |
| `assessment_read_next` | Read next unassessed student |
| `assessment_write` | Write structured assessment |
| `assessment_write_free` | Write free-text assessment |
| `assessment_status` | Show progress statistics |

### Phases 9-13: Student Feedback (Start/Continue/Complete pattern)
| Phase | Purpose |
|-------|---------|
| Phase 9 | Dialogue-based generalization |
| Phase 10 | Criteria mapping |
| Phase 11 | Grading decisions |
| Phase 12 | Formative feedback draft |
| Phase 13 | Teacher summary |

### Utility Tools
| Tool | Purpose |
|------|---------|
| `rubric_read` | Read rubric file |
| `rubric_edit` | Edit rubric content |
| `project_status` | Show project state |
| `project_repair` | Fix project issues |

---

## Documentation

- **[API Reference](docs/API.md)** - Complete tool documentation
- **[User Guide](docs/USER_GUIDE.md)** - End-to-end workflows
- **[Main Project](../../README.md)** - Assessment Suite overview

---

## Development

```bash
npm run watch    # Development mode
npm run build    # Production build
npm start        # Run server
```

---

## Related

- **[Assessment Data MCP](../assessment-data-mcp/)** - Python server for file processing
- **[Workflow Guide](../../docs/WORKFLOW-INTEGRATION.md)** - Complete pipeline

---

**Last updated:** 2026-01-25
