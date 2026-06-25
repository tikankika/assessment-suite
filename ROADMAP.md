# Roadmap

Assessment Suite is **alpha software for supervised use**. This roadmap is deliberately
high-level — priorities shift with real classroom use.

## Now

- The **core pipeline (Phases 1–8)** — from PDF exams through analytic assessment to
  quantitative summaries — is the most developed part and works end to end.
- **Synthesis and feedback (Phases 9–14)** are functional but less mature, and are always
  used with teacher review.
- It has been used in real assessment work in Swedish upper-secondary and higher education,
  with a teacher confirming every result.

## In progress

- **Strengthening the theoretical grounding.** The assessment methodology is being developed
  and documented more rigorously — the validity-argument structure and the formative-feedback
  foundations. The methodology files are explicit about where the grounding is still being built.
- **Wider testing** across subjects and courses to surface edge cases.
- **Raising test coverage.** The suite currently has automated tests covering roughly 60% of
  the code. Raising this — especially around the Phase 5/7/8 parsers — is the prerequisite for
  the code cleanup below, so that refactoring can be done safely.

## Planned (not yet available)

- A **hosted demo and screenshots**, so teachers can see the workflow without a local install.
- **Per-student / lab-report assessment mode** (currently experimental and not supported).
- **Incremental code cleanup.** The codebase grew through real classroom iteration and carries
  some duplication. A standing review has identified recurring patterns (shared parsing helpers,
  YAML handling, methodology loading) to consolidate. These will land as small, focused,
  separately-reviewable changes — not a single large rewrite — each gated on test coverage for
  the affected area.
- Exploratory: deployment helpers and integration with assessment platforms.

## Road to 1.0.0

Assessment Suite is intentionally in its **0.x** line: the version tracks the maturity of the
**methodology**, not just the code. The code works, is tested and has been used on real exams —
but in this project the method is the substance, and it is still being completed. The release
will become **1.0.0** only once all three of the following hold (see
[ADR-012](docs/decisions/ADR-012-versioning-and-1.0-readiness.md) for the full decision):

1. **Synthesis and feedback (Phases 9–14) methodology complete** — documented to the same
   standard as the Phase 1–8 methodology, not merely functional.
2. **Analytical-assessment methodology deepened** — the validity-argument structure and the
   formative-feedback grounding documented rigorously.
3. **Rubric-construction methodology authored** — a documented method for constructing rubrics,
   to the same standard as the other methodology files (not yet started).

Until then, the project continues to ship improvements as 0.x minor and patch releases.

## Following along

Questions, ideas, and bug reports are welcome via
[GitHub Issues](https://github.com/tikankika/assessment-suite/issues) and
[GitHub Discussions](https://github.com/tikankika/assessment-suite/discussions).
