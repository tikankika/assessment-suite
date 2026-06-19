# Assessment Data MCP (Python)

> Python MCP server for file processing and PDF conversion

**Version:** 0.8.0
**Status:** Production Ready
**License:** PolyForm Noncommercial 1.0.0

---

## Overview

Assessment Data MCP handles file operations and document processing:

- **Phase 1 (Setup):** Auto-discover exam files, create project structure
- **Phase 2 (Conversion):** PDF to Markdown conversion
- **Phase 5 (Extraction):** Extract student answers to Q-files
- **Phase 7-8 (Reports):** Generate student reports and quantitative analysis

**9 MCP tools** for file operations, PDF processing, and report generation.

---

## Quick Install

```bash
cd packages/assessment-data-mcp
pip install -e .
```

### Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "assessment-data": {
      "command": "python3",
      "args": ["-m", "assessment_data_mcp.server"],
      "cwd": "/ABSOLUTE/PATH/TO/assessment-suite/packages/assessment-data-mcp"
    }
  }
}
```

---

## Tools

| Tool | Phase | Purpose |
|------|-------|---------|
| `explore_directory` | 1 | Auto-detect exam, rubric, student files |
| `setup_project` | 1 | Create standardised folder structure |
| `convert_to_markdown` | 2 | Convert PDF to Markdown |
| `create_qfiles` | 5 | Extract answers to Q-files |
| `generate_student_report_preview` | 7 | Preview student report |
| `generate_student_report` | 7 | Generate final student report |
| `quantitative_summary` | 8 | Generate class statistics |
| `list_project_files` | Utility | List files in project |
| `inspect_file` | Utility | Read file contents |

---

## Key Principles

- **AI proposes, teacher decides** - No automatic actions without confirmation
- **Standardised structure** - Consistent folder organisation
- **Swedish education focus** - Optimised for Swedish exam formats
- **Inspera support** - Handles Inspera-exported PDFs

---

## Folder Structure Created

```
project_root/
├── 01_original/           # Source PDFs
├── 02_markdown/           # Converted text
├── 03_analysis/           # Exam analysis
├── 04_student_answers/    # Per-student files
├── 05_q_files/            # Per-question files
├── 06_analytic_assessment/# Assessments
├── 07_reports/            # Student reports
└── exam_config.yaml       # Project configuration
```

---

## Documentation

- **[MCP Server Spec](docs/MCP_SERVER_SPEC.md)** - Technical specification
- **[Main Project](../../README.md)** - Assessment Suite overview

---

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Type checking
mypy src/
```

---

## Related

- **[Assessment MCP](../assessment-mcp/)** - TypeScript server for assessment
- **[Workflow Guide](../../docs/WORKFLOW-INTEGRATION.md)** - Complete pipeline

---

**Last updated:** 2026-01-25
