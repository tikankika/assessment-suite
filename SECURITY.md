# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.5.x   | Yes       |
| < 0.5   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Use [GitHub's private vulnerability reporting](https://github.com/tikankika/assessment-suite/security/advisories/new).
3. Include a description of the vulnerability and steps to reproduce.

You can expect an initial response within 72 hours.

---

## Threat Model

Assessment Suite is an AI-assisted assessment tool that runs as MCP
servers inside Claude Desktop. Understanding what this means for
data flow is essential before deploying it with real student data.

### What Assessment Suite is

- A set of MCP tools (TypeScript and Python) that organise
  assessment workflow into discrete phases.
- A methodology library that scaffolds teacher reflection during
  assessment.
- A locally-run pipeline — the MCP processes execute on your
  machine, not on a remote server.

### What Assessment Suite is *not*

- It is **not a self-contained AI** — the assessment intelligence
  comes from Claude Desktop / Anthropic's API, not from
  Assessment Suite itself.
- It is **not local-only** — although the file operations are
  local, the conversation with Claude Desktop necessarily reaches
  Anthropic's servers (see "Data Flow" below).
- It is **not a substitute for regulatory due diligence** — using
  Assessment Suite with real student data requires compliance
  with the regulations listed in "Regulatory Considerations" below.

---

## Data Flow

Assessment Suite has 16 phases. They split into two categories
based on whether student data is sent to Anthropic's API:

### Phases that stay 100% local

Phase 1 (Setup), 2 (Convert), 2D (Students), 5 (Q-files),
7 (Reports), 8 (Quantitative). These run as Python scripts, do not
involve Claude Desktop, and never transmit student data.

### Phases that send student data to Anthropic

Phase 2C (Boundaries), 3 (Annotation), 6 (Assessment),
9 (Generalization), 10 (Extrapolation), 11 (Grading),
12 (Feedback), 13 (Teacher Summary), 14 (Student Feedback). These
require Claude Desktop to read and reason about student answers,
and consequently the student data is processed by Anthropic's API
under Anthropic's [usage policy](https://www.anthropic.com/policies).

**Phase 6 is the most data-intensive.** Each student × each
question = one API call. A typical 22-student × 7-question exam
produces 154 API calls containing student answers.

This is not a defect in Assessment Suite — it is what enables
the AI-assisted assessment to function. But you must understand
this before placing real student data into the pipeline.

---

## Workspace Lockdown

Assessment Suite restricts which files its MCP tools can read or
write. The mechanism:

- A `--workspace <path>` argument is required at MCP startup.
- All file operations are checked against the workspace boundary.
- Symlinks are resolved (`realpathSync` / Python equivalent) to
  prevent symlink-based escapes.
- Pre-flight checks refuse dangerous workspaces (`/`, `$HOME`,
  `/tmp`, `/Users`, `/private/*`, non-existent paths, files,
  unwritable paths) and warn on broad workspaces (`~/Documents`,
  `~/Nextcloud`).

### What workspace lockdown protects against

- Accidental writes outside the workspace by Assessment Suite's
  tools (e.g., a methodology bug that constructs a wrong path).
- Symlink-based path-traversal attacks against Assessment Suite's
  tools.
- Misconfigured workspace pointing at a system directory.

### What workspace lockdown does **not** protect against

- **Data sent to Anthropic.** Once Assessment Suite reads a file
  and Claude Desktop sees its content, that content is part of
  the conversation and goes to Anthropic's API. Workspace
  lockdown limits *which files* Assessment Suite can access. It
  does not change what happens to file content after access.
- **Claude Desktop's own file access.** The Filesystem MCP,
  drag-and-drop attachments, and `@file` mentions in Claude
  Desktop bypass Assessment Suite entirely. Workspace lockdown
  applies to Assessment Suite's MCP tools only.
- **The MCP process's own network calls.** Assessment Suite runs
  as Node.js / Python processes with your user's privileges. A
  compromised npm or pip dependency could exfiltrate data via
  HTTP. Workspace lockdown does not isolate the process from
  the network.
- **PII inside the workspace.** Workspace lockdown sees where
  files are located, not what they contain. If a file with
  personal data sits inside the workspace, that data flows
  through the MCP tools to Anthropic.
- **Intentional misconfiguration.** Pre-flight warns on
  `~/Documents` but does not refuse it. A user who chooses an
  overly broad workspace can defeat the protection.

---

## Recommendations for Users

### Before placing real student data into the pipeline

- **Anonymise first.** Remove names, personal identification
  numbers, and identifying details from student answer files
  before placing them in the workspace. Pseudonymous IDs
  (`student_042`) are preferable to initials or first names.
- **Use a dedicated workspace.** Do not use `~/Documents` or your
  general work folder. Create a workspace such as
  `~/AssessmentWork` that contains only assessment-related files.
- **Understand Anthropic's data handling.** Read Anthropic's
  [usage policy](https://www.anthropic.com/policies) and
  [privacy policy](https://www.anthropic.com/privacy). Decide
  whether you have a lawful basis to send your students' data
  to Anthropic before you do so.
- **Inform stakeholders.** If you are a teacher in a regulated
  education system, your school's data controller (in Sweden:
  *huvudmannen*) is the legal data controller — not you. Inform
  them. Conduct a Data Protection Impact Assessment (DPIA) if
  required by your jurisdiction.

### General

- Keep your MCP client (Claude Desktop) updated.
- Do not commit `.env` files or API keys to the repository.
- Store student exam data in directories covered by `.gitignore`.
- Review the `.gitignore` patterns before pushing any changes.
- Always review AI-generated assessments before sharing with
  students. Phase 11 (grade decision) in particular requires
  active teacher judgement — the system is designed to require
  it, but the responsibility is yours.

---

## Regulatory Considerations

The list below is informational, not legal advice. Compliance is
your responsibility.

### European Union

- **GDPR (Regulation 2016/679):** Assessment Suite processes
  personal data when handling student answers. Articles 5(1)(c)
  (data minimisation), 22 (automated decision-making), 35
  (DPIA), and 44–49 (third-country transfers) are particularly
  relevant. Anthropic's servers are in the United States;
  third-country-transfer safeguards apply.
- **EU AI Act (Regulation 2024/1689):** Assessment Suite falls
  under Annex III, point 3(a) — "AI systems intended to be used
  to evaluate learning outcomes". The Annex III high-risk
  classification may apply. Article 6(3) provides a possible
  exemption when the system "does not pose a significant risk"
  and "does not materially influence the outcome of decision
  making" — applicable when human review is genuine, not
  rubber-stamping. Documented assessment by the provider is
  required to claim this exemption. The full requirements
  package becomes enforceable on **2 August 2026**.

### Sweden (jurisdiction of original deployment)

- **Skollagen (Education Act) 3 kap 16§:** Grades must be set by
  a *teacher*. Assessment Suite must not set grades autonomously.
  Phase 11 produces a *suggestion*; the teacher decides.
- **OSL 23 kap (Public Access and Secrecy Act):** Student exam
  data may be subject to confidentiality — third-party
  transmission may require an explicit confidentiality
  assessment.
- **IMY (Swedish data protection authority) focus areas 2026:**
  AI in the public sector; children and youth. Assessment Suite
  intersects both.

### Other jurisdictions

If you are not in the EU/Sweden, the analogous regulations in
your jurisdiction apply. Assessment Suite's authors have not
performed compliance analyses for jurisdictions outside the EU.

---

## Known Open Issues

The following items are known limitations or unfinished work, not
defects:

- **Pseudonymisation of student IDs is weak.** Current ID format
  may be reverse-engineerable by someone familiar with the
  class. Stronger pseudonymisation is planned.
- **No DPIA template.** A DPIA template for phases 9–12 is
  planned.
- **No automated PII detection.** Anonymisation is currently a
  manual responsibility of the teacher. Microsoft Presidio
  integration is under consideration.
- **No process isolation.** Assessment Suite runs with your
  user's privileges. Process-level isolation (sandbox-exec,
  Docker) is under consideration but not implemented.
- **No EU data residency.** Anthropic's standard API processes
  in the United States. Anthropic's EU data-residency status
  is being investigated.


---

## Acknowledgements

The current security posture has been shaped by:

  (Draft).
- **`pedagogical/00_foundation.md` §3.7–3.9** — Audience
  discipline framework that prevents student-facing output from
  containing inappropriate phrasing or information about other
  students.

---

*Last updated: 2026-05-04*
