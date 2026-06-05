# Frequently Asked Questions

> Quick answers to common questions about Assessment Suite

---

## General

### What is Assessment Suite?

Assessment Suite is an AI-augmented tool for **analytical assessment** — evaluations where teacher professional judgment is essential. It helps teachers assess student exams criterion-by-criterion using a structured, dialogue-based workflow powered by [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) servers and Claude Desktop.

### How is this different from auto-grading?

Auto-grading systems score answers automatically without teacher involvement. Assessment Suite is the opposite: **the teacher makes every evaluative decision**. The AI organises student responses, proposes criterion-level analysis, and handles file management — but you verify and approve all assessments. Think of it as a structured assistant, not a replacement.

### What is "analytical assessment"?

Analytical assessment evaluates student work criterion-by-criterion rather than holistically. Instead of "this essay is a B", you assess each aspect separately (argumentation, evidence use, structure). This approach is more transparent, more reliable across teachers, and provides specific feedback for improvement. See [Getting Started](docs/GETTING_STARTED.md#what-is-analytical-assessment) for a detailed explanation.

---

## Installation

### What are the system requirements?

- **Python 3.10+** and **Node.js 18+**
- **Claude Desktop** (latest version)
- macOS, Linux, or Windows (WSL)
- 4 GB RAM minimum (8 GB recommended)

Full details in [Getting Started — Appendix A](docs/GETTING_STARTED.md#appendix-a-detailed-installation).

### How do I install Assessment Suite?

```bash
git clone https://github.com/tikankika/Assessment_suite.git
cd Assessment_suite

# Python package
cd packages/assessment-data-mcp && pip install -e .

# TypeScript package
cd ../assessment-mcp && npm install && npm run build
```

Then configure Claude Desktop with the two MCP servers. See [Getting Started — Installation](docs/GETTING_STARTED.md#installation-3-steps) for the complete walkthrough.

### My tools aren't showing up in Claude Desktop

This is the most common installation issue. Try these steps in order:

1. **Validate your config JSON** — `python3 -m json.tool claude_desktop_config.json`
2. **Check absolute paths** — Verify `dist/server.js` exists at the path in your config
3. **Rebuild TypeScript** — Run `npm run build` in `packages/assessment-mcp/`
4. **Restart Claude Desktop** — Quit completely (not just close the window), then reopen

More solutions in [Getting Started — Troubleshooting](docs/GETTING_STARTED.md#appendix-b-troubleshooting).

---

## First Assessment

### What files do I need to start?

At minimum:
- **Exam questions** (PDF or Markdown)
- **Assessment rubric** with evaluation criteria
- **Student responses** (PDFs, one per student)

Place these in a single directory and point Assessment Suite to it during Phase 1 setup.

### What are Q-files?

Q-files (question files) are created in Phase 5. Each Q-file contains **all students' answers to one question**, organised for efficient assessment. This lets you assess all students on Question 1, then Question 2, etc. — which research shows produces more consistent evaluations than assessing one student at a time.

### How long does an assessment take?

For a typical exam (15 students, 3 questions): approximately **2 hours** with Assessment Suite vs 6-8 hours manually. Setup (Phases 1-5) takes about 20 minutes. The core assessment dialogue (Phase 6) takes the bulk of the time. Reports and feedback (Phases 7-13) are largely automated.

---

## Workflow

### Do I have to use all phases?

No. The phases are **capabilities, not mandatory steps**. Common shortcuts:

- **Formative quiz:** Phase 4-5 (setup) → Phase 6 (assess) → Phase 13 (class overview)
- **Full summative exam:** All phases
- **Re-assessment:** Phase 6 only with `overwrite=true`

See the [Teacher Guide](docs/TEACHER_GUIDE.md#the-phases-capabilities-not-mandatory-steps) for typical paths.

### Can I skip phases or go back?

Yes. You can interrupt, redirect, or skip at any point. Common examples:
- Skip Phases 9-12 for low-stakes quizzes
- Go back to re-assess a specific student
- Jump directly to Phase 13 for a class overview

### What if I disagree with Claude's assessment?

Tell Claude directly — "I disagree because..." — and Claude will reconsider. You can also override: "Give this 2/3 points, not 1/3." Your judgment is always final. The AI proposes; you decide.

---

## Data & Privacy

### Where are my files stored?

Files in the workspace stay on your local machine. Assessment Suite
creates a project folder structure inside a workspace directory you
choose during Phase 1 setup. The MCP tools read and write only inside
this workspace (see [SECURITY.md](SECURITY.md) for the workspace
lockdown details).

### Is student data sent anywhere?

**Yes — to Anthropic.** Assessment Suite runs as MCP servers within
Claude Desktop. Phases that involve AI reasoning (Phase 6 assessment,
Phase 9 generalization, Phase 10 extrapolation, Phase 11 grading,
Phase 12 feedback, Phase 13 teacher summary, Phase 14 student
feedback, plus Phase 2C boundary detection and Phase 3 annotation)
require Claude Desktop to read student answers. The conversation —
including the student data shown to Claude — is processed by
Anthropic's API under their
[usage policy](https://www.anthropic.com/policies).

Phases that stay 100% local: Phase 1 (Setup), Phase 2 (Convert),
Phase 2D (Students), Phase 5 (Q-files), Phase 7 (Reports),
Phase 8 (Quantitative).

If your jurisdiction (e.g., the EU under GDPR) requires
third-country-transfer safeguards before sending personal data to
the United States, those apply here. See [SECURITY.md](SECURITY.md)
"Regulatory Considerations" for details.

### What does workspace lockdown protect against?

Workspace lockdown ensures that Assessment Suite's MCP tools cannot
read or write files outside the workspace directory you specify. It
prevents accidental file access or symlink-based path traversal by
Assessment Suite itself.

It does **not** prevent Claude Desktop from accessing your files
through other means (the Filesystem MCP, drag-and-drop, `@file`
mentions), and it does **not** change what happens to file content
once Assessment Suite has read it — that content becomes part of
the Claude Desktop conversation and is sent to Anthropic.

See [SECURITY.md](SECURITY.md) for the full threat model.

### What files should I put in the workspace?

- **Yes:** Anonymised student answers (names removed, pseudonymous
  IDs).
- **Yes:** Rubrics, course criteria, methodology documents.
- **Yes:** Assessment outputs as Assessment Suite produces them.
- **No:** Raw student files with names, personal identification
  numbers, or other directly identifying information. Anonymise
  before importing into the workspace.
- **No:** Files that should not be sent to Anthropic regardless
  of anonymisation — for example, drafts of unrelated documents,
  email archives, financial records.
- **No:** Configuration files containing API keys or other
  credentials.

### Do I need an API key?

No. Assessment Suite uses your **Claude Desktop session** via MCP —
no separate API key is required. You need a Claude Desktop
subscription, but the MCP tools work through the built-in
integration.

### Who is the data controller?

Assessment Suite does not act as a data controller. The legal data
controller is **you** — or, if you use Assessment Suite in a
regulated education context, your school's data controller. In
Sweden, that is *huvudmannen* (the municipality for public schools,
or the school operator for independent schools). You should inform
them and obtain any required permissions before using Assessment
Suite with real student data.

For more details, see [SECURITY.md](SECURITY.md).

---

## Troubleshooting

### "Module not found" error (Python)

```bash
cd packages/assessment-data-mcp
pip install -e .
pip list | grep assessment  # Should show assessment-data-mcp
```

### TypeScript build errors

```bash
cd packages/assessment-mcp
rm -rf node_modules dist package-lock.json
npm install && npm run build
```

### PDF conversion fails in Phase 2

Verify pdfplumber is installed:
```bash
python3 -c "import pdfplumber; print('OK')"
```
If not: `pip install pdfplumber`

### Claude Desktop shows errors on every message

If you see "Invalid property key" errors, you may have an outdated build. Pull the latest code and rebuild:
```bash
git pull origin main
cd packages/assessment-mcp && npm install && npm run build
```
Then restart Claude Desktop.

For additional troubleshooting, see [Getting Started — Appendix B](docs/GETTING_STARTED.md#appendix-b-troubleshooting).

---

## Contributing

### How do I report a bug?

Open an issue on [GitHub Issues](https://github.com/tikankika/Assessment_suite/issues) using the bug report template. Include your OS, Python/Node versions, and steps to reproduce.

### Where can I ask questions or discuss ideas?

Use [GitHub Discussions](https://github.com/tikankika/Assessment_suite/discussions) for questions, ideas, and experience sharing. See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

### Can I use this for my own courses?

Yes — Assessment Suite is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). It's free for any noncommercial purpose — teachers, researchers, and educational institutions. Commercial use is restricted (it is source-available, not OSI-approved open source).

---

**More documentation:**
- [Getting Started](docs/GETTING_STARTED.md) — Full installation and first assessment tutorial
- [Teacher Guide](docs/TEACHER_GUIDE.md) — How to collaborate with the AI effectively
- [Workflow Integration](docs/WORKFLOW-INTEGRATION.md) — Complete phase-by-phase reference
- [Contributing](CONTRIBUTING.md) — How to contribute to the project
- [Security Policy](SECURITY.md) — Data handling and vulnerability reporting
