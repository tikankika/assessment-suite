# Assessment Suite

> AI-assisted analytic assessment that keeps the teacher's judgement central.

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-lightgrey.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)

Assessment Suite helps teachers carry out **analytic assessment** — scoring each aspect of
each answer, with evidence and forward-looking feedback — with AI assistance, **without
handing the decision to the AI**. Claude proposes and documents; the teacher confirms or
overrides every judgement. The assessment logic lives in editable methodology documents,
not in code: the software is two [Model Context Protocol](https://modelcontextprotocol.io/)
servers that plug into Claude Desktop and act as plumbing around that methodology. It is
grounded in — and actively developing — assessment-validity and formative-feedback
research, for Swedish upper-secondary and higher education.

---

## Design idea: the methodology is the system; the tools are plumbing

Most of what Assessment Suite "knows" is not in its code. The assessment logic — what to
look at, how to interpret it, what counts as evidence, how to phrase feedback — lives in
plain-markdown **methodology documents**. The AI reads those documents and follows them;
the MCP tools only move data (read a file, write a file, track progress) and contain no
assessment logic of their own.

Three consequences follow, and they are the point of the design:

- **Transparent.** Every assessment step traces back to a written rule you can read. No
  hidden model is deciding grades — the reasoning is in the methodology and in the cited
  evidence from the student's own answer.
- **Auditable.** Because the logic is text rather than opaque code, a colleague, a
  researcher, or a reviewing authority can inspect exactly how an assessment was reached.
- **Yours to adapt.** When you set up a project, the methodology is copied into your
  project folder as editable markdown. You can read it, question it, and change it to fit
  your subject and your professional judgement — the system's "brain" is not locked away.

This is also why the teacher stays in control by construction: the AI has no independent
assessment opinion to impose. It facilitates a methodology that you own, and the teacher
decides.

---

## Who are you?

Assessment Suite serves three audiences. Pick the door that fits — they need different things.

### I'm a teacher

The tool helps you assess open-response exams aspect by aspect, with AI assistance, while
you make every decision. Claude proposes a score and a justification grounded in the
student's own words; you confirm, adjust, or reject it. The output is the kind students
rarely receive: per-aspect scoring with cited evidence, error corrections, and a concrete
"next step" for each question.

**You do not install this yourself.** It runs on a computer set up with Claude Desktop,
Python and Node.js — that part is a technical job. Ask a developer or IT colleague to set
it up (point them at the developer door), then start here:

- [**docs/TEACHER_GUIDE.md**](docs/TEACHER_GUIDE.md) — how to work with Claude through an assessment session
- [**docs/WORKFLOW-INTEGRATION.md**](docs/WORKFLOW-INTEGRATION.md) — what each phase produces
- [**FAQ.md**](FAQ.md) — common questions

*A hosted demo and screenshots are planned but not yet available — see [ROADMAP.md](ROADMAP.md).*

### I'm a researcher (assessment, pedagogy, AI in education)

The interesting part of this project is its **methodology**, not its plumbing. The pipeline
is deliberately structured as a validity argument — separating scoring, synthesis,
extrapolation, and decision so that each inference is explicit and auditable rather than
collapsed into one opaque judgement. The methodology engages with assessment-validity work
(Kane, Moss, Messick) and formative-feedback research (Sadler, Black & Wiliam, Hattie &
Timperley, Lundahl; Hirsh for the Swedish context).

**The theoretical layer is under active development** — it is a working framework, not a
finished claim, and the methodology documents are explicit about where the grounding is
still being built. Engagement and critique are welcome.

- [**methodology/**](methodology/) — the assessment framework (start with `pedagogical/00_foundation.md`)
- [**docs/adr/**](docs/adr/) — architecture decision records, including why the phases are separated
- [**SECURITY.md**](SECURITY.md) — data-protection posture (GDPR / AI Act / third-country transfer)

### I'm a developer (or deploying this for a teacher)

You can clone, install and run Assessment Suite end-to-end in roughly ten minutes on a
recent macOS or Linux machine.

1. **Install:** [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) — clone, build the TypeScript server, install the Python server, configure Claude Desktop
2. **Try it on sample data:** [examples/](examples/README.md) — a runnable mini-project with fabricated data, no real-student files
3. **Understand the architecture:** [docs/adr/](docs/adr/) — the hybrid Python/TypeScript split, workspace lockdown, and other key choices

It is built as two MCP servers — a TypeScript server for text analysis and assessment, and
a Python server for file processing and reports.

---

## How it works

Assessment moves through numbered phases, deliberately separated so that each inference is
explicit and auditable rather than collapsed into a single judgement:

- **Phases 1–2 — Prepare:** discover the exam files and convert PDFs to markdown.
- **Phase 4 — Rubric:** design or confirm a rubric with named aspects.
- **Phase 5 — Extract:** gather each student's answers, organised per question.
- **Phase 6 — Assess:** the core step — per-aspect scoring with cited evidence and a
  concrete next step, confirmed by the teacher.
- **Phases 7–8 — Reports:** compile per-student reports and class-level quantitative summaries.
- **Phases 9–14 — Synthesis to feedback:** synthesise each student's profile, map it to the
  course criteria, and produce grade decisions and student-facing feedback.

The separation mirrors a validity argument: scoring → synthesis → extrapolation → decision,
each step warranted on its own rather than read directly off a single answer. The full
pipeline is described in [docs/WORKFLOW-INTEGRATION.md](docs/WORKFLOW-INTEGRATION.md); the
reasoning behind each phase lives in [methodology/](methodology/).

---

## Status and maturity

Assessment Suite is **alpha software for supervised use** — suitable for pilot work where a
teacher reviews every result, not for unsupervised or high-stakes grading.

- **Phases 1–8 (the core)** are the most developed: the pipeline from PDFs through
  assessment to quantitative summaries.
- **Phases 9–14 (synthesis and feedback)** are functional but **less theoretically grounded**
  than the core assessment step; their methodology is under active development.
- The **theoretical framework as a whole is a work in progress** — the methodology documents
  are explicit about where the grounding is still being built.
- It has been used in real assessment work in Swedish upper-secondary and higher education,
  always with teacher review.

Per-student / lab-report mode is **experimental and not yet supported** in this version —
use the standard per-question flow.

Versions and roadmap: see [ROADMAP.md](ROADMAP.md).

---

## Requirements

- Python 3.10+
- Node.js 18+
- Claude Desktop
- macOS, Linux, or Windows (WSL)

---

## Documentation

- [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) — installation walkthrough with a first-assessment tutorial
- [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) — full setup, troubleshooting, Claude Desktop configuration
- [docs/WORKFLOW-INTEGRATION.md](docs/WORKFLOW-INTEGRATION.md) — the assessment pipeline, phase by phase
- [docs/TEACHER_GUIDE.md](docs/TEACHER_GUIDE.md) — working with Claude through an assessment session
- [methodology/](methodology/) — the assessment framework and its theoretical grounding (under active development)
- [docs/adr/](docs/adr/) — architecture decision records
- [SECURITY.md](SECURITY.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---

## Contributing

Contributions are welcome — bug reports, documentation improvements, feature ideas, and
testing with real assessments. See [CONTRIBUTING.md](CONTRIBUTING.md). By contributing you
agree that your contributions are licensed under PolyForm Noncommercial 1.0.0.

---

## Licence

**PolyForm Noncommercial License 1.0.0** — see [LICENSE](LICENSE).

This project is **source-available, not OSI-approved open source**: free for any
noncommercial purpose, with commercial use reserved.

- Free for teachers, researchers, and educational institutions (any noncommercial purpose)
- Commercial use requires a separate licence
- See [ADR-010](docs/adr/ADR-010-licence-polyform-noncommercial.md) for why PolyForm rather than CC BY-NC-SA

---

## Acknowledgements

Built with the [Model Context Protocol](https://modelcontextprotocol.io/),
[Claude](https://www.anthropic.com/claude), and [pdfplumber](https://github.com/jsvine/pdfplumber).

The assessment methodology draws on analytic and formative-assessment scholarship — among
others Sadler, Black & Wiliam, and Hattie & Timperley — and on validity theory from Kane,
Moss, and Messick, contextualised for Swedish education by Hirsh. The theoretical grounding
is under active development.

Thanks to the teachers and colleagues who tested the workflow with real exams and provided
pedagogical feedback.

---

## Support

- Questions and bugs: [GitHub Issues](https://github.com/tikankika/assessment-suite/issues)
- Discussion: [GitHub Discussions](https://github.com/tikankika/assessment-suite/discussions)
