# Assessment Suite 0.8.0: example materials

The repository contains a worked example based on the Swedish biology assessment *Immunförsvaret* (the immune system). It combines authentic questions, a rubric and a syllabus with answers written for four invented students. You can inspect the saved assessments directly, or copy the inputs into a separate workspace to begin a new assessment.

The example is material for examining how an answer is assessed and how that assessment appears in later records. Its saved judgements are open to critique.

## What the example contains

The [source materials](biog2000x_immunforsvaret/immune_system_exam/01_original) are in Swedish. They contain 18 questions worth 65 points, an aspect-based rubric, a biology syllabus and four sets of fabricated student answers. The answer files use synthetic identifiers beginning `10001` through `10004`. All seven input files are Markdown, so this example exercises file preparation without testing PDF extraction.

The [saved project](biog2000x_immunforsvaret/immune_system_exam/) includes answers grouped by question, assessed question files, student reports, numerical summaries, interpretations and feedback. Its [assessment-purpose record](biog2000x_immunforsvaret/immune_system_exam/assessment_purpose.md) sets Phase 11, grading, to `off`. There is no grading output to reproduce.

The [assessment dialogue](biog2000x_immunforsvaret/assessment_dialogue.md) and [detailed log](biog2000x_immunforsvaret/assessment_dialogue_full_log.md) provide additional records of the earlier run. They help explain the saved work; use the current workflow guide for tool names and operating instructions.

## Follow one answer through the saved records

Start with question 17 and the invented student whose full identifier is `10004_100000000_example`. The source labels this question `Q017A`, the rubric calls it `C2`, and the prepared question files use `Q017`. Its topic is the immune response to a wound.

| Open | What to examine |
|---|---|
| [Questions](biog2000x_immunforsvaret/immune_system_exam/01_original/exam_questions.md) and [rubric](biog2000x_immunforsvaret/immune_system_exam/01_original/rubric.md) | Find `Q017A` and rubric section `C2`. Read the task and the seven aspects against which the answer will be assessed. |
| [The fourth invented student's original answers](biog2000x_immunforsvaret/immune_system_exam/01_original/student_answers/10004_100000000_example.md) | Find the answer to question 17 and read it as a whole. |
| [Question 17: extracted answers](biog2000x_immunforsvaret/immune_system_exam/05_answers_by_question/Q017_alla_elever.md) | Find the same identifier. Check what was carried into the question file, where all four students' answers are brought together. |
| [Question 17: saved assessments](biog2000x_immunforsvaret/immune_system_exam/06_analytic_assessment/Q017_alla_elever.md) | Examine the points and reasons for each rubric aspect. Check whether the cited passages support the judgement and whether the next-step comment follows from it. |
| [The fourth invented student's analytic report](biog2000x_immunforsvaret/immune_system_exam/07_analytic_student/Analytic_10004_100000000_example.md) | Find `Fråga Q017` and compare it with the saved question assessment. Then look at the other questions and the numerical overview. |

The saved report awards this student 12 of 12 points on question 17 and 0 of 1 on question 1. Read the answers and reasons behind those figures before interpreting the total. The example lets you examine such differences without treating a numerical summary as a complete account of an answer.

## Prepare a separate trial

Use a dedicated workspace outside the source repository. For installation and AI-application configuration, see the [setup guide](../docs/SETUP_GUIDE.md). Both servers need access to the same assessment workspace for the subsequent workflow. Review the [data-handling conditions](../SECURITY.md) before supplying additional material.

Copy the contents of the example's `01_original/` directory into a new folder called `example-inputs` inside that workspace. Keep the `student_answers` subfolder. Leave the saved assessments and configuration in the repository as reference material.

The copied inputs should be:

```text
example-inputs/
  exam_questions.md
  rubric.md
  Amnesplan_Biologi_GY25.md
  student_answers/
    10001_100000000_example.md
    10002_100000000_example.md
    10003_100000000_example.md
    10004_100000000_example.md
```

Ask the AI application to call `scan_source_directory` on the absolute path to `example-inputs`. The scan may return incomplete suggestions. Supply the following mapping when it calls `initialize_project`; each file or folder path must be absolute.

| Argument | Value |
|---|---|
| `exam_path` | `example-inputs/exam_questions.md` inside your workspace |
| `rubric_path` | `example-inputs/rubric.md` |
| `syllabus_source` | `example-inputs/Amnesplan_Biologi_GY25.md` |
| `student_answers_path` | `example-inputs/student_answers` |
| `output_base_path` | Your workspace directory |
| `project_name` | `immune-system-trial`, provided that name is unused |

For the standard methodology, leave the optional `methodology_folder` argument unset. Setup uses the configured or default methodology; it can also reuse a methodology folder in the parent directory. Check the methodology location reported by setup so you know which instructions the trial will use.

Next, call `convert_documents` with the new project's `01_original` directory as `input_dir` and its `02_markdown` directory as `output_dir`. The tool copies these Markdown files. There are no PDFs to extract.

Before proceeding, check that:

- The new project contains `sources.yaml` and `project_state.json`.
- Both `01_original` and `02_markdown` contain the three source documents and four answer files.
- The prepared files preserve the supplied text, including the answer boundaries and identifiers.

This is the first checkpoint: a separate project with prepared materials.

## Continue into assessment

Follow the [workflow guide](../docs/WORKFLOW-INTEGRATION.md) to establish the questions, answer boundaries and student identifiers; prepare and check the annotated material; review the rubric; and extract the question files.

For a first assessment, work through one question across the four invented students. Examine each proposal against the answer and rubric before submitting it to be saved. Compare the resulting records with the supplied example and investigate differences. A new run involves new proposals and decisions; the saved example does not prescribe their wording or points.

Before generating student reports, establish the assessment format through the workflow's `phase6_post_format` step, or check that an existing format configuration is suitable. After generation, inspect the questions, assessments and totals in each report before using it for later interpretation or feedback.

## Verification status

On 17 September 2026, the preparation route was run through the Python server's MCP interface at revision `112af99`, using Python 3.11.14 on macOS. Scanning, project initialisation and document preparation completed. The seven inputs matched their copies in both project directories byte for byte, and setup supplied 22 methodology documents.

That check used an existing development environment. It did not test a clean installation, a named AI application's handling of the conversation, PDF extraction, or a fresh assessment through the later stages. The saved example provides records to inspect; a complete rerun with the current software remains to be verified.

If you extend the example or share a reproduction of a problem, use fabricated student answers and synthetic identifiers. Keep real student material outside the repository.
