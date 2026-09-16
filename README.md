# Assessment Suite

Assessment Suite is a set of tools for preparing assessment material and assessing written student answers with AI assistance. The assessment is analytic: each answer is examined against named aspects of quality in a rubric, and the teacher records a judgement, points and reasons for each aspect. The tools convert PDFs to Markdown, organise answers by question, support rubric development, produce AI assessment proposals for the teacher to examine, and save the submitted judgements with their reasons.

The work moves between two views: all answers to one question across a class, and one student's assessments across questions. Saved judgements and reasons stay readable, so the teacher can return to them when interpreting a student's work and writing feedback.

The assessment guidance is written in readable methodology documents that draw on assessment research, rather than fixed in program code. This keeps the instructions open to examination and to adaptation by teachers.

The tools are intended for teachers working with written answers, and for researchers and developers who want to inspect how AI-supported assessment is organised and implemented. Version 0.8.0 is under development; see [Development status](#development-status-and-open-questions).

## Preparing material for assessment

The starting material is a set of questions, the students' written answers and the assessment guidance for the task, typically a rubric and the relevant course criteria. Assessment Suite extracts the text from PDFs into Markdown and groups the answers by question, so that every answer to one question can be examined together.

The teacher then checks the extracted text and its grouping against the source PDFs. This is the point to catch text that extraction has dropped or garbled, and answers assigned to the wrong question, before any judgement is built on the material.

The rubric is prepared in the same stage. The teacher can bring an existing rubric or develop one with AI assistance, and in either case decides whether its aspects, quality descriptions and point allocations express what matters in the task.

## Examining answers and retaining judgements

For each answer, the assessment tools give the AI the methodology instructions, the rubric and the answer itself. The AI proposes a judgement for each aspect, with points and reasons grounded in the text of the answer, and a comment on a possible next step for the answer as a whole. The teacher examines the proposal against the answer, questions or corrects interpretations, and decides what the assessment should say before it is saved.

For example, the AI may propose that an answer names two relevant factors but does not explain how they relate. The teacher asks for the passages that support this reading, considers whether a later sentence changes it, and adjusts the judgement accordingly.

The assessment the teacher submits is saved in Markdown: a judgement, points and reasons for each aspect, and one next-step comment for the answer. The record holds the submitted assessment, not the conversation that led to it.

![Six steps run downwards: prepare materials, define criteria, gather answers, assess and discuss, bring records together, and interpret and communicate. Explanations distinguish organisation from judgement. A dashed arrow returns from compilation to an earlier assessment for review.](docs/assets/assessment-suite-information-flow.svg)

## From individual assessments to a student overview

The compilation tools bring the saved question-level assessments together into a report for each student and into numerical summaries. The report changes the view from one question across the class to one student across questions, and is the basis for considering the student's work as a whole.

From the report, the teacher can retrieve selected question-level assessments to review them in full, as the dashed arrow in the figure shows. Retrieval returns the saved records; it does not reopen the original PDFs or the conversation that preceded saving.

Later workflows ask the AI to propose interpretations across a student's answers, relate the evidence to course criteria, support a grade decision where one is required and draft feedback. Each of these is a further judgement for the teacher to examine. Compiling records and drawing conclusions from them are different activities, and not every assessment needs every later stage.

If a rubric or an earlier judgement changes, the teacher reviews the affected assessments and the reports built on them. Reports are rebuilt from the saved assessments rather than updated in place. Rebuilding an existing analytic report requires an explicit overwrite; the progressive report can be replaced, so anything a later stage has written into it needs to be preserved before the report is rebuilt.

## Design rationale

Three intentions guide the design.

The first is to inscribe as little assessment judgement as possible in program code. The guidance for rubric construction, assessment, interpretation and feedback is written in methodology documents that anyone can read and revise; the code handles data processing, workflow order and record formats. What is inscribed in code still carries assumptions: the division of an answer into aspects, the use of points, the shape of the saved record and the order of the stages. Where a methodology document cannot be loaded, some stages also fall back to guidance written in the code itself.

The second is that teachers should be able to adapt the system to their own purposes: change a rubric, rewrite an instruction, add or drop a stage. This is a form of end-user development, in which the people who use a system also take part in developing it, as Mørch, Ludvigsen and Gilje discuss in [*Teachers as End-User Developers*](https://ceur-ws.org/Vol-3978/short-s2-07.pdf). How far an edit reaches depends on where a stage looks for its instructions. The assessment stage resolves them from the assessment project itself, so an edit to the project's own methodology takes effect there. The later interpretation and feedback stages load from a shared installation directory and keep the content in memory, so an edit to a project copy does not reach them.

The third is local operation: the servers run on the teacher's own computer, and the aim is that the model can too.

## How research ideas inform the methodology

The methodology is built around analytic assessment as Jönsson (2010) describes it: each aspect of an answer is judged separately, rather than the answer as a whole, because separate judgements give the differentiated information that feedback needs. The methodology also names the known risks of this approach and assigns a countermeasure to each. Fragmentation, where the aspects obscure the whole, is met by a later synthesis stage that reads across aspects and questions. Aspect inflation, where easily measured aspects crowd out demanding ones, is met by checking the rubric's levels against the SOLO taxonomy. Mechanical application is met by an instruction to the teacher to read the whole answer before reviewing the aspect-level proposal.

Assessment is criterion-referenced in Sadler's (1989) sense: an answer is judged against the rubric's criteria, not against other students, and the judgement is written so that the student can see how the answer relates to the criteria. Sadler (2009) objects that criteria fixed in advance cannot anticipate every valid answer. The methodology's answer is generous interpretation (*snälltolkning*): when an answer is valid in a way the rubric did not foresee, the teacher gives credit and writes down the interpretation, so that the choice is visible and can be contested. Two further principles come from the same concern with transparency: every judgement cites the student's own words, and assessments describe what the answer shows rather than what the student understands.

Quality levels in [rubric design](methodology/pedagogical/phase4_rubric_design_method.md) and in the [assessment itself](methodology/pedagogical/phase6_assessment_method.md) follow the SOLO taxonomy (Biggs and Collis, 1982): one relevant element, several elements, elements related to each other, and generalisation beyond the task.

The stages after assessment are kept separate because of the structure of a validity argument (Kane, 2006; Hirsh, 2019). Scoring what the student wrote, [synthesising](methodology/pedagogical/phase9_generalization_method.md) what the exam shows about the student's understanding, [extrapolating](methodology/pedagogical/phase10_extrapolation_method.md) to the course criteria and deciding a grade are four inferences, and each needs its own warrant. Hirsh identifies skipping a step as the most common validity error: reading a missing answer directly as a missing competence. The synthesis stage is hermeneutic (Moss, 1994): it looks for patterns across a student's answers and treats inconsistency as information rather than noise.

The [feedback guidance](methodology/pedagogical/phase12_feedback_method.md) follows Hattie and Timperley (2007) and Sadler (1989): where the student is now, where the student is heading and what the next step is, written so that the student can act on it.

The [foundation document](methodology/pedagogical/00_foundation.md) sets out these principles in full and is loaded at the start of every assessment session.

## Technical organisation

Assessment Suite consists of two servers that run on the teacher's computer and connect to an AI application through the Model Context Protocol (MCP), which lets the application call their tools. The [Python server](packages/assessment-data-mcp/README.md) handles document preparation, data organisation and reports. The [TypeScript server](packages/assessment-mcp/README.md) runs the assessment workflows: it supplies the methodology instructions and saves and retrieves assessments.

The AI application manages the conversation and the tool calls; the model generates the proposals and interpretations. The files and the servers stay on the computer. The model runs wherever the application runs it, which for most applications today means a remote service, so the material sent to the model leaves the computer.

## Development status and open questions

Version 0.8.0 contains the preparation, assessment and reporting tools described above, and the methodology documents for every stage. The workflows for assessing by question and saving assessments are the most used parts of the system. The separate mode for assessing one student's work as a whole, such as a lab report, is experimental.

Several parts of the workflow have not yet been verified for this documentation. A clean installation and first run have not been tested across the intended AI applications, and a download route without Git is planned but not built. Report generation has been checked directly against the implementation with fabricated test material, which produced both report types and the numerical summary; the same sequence has not been run through an AI application from beginning to end. No local model configuration has yet been found that handles the workflow adequately. The later stages of interpretation and feedback need further technical and theoretical development.

The open questions about assessment itself are these. Whether a rubric captures the qualities that matter in a task, and what is lost when an answer is divided into aspects and points. Whether summaries and reports preserve conflicting evidence or smooth it over. How far a conclusion can extend from the answers assessed to a claim about what a student knows. And what saved judgements and reasons do to a teacher's later decisions: they may support memory and overview, and they may also anchor later judgements to earlier ones. None of these effects has been studied. Readable instructions, quoted evidence and teacher review make the assessment inspectable; they do not by themselves make it valid.

## Risks and conditions of use

- **Personal data.** PDFs and answers must be free of personal data before they reach the AI application. Assessment Suite does not detect or remove identifiers. Check the content, the filenames and the file metadata; replacing a name is not enough to make an answer anonymous. Use fabricated student answers for first trials, and keep real student material outside this repository.
- **AI processing and permissions.** Material sent to a remote model leaves the computer. Establish how the chosen AI application handles data, and what file and tool access it has, before supplying material. Installing the servers locally does not by itself make the work GDPR-compliant, and the servers' workspace restriction does not limit what the application itself can do.
- **Downloaded software.** An MCP package contains server software that the AI application executes on the computer. Check the source and contents of the package, the commands it runs and the access it asks for before installing it.
- **Errors and incomplete records.** Extraction can drop text, AI proposals can be wrong, and summaries can hide evidence that points the other way. Examine the prepared text, the proposals and the records behind any later conclusion. A saved assessment shows what was submitted, not that it was reviewed or that it is defensible.

For vulnerability reporting and the supported-version policy, see [SECURITY.md](SECURITY.md). Report vulnerabilities through [private vulnerability reporting](https://github.com/tikankika/assessment-suite/security/advisories/new).

## Access and further reading

The [source setup guide](docs/SETUP_GUIDE.md) describes how to install both servers from the repository and connect them to an AI application; see [Development status](#development-status-and-open-questions) for what has and has not been tested. A download route without Git, using the MCPB package format, is planned.

The [example materials](examples/README.md) combine fabricated student answers with an authentic set of questions, rubric and syllabus. They are the material to use for a first trial.

The [documentation index](docs/README.md) lists the rest. The [workflow guide](docs/WORKFLOW-INTEGRATION.md) follows the stages in order and shows which tools each one uses. The [architecture decisions](docs/decisions/) record the technical choices, and the [roadmap](ROADMAP.md) the planned development.

## Participation and licence

Questions, bug reports and critique of the design or of its assessment assumptions are welcome as [GitHub Issues](https://github.com/tikankika/assessment-suite/issues). See the [contribution guidance](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md). Cite the project using [CITATION.cff](CITATION.cff).

Assessment Suite is released under the **PolyForm Noncommercial License 1.0.0**; see [LICENSE](LICENSE) for the terms.
