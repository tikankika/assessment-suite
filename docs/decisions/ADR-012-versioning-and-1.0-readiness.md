# ADR-012: Versioning policy and 1.0.0 readiness criteria

**Status:** Accepted
**Date:** 2026-06-05
**Deciders:** Niklas Karlsson, Claude
**Technical Story:** Decide what the version number communicates, and define the explicit, methodology-grounded conditions that must hold before the project is released as 1.0.0.

---

## Context and Problem Statement

Assessment Suite is published (privately, pending a public flip) at version **0.8.0**. The
question arose naturally at this bump: *should this be 1.0.0?* The code is working,
tested, PII-clean and proven on a real exam — so a "1.0" framing is tempting.

But the suite is not a body of code first and a methodology second. It is the reverse: the
**methodology is the system**, the code is plumbing (see `.claude/rules/code-as-plumber.md`).
A version number for this project therefore has to communicate the maturity of the
*method*, not merely that the parsers run. And the method is not yet complete:

- **Synthesis and feedback (Phases 9–14)** are functional but not finished.
- The **analytical-assessment methodology** — the validity-argument and formative-feedback
  grounding at the heart of the tool — needs to be deepened.
- The methodology for **rubric construction** has not been started.

Releasing "1.0.0" while these are open would over-claim stability of the thing that matters
most. The problem this ADR settles: *what does the version number mean here, and what
specifically gates 1.0.0?*

---

## Decision Drivers

* **The version must track the methodology, not just the code.** The method is the system.
* **Honesty over optics.** 1.0.0 implies a stable, complete method; we should not signal that
  before it is true.
* **A durable record of "why pre-1.0".** The reason must not live only in the author's head;
  it should survive context loss and be visible to users.
* **A clear, checkable gate.** "When is it 1.0?" should have a concrete answer, not a feeling.
* **Room to iterate in 0.x.** Until 1.0.0, minor/patch bumps continue freely as the method and
  code mature.

---

## Considered Options

### Option 1: Release as 1.0.0 now

**Pros:**
- ✅ Signals confidence; simpler story for a first public release.

**Cons:**
- ❌ Over-claims completeness of the methodology, which is the project's substance.
- ❌ Semantically implies API/method stability we are not ready to commit to (RFC-038/039
  cleanup and methodology work are still ahead).

### Option 2: Stay in 0.x with no defined 1.0 criteria

**Pros:**
- ✅ Honest about maturity.

**Cons:**
- ❌ "When is it 1.0?" stays vague; the gate lives only in the author's head and erodes.

### Option 3: Stay in 0.x with explicit, methodology-grounded 1.0.0 criteria (**CHOSEN**)

**Description:** Adopt semantic versioning where **0.x means the methodology is still being
completed**, and define the specific methodology milestones that must be met before 1.0.0.

**Pros:**
- ✅ The version honestly tracks the method's maturity.
- ✅ "When is it 1.0?" has a concrete, checkable answer.
- ✅ The reason for pre-1.0 status is recorded durably and shown publicly (ROADMAP).

**Cons:**
- ❌ A "0.x" badge reads as less mature to a casual observer — acceptable; it is accurate.

---

## Decision

Adopt **semantic versioning** for Assessment Suite, with this project-specific reading:

- **0.x** — the methodology is still being completed. Minor and patch bumps continue freely as
  the method and code mature. Current line.
- **1.0.0** — released only once the methodology is complete enough to stand on its own. The
  gate is the three criteria below.

**1.0.0 readiness criteria (all must hold):**

1. **Phases 9–14 (synthesis and feedback) methodology complete** — to parity with the
   Phase 1–8 methodology, not merely functional.
2. **Analytical-assessment methodology deepened** — the validity-argument structure and the
   formative-feedback grounding documented rigorously, not provisional.
3. **Rubric-construction methodology authored** — currently not started; a documented method
   for constructing rubrics must exist (to the same standard as the other methodology files).

These are **release criteria stated as pointers**. The precise pedagogical definition of
"complete", "deepened" and "to standard" for each is methodology-authoring work (Cowork's
lane) and is intentionally not fixed in this ADR — this ADR records *that* 1.0.0 is gated on
them, not the methodology content itself.

---

## Consequences

**Positive:**
- The version number means something true about the method, not just the code.
- A new reader (or a future session) can see exactly why the project is pre-1.0 and what
  closes the gap.
- 0.x leaves room to keep shipping improvements without implying false stability.

**Negative / trade-offs:**
- A "0.x" version may read as less finished than the working, tested code actually is. This is
  accepted: the gate is the *methodology*, and that framing is the point.

**Mechanics:**
- Version bumps use `scripts/bump.sh` (single source of truth: `package.json`), which updates
  every version-bearing location across both packages.
- When the three criteria are met, a 1.0.0 bump + a superseding/closing note on this ADR
  records that the gate was cleared.

---

## Related

- [ADR-011: Publication via Fresh Repository](./ADR-011-publication-fresh-repository.md) — the publication build this versioning policy sits on top of.
- [ADR-003: Progressive Methodology Loading](./ADR-003-progressive-methodology-loading.md) — establishes that the AI reads methodology before acting (why methodology completeness is load-bearing).
- `.claude/rules/code-as-plumber.md` — "the method is the system; the code is plumbing" — the principle behind gating the version on methodology rather than code.
- `ROADMAP.md` — the public "Road to 1.0.0" section mirrors these criteria for users.
