# Changelog

All notable changes to Assessment Suite are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/).

The version tracks the maturity of the assessment **methodology**, not just the code
(see [ADR-012](docs/decisions/ADR-012-versioning-and-1.0-readiness.md)); the project stays in
its 0.x line until the methodology is complete.

## [Unreleased]

### Added

- This changelog.
- **README — a plain-language "What is Assessment Suite?" opening, a "Data & privacy" section, and a Support section.** The data section is explicit that file operations are local but the AI-assisted phases send student answers to Anthropic's API.

### Changed

- **CODE_OF_CONDUCT — adopted the family-standard Contributor Covenant 2.1 text** (replacing the locally adapted wording).
- **LICENSE — restored to the verbatim PolyForm Noncommercial 1.0.0 text**; the body is now byte-identical to the sibling repositories.
- **CONTRIBUTING — a prominent "data protection" section** (never commit real PII; use fabricated data; watch quasi-identifiers; scrub history if something real lands), plus sentence-case headings and a standardised licence line.
- **SECURITY — headings, supported-versions table and response-time aligned with the family standard.**

### Fixed

- Documentation corrections: the SECURITY "Supported Versions" table (now 0.8.x), a
  stale setup path in CONTRIBUTING (`assessment-suite`), and a broken Acknowledgements
  section in SECURITY.

## [0.8.0] - 2026-06-05

Initial public release.

- AI-assisted **analytic assessment** as two MCP servers (a TypeScript server for text
  analysis and assessment, a Python server for file processing and reports) for use with
  Claude Desktop. The assessment logic lives in editable **methodology documents**, not
  in code — transparent, auditable, and yours to adapt.
- **Core pipeline (Phases 1–8):** discover and convert exam PDFs, design or confirm a
  rubric with named aspects, extract per-question answers, per-aspect assessment with
  cited evidence and a concrete next step, per-student reports, and class-level
  quantitative summaries.
- **Synthesis and feedback (Phases 9–14):** per-student synthesis, mapping to course
  criteria, grade decisions, and student-facing feedback — functional and always used
  with teacher review; methodology under active development.
- **Workspace-locked file operations** (the `--workspace` boundary) and a documented
  data-protection posture (GDPR / EU AI Act / Swedish *Skollagen* and OSL); see
  [SECURITY.md](SECURITY.md).
- Licensed **PolyForm Noncommercial 1.0.0** (see
  [ADR-010](docs/decisions/ADR-010-licence-polyform-noncommercial.md)).

Versions before 0.8.0 were pre-public development and are not catalogued here.

[Unreleased]: https://github.com/tikankika/assessment-suite/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/tikankika/assessment-suite/releases/tag/v0.8.0
