# Examples Policy

**All data in this repository's `examples/` directory is entirely fabricated.**

This policy exists to answer one question permanently: *are these examples real?*
They are not. Nothing under [`examples/`](examples/) — and nothing in the example
fixtures used by the test suite — is, or is derived from, a real person or a real
assessment.

## What "fabricated" guarantees

The example material contains:

- **No real students.** The students are invented. Their answers were written to
  demonstrate the pipeline, not transcribed from anyone.
- **No real names, schools, or course participants.**
- **No real student identifiers.** All IDs are synthetic and drawn from a reserved
  placeholder range.
- **No real course.** The course-code label is a realistic-*shaped* label, not a
  real course, programme, or exam that was actually sat.

The example is a single, fully worked, fabricated instance the code processes — the
canonical illustration of the method. It is the only place rich concrete content
lives; see [`.claude/rules/code-as-plumber.md`](.claude/rules/code-as-plumber.md).

## Why this matters

Assessment Suite reasons over student answers, which are personal data. The whole
project is built on a hard rule that **real student data never enters this repository**
— not in code, tests, docstrings, comments, docs, or history. See
[`.claude/rules/data-protection.md`](.claude/rules/data-protection.md) and
[SECURITY.md](SECURITY.md).

A public worked example is the obvious place that rule could be breached by accident,
so the example was fabricated from the first commit rather than anonymised after the
fact. Anonymisation can leak; fabrication cannot.

## If you adapt the example

If you reuse the example as a template for your own training material, keep the same
discipline — use invented students, synthetic IDs, and placeholder course labels,
even inside a public example directory. Do not paste in real answers "just to test".

## Enforcement

This guarantee is checked, not merely asserted. The `publish-check` scans and the
pre-push secret/PII scan look for real identifiers (names, student IDs, home-directory
paths, e-mail addresses) across the working tree and git history. See
[`.claude/rules/publish-readiness.md`](.claude/rules/publish-readiness.md).
