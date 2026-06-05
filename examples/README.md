# Examples

This directory contains one runnable, fully worked example for Assessment
Suite, built from **fabricated data only**. A developer can clone the repo,
follow [SETUP_GUIDE](../docs/SETUP_GUIDE.md), point a workspace at the example,
and see the full pipeline work end-to-end without any real-student data.

---

## The example

[`biog2000x_immunforsvaret/`](biog2000x_immunforsvaret/) — a complete run of the
pipeline on a fabricated biology exam (course code `BIOG2000X`, *Biologi 2*):
the immune-system exam *Immunförsvaret*. It is not just input files. Every phase
output (01→14), the readable assessment dialogue, and the full execution trace
are kept, so you can study the whole process or re-run it yourself.

Start with [`biog2000x_immunforsvaret/README.md`](biog2000x_immunforsvaret/README.md)
for the full walkthrough — it explains the example from three angles (teacher,
researcher, developer) and lists every folder in the run.

### The exam

18 questions in three parts, marked against an aspect-level rubric (65 points in
total):

- **Del A — Faktafrågor** (A1–A9): nine short factual questions, 15p
- **Del B — Förklara och beskriva** (B1–B6): six explain-and-describe questions, 20p
- **Del C — Fördjupning** (C1–C3): three extended-answer questions, 30p

The questions, rubric and syllabus are reused authentic Swedish teaching
material (kept in Swedish as source text). The rubric also carries a
misconception register (*missuppfattningsregister*) that the assessment checks
each answer against.

### The four students

The four fabricated students (`10001`–`10004`) were calibrated so that a raw
point total is *not* enough to understand a student — which is the whole reason
the method reads aspect by aspect rather than summing:

- **10001** — strong, with the strength sitting in the Del C extended answers.
- **10002** — middling; solid recall on the short questions, thin on the essays.
- **10003** — weak; blanks and deliberate misconceptions that exercise the
  rubric's misconception flags.
- **10004** — uneven; near-complete essays alongside blank answers on easy
  questions, so the total lands near 10002 but the profile is the opposite.

---

## Running the example

### 1. Set up Assessment Suite

Follow [docs/SETUP_GUIDE.md](../docs/SETUP_GUIDE.md). You will end up with:

- The two MCP servers built (`packages/assessment-mcp/dist/server.js` exists,
  `assessment_data_mcp` importable in Python)
- Claude Desktop configured to talk to both servers, pointed at a workspace
  directory you choose

### 2. Copy the input layer into your workspace

```bash
# Replace /path/to/assessment_workspace with the workspace you set in
# claude_desktop_config.json
cp -r examples/biog2000x_immunforsvaret/immune_system_exam/01_original \
  /path/to/assessment_workspace/immune_system_exam/
```

`01_original/` holds the exam questions, the rubric, the syllabus and the four
students' answers — everything the pipeline needs as its starting input. The
later phase folders are created as you run.

### 3. Walk through the pipeline in Claude Desktop

Restart Claude Desktop so it picks up the new files, then ask Claude to explore
and set up an assessment project at your new `immune_system_exam/` directory.
Claude steps through the phases using the MCP tools — it proposes, you decide.
If anything looks off, compare your run against the finished artefacts already
present under
[`biog2000x_immunforsvaret/immune_system_exam/`](biog2000x_immunforsvaret/immune_system_exam/);
refer to [WORKFLOW-INTEGRATION.md](../docs/WORKFLOW-INTEGRATION.md) for the full
phase guide.

---

## Why fabricated data

This example was designed so the data-protection rule
([`.claude/rules/data-protection.md`](../.claude/rules/data-protection.md)) holds
without exception: no real names, no real student answers, and only a realistic
course-code *label*. If you adapt the example for your own training material,
keep the same discipline — even in a public example directory.
