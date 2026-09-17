# Examples Policy

This policy answers one question permanently: what in `examples/` is real, and what is not.

## What is fabricated and what is authentic

The students are invented. Every student answer under `examples/` was written to demonstrate the workflow, not transcribed from anyone. The identifiers are synthetic, drawn from a reserved placeholder range. No real student, name, school or course participant appears in the example, in the test fixtures or in the repository's history.

The questions, the rubric and the syllabus are authentic teaching materials: an exam and a rubric written for the biology course whose Skolverket course code labels the example, and the national syllabus for that course. They contain no personal data. They are included because an assessment can only be examined against the criteria it was actually made with.

The saved assessments, reports and feedback were produced by running the workflow on the fabricated answers. They are records to inspect and critique, not model answers.

## Why the distinction matters

Assessment Suite reads student answers. Real answers come from identifiable people, and this project treats them as personal data. The repository is public, and its rule is that real student material never enters it: not in code, tests, docstrings, comments, documentation, examples or history. Anonymising real answers after the fact is not an accepted route, because anonymisation can leak; the example's answers were fabricated from the first commit.

Authentic questions and criteria are not personal data and are not covered by that rule. Stating their provenance accurately matters for another reason: a reader who assumes the criteria were invented for the example will misjudge what the saved assessments show.

## If you adapt the example

Keep the same discipline. Use invented students and synthetic identifiers, even inside a public example directory, and do not paste in real answers to test. Your own questions and rubric may be authentic; check them for names, dates and contextual details that could identify a student.

## Enforcement

The pre-push scans look for real identifiers (names, student IDs, home-directory paths, e-mail addresses) across the working tree and the git history. The data-handling conditions are in [SECURITY.md](SECURITY.md).
