# Worked example — biology exam (immune system)

This is a complete, end-to-end worked example of the Assessment Suite pipeline,
run on a fabricated biology exam. Its purpose is transparency: a reader can see
the **whole process** — every input, every phase output, the assessment dialogue,
and the execution trace — without any real-student data.

> **All data here is fabricated.** The four students (`10001`–`10004`) are
> invented, and their answers were written to illustrate a spread of attainment.
> The operator's name and file paths have been replaced with `Teacher` and
> `<workspace>`. The exam questions, rubric and syllabus are reused authentic
> Swedish teaching material (kept in Swedish as source text); the course code
> `BIOG2000X` is retained as a realistic label.

---

## Three ways to read this

**If you are a teacher** — start with `assessment_dialogue.md`. It is the actual
human-and-assistant conversation that produced the assessment: for each question
the assistant quotes the student's answer, applies the rubric aspect by aspect
with the symbol system (✓✓✓ / ✓✓ / ✓ / ⚠ / ✗), proposes points, and gives
forward-looking feedback — while the teacher remains the decision-maker. Then look
at `immune_system_exam/complete_assessment/` for the finished result.

**If you are a researcher** — the point of this example is that nothing is hidden.
Every phase of the pipeline (01→14) left its artefacts in `immune_system_exam/`,
the methodology that governed the run is embedded under
`immune_system_exam/methodology/`, and the full machine-level trace (every tool
call with arguments and output) is in `assessment_dialogue_full_log.md` and
`immune_system_exam/workflow_log.jsonl`. You can audit how each judgement was
reached.

**If you are a developer** — this is what a finished project directory looks like.
Use `immune_system_exam/01_original/` as the input layer and follow the setup
guide to run the pipeline yourself against a fresh workspace.

---

## The four students

The answers were calibrated so that a raw point total is *not* enough to
understand a student — which is the whole reason the method reads aspect by
aspect rather than summing:

- **10001** — strong; the strength sits in the essay questions (Q15–Q18).
- **10002** — middling; solid recall on short questions, thin on the essays.
- **10003** — weak; several blanks and deliberate misconceptions (e.g. swapped
  B-/T-cell maturation, "fever is always dangerous", "a vaccine makes you ill")
  that exercise the rubric's misconception flags.
- **10004** — uneven; near-complete essays alongside blank answers on easy
  questions. The total lands near 10002, but the profile is the opposite.

---

## What is in the folder

```
assessment_dialogue.md            Readable assessment conversation (the method in action)
assessment_dialogue_full_log.md   Complete verbose transcript (every tool call + output)
immune_system_exam/
  01_original/                    Input: exam questions, rubric, syllabus, 4 student answers
  02_markdown/                    Converted and annotated exam material
  03_material/                    Prepared assessment material
  05_answers_by_question/         Q-files: one file per question, all students together
  06_analytic_assessment/         Per-question analytic assessments
  07_analytic_student/            Per-student reports
  08_quantitative/                Quantitative summaries
  09_qualitative/                 Qualitative analysis
  10_extrapolation/               Extrapolation across the subject areas
  12_feedback/                    Feedback drafts
  13_teacher_summary/             Teacher-level summary
  14_student_feedback/            Student-facing feedback
  complete_assessment/            The finished, consolidated result
  _process_memos/                 Working notes captured during the run
  logs/, workflow_log.jsonl       Execution trace (auditability)
  methodology/                    The methodology that governed this run (22 docs)
  exam_config.yaml, sources.yaml, project_state.json, assessment_purpose.md
```

---

## Running it yourself

Follow [`docs/SETUP_GUIDE.md`](../../docs/SETUP_GUIDE.md) to build the two MCP
servers and point Claude at a workspace. Then copy
`immune_system_exam/01_original/` into your workspace as the starting input and
run the pipeline; the assistant proposes, you decide. The phases above are what
the run will reproduce.

---

*Fabricated example. Real assessment of real students must never be committed to
a public repository.*
