# Assessment Workflow Guide

Complete pipeline from raw exam files to student feedback.

---

## Pipeline Overview

```
Phase 1-2: Setup & Convert  ──→  Phase 4: Analyse  ──→  Phase 5: Extract
     (Python)                      (TypeScript)          (Python)
                                                            ↓
Phase 9-13: Feedback  ←──  Phase 7-8: Reports  ←──  Phase 6-post  ←──  Phase 6: Assess
   (TypeScript)               (Python)            (TypeScript)        (TypeScript)
```

**Note:** Phase 6-post (format detection) is REQUIRED between Phase 6 and Phase 7.

**Architecture:** Hybrid Python/TypeScript - see [ADR-001](adr/ADR-001-hybrid-python-typescript-architecture.md)

---

## Phase Summary

| Phase | MCP Server | Tools | Purpose |
|-------|------------|-------|---------|
| **1** | Python | `scan_source_directory`, `initialize_project` | Discover files, create structure |
| **2** | Python | `convert_documents` | PDF → Markdown |
| **4** | TypeScript | `phase4a_questions`, `phase4b_rubric`, `phase4c_report`, `phase4d_boundaries`, `phase4e_students` | Detect questions, validate rubric |
| **5** | Python | `extract_student_answers` | Create Q-files per question |
| **6** | TypeScript | `phase6_start`, `phase6_read_next`, `phase6_write`, `phase6_status` | Assess each student |
| **6-post** | TypeScript | `phase6_post_format` | **REQUIRED:** Detect assessment format before reports |
| **7** | Python | `generate_reports` | Create student reports |
| **8** | Python | `quantitative_summary` | Statistics and summaries |
| **9-12** | TypeScript | `phase9-12_start/continue/complete` | Per-student feedback generation |
| **13** | TypeScript | `phase13_start/continue/complete` | Class-level teacher summary |

---

## Folder Structure

After Phase 2 setup:

```
project_name/
├── 01_original/              # Source files (immutable)
│   ├── exam.pdf
│   ├── rubric.md
│   └── student_answers/
├── 02_markdown/              # Converted text
│   ├── exam_questions.md
│   └── student_answers/
├── 05_answers_by_question/   # Q-files (Phase 5)
├── 06_analytic_assessment/   # Working copies (Phase 6)
├── 07_analytic_student/      # Student reports (Phase 7)
├── 08_quantitative/          # Statistics (Phase 8)
├── 09_qualitative/           # Generalizations (Phase 9)
├── 10_extrapolation/         # ILO mapping (Phase 10)
├── 11_grading/               # Grade decisions (Phase 11)
├── 12_feedback/              # Student feedback (Phase 12)
├── 13_teacher_summary/       # Class summary (Phase 13)
├── complete_assessment/      # Progressive student files
├── exam_config.yaml          # Question config (Phase 4)
├── project_state.json        # Workflow state
└── sources.yaml              # File references
```

---

## Quick Start Workflow

### 1. Setup (Python MCP)

```
User: "I have exam files in /path/to/exam/"

Claude: [Calls scan_source_directory]
        "Found exam PDF, rubric, and 30 student PDFs."

        [Calls initialize_project]
        "Project created with standard folder structure."

        [Calls convert_documents]
        "Converted all PDFs to markdown."
```

### 2. Analysis (TypeScript MCP)

```
User: "Analyse the exam structure"

Claude: [Calls phase4a_questions]
        "Detected 8 questions with point values."

        [Calls phase4b_rubric]
        "Rubric validated and mapped to questions."
```

### 3. Extraction (Python MCP)

```
User: "Create Q-files"

Claude: [Calls extract_student_answers]
        "Created 8 Q-files with all student answers grouped by question."
```

### 4. Assessment (TypeScript MCP)

```
User: "Start assessing Q1"

Claude: [Calls phase6_start]
        "Session initialized. First student: 100001"

        [Calls phase6_read_next]
        [Shows answer + rubric]

        [After discussion, calls phase6_write]
        "Assessment saved. Next student..."
```

### 5. Format Detection (TypeScript MCP) - REQUIRED

```
User: "Detect assessment format"

Claude: [Calls phase6_post_format]
        "Format detected: aspect-based with 4 aspects per question.
         Configuration saved to exam_config.yaml"
```

**Note:** This step is REQUIRED before Phase 7. It analyses Q-files to detect the assessment format used, enabling accurate point extraction in report generation.

### 6. Reports & Feedback (Python + TypeScript)

```
User: "Generate reports"

Claude: [Calls generate_reports]
        "Created reports for 30 students."

        [Calls quantitative_summary]
        "Statistics calculated and appended."

User: "Generate feedback for student TestElev10"

Claude: [Calls phase9_start through phase12_complete]
        "Complete feedback generated."
```

---

## Supporting Tools

These can be used at any point during assessment:

| Tool | Purpose |
|------|---------|
| `reflect_insights` | Save pedagogical observations |
| `reflect_uncertainty` | Flag borderline cases for review |
| `reflect_aspect_analysis` | Per-aspect statistics |
| `rubric_read` | Read rubric content |
| `rubric_edit` | Edit rubric with audit trail |
| `project_status` | Check project progress |
| `project_repair` | Fix path issues for sharing |

---

## Handoff Points

The pipeline uses two MCP servers that hand off work:

1. **Python → TypeScript** (after Phase 2): Markdown files ready for analysis
2. **TypeScript → Python** (after Phase 4): exam_config.yaml for extraction
3. **Python → TypeScript** (after Phase 5): Q-files ready for assessment
4. **TypeScript → Python** (after Phase 6-post): Assessed Q-files + format config for reports
5. **Python → TypeScript** (after Phase 8): Data ready for feedback generation

**Important:** Phase 6-post (format detection) must complete before Phase 7 begins.

Both servers run simultaneously in Claude Desktop - switching is automatic.

---

## References

- **[Getting Started](GETTING_STARTED.md)** - Installation and tutorial
- **[API Reference](../packages/assessment-mcp/docs/API.md)** - Tool documentation
- **[ADR-001](adr/ADR-001-hybrid-python-typescript-architecture.md)** - Architecture rationale

---

**Last updated:** 2026-01-25
