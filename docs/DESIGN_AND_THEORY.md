# Assessment Suite 0.8.0: design and theory

This document examines what teachers can change in Assessment Suite, which choices the software fixes, and how assessment research informs the methodology. The [workflow guide](WORKFLOW-INTEGRATION.md) explains the activities and their outputs; the [README](../README.md) gives the overview.

## Assessment choices in documents and in code

Assessment Suite keeps its assessment guidance in methodology documents that a teacher can read, question and revise. They describe how to examine an answer, how to interpret a rubric and how to prepare feedback, and they set the division of labour: the AI proposes, the teacher examines and decides before anything is saved.

The documents contain substantive assessment choices. One example: the guidance allows credit for an answer that is valid in a way the rubric did not anticipate, and asks the teacher to write down the interpretation. A teacher can read that instruction, decide whether it suits the task and change it. What an edit reaches depends on which file each stage loads; the next section sets that out.

The software fixes other choices. In the structured assessment route, every saved assessment consists of named aspects, each with a quality symbol, points and a comment, together with a total, a maximum and one next-step comment for the assessment as a whole. The writing tool checks selected fields and that the aspect points add up to the total. Editing a methodology document does not change this structure; it is where the analytic form of the assessment lives.

The separation is not complete. Later stages have their required input files declared in code, so an instruction cannot remove a dependency; that is a limit on the intention to keep methodological choices in editable documents. Its complement holds: if a methodology document cannot be loaded, the later stages stop and name the missing file, and the assessment stage loads the documents it finds; no stage continues on instructions written into the code.

The writing tool stores what the teacher submits. Its checks concern the structure and arithmetic of the submitted record. They do not establish that the teacher examined the answer, that the reasons support the judgement or that the judgement is sound. An instruction to review, a saved record and evidence that review took place are three different things.

Sources: [roles and review](../methodology/pedagogical/phase6_assessment_method.md#L194), [predefined and emergent criteria](../methodology/pedagogical/phase6_assessment_method.md#L49), [assessment record](../packages/assessment-mcp/src/types/assessment.ts#L18), [validation](../packages/assessment-mcp/src/tools/phase6_write.ts#L249), [stage dependencies](../packages/assessment-mcp/src/core/phase_configs.ts#L80), [missing-document error](../packages/assessment-mcp/src/core/methodology_loader.ts#L506), [write path](../packages/assessment-mcp/src/tools/phase6_write.ts#L131).

## What teachers can adapt, and how far an edit reaches

Teachers can adapt the rubric and the methodological instructions. Changing stage dependencies or the structured assessment format requires changes to the software. Each kind of change has a different reach.

| What a teacher changes | Where it lives | Which stages see the change |
|---|---|---|
| The rubric: aspects, quality descriptions, points | The rubric selected for the assessment project | Assessments made with the revised rubric. Existing assessments and reports need review and, where affected, revision or regeneration. |
| The assessment methodology: how to examine an answer, interpret the criteria, write reasons and a next step | The methodology location the project records, or the project's own or parent methodology folder | The assessment stage, for projects that resolve to that copy |
| The methodology for interpretation, criteria mapping, grade decision and feedback | The installation's methodology directory, or the directory `METHODOLOGY_PATH` names | Projects using that location. Already cached text remains in use until the server process is restarted. |
| The available stages and their required inputs | Tool implementation and stage configuration, including `phase_configs.ts` | Stages using the changed implementation or configuration |
| The structured assessment record | Code: `types/assessment.ts`, the formatter and the registered schema | Structured saves using the changed implementation; report parsers may also need to change |

The rubric is the most direct adaptation and the one the methodology expects: it is written for the task, and the rubric-design guidance exists to help the teacher decide what its aspects and levels should be.

At assessment start, the tool uses the methodology location recorded in `sources.yaml`. If no location is recorded, it looks for the project's methodology folder and then the parent's. An edit affects subsequent loads that resolve to that copy; a shared parent folder can serve more than one project. Later stages use the installation directory or `METHODOLOGY_PATH` and cache text after reading it. Restarting the server process clears that cache, so a subsequent load can read the edited file. The bundled distribution exposes that location as an optional Methodology folder setting, and project setup reads the same setting, so one folder of the teacher's own can supply both the project copy and the later stages. These paths are established from the source; no live edit-and-reload trial has been run.

A teacher can stop when the work needed for the assessment is complete. Continuing to a later stage still requires its configured inputs: for example, the current feedback stage requires the extrapolation file even though its methodology describes an optional route without it. Changing those dependencies or adding a tool-supported stage requires code changes. The workflow guide records the current dependencies.

Mørch, Ludvigsen and Gilje compare teachers' participation in training EssayCritic with their customisation of SchoolGPT through pre-prompting. Editing Assessment Suite's instructions is closer to the second case; this is a comparison of adaptation mechanisms, not evidence of the same educational effects. Their discussion also raises questions for this project: who maintains the methodology in a school, and how are changes checked against educational aims? Whether teachers can sustain that work remains to be investigated.

Sources: [project-aware resolution](../packages/assessment-mcp/src/tools/phase6_start.ts#L234), [shared loader](../packages/assessment-mcp/src/core/methodology_loader.ts#L22), [orchestrator loader selection](../packages/assessment-mcp/src/core/generic_phase_orchestrator.ts#L81), [stage configuration](../packages/assessment-mcp/src/core/phase_configs.ts#L80), [assessment record](../packages/assessment-mcp/src/types/assessment.ts#L18), Mørch, Ludvigsen and Gilje, [*Teachers as End-User Developers*](https://ceur-ws.org/Vol-3978/short-s2-07.pdf).

## How research ideas enter the methodology, and what each leaves open

The methodology documents name the research they draw on and, at particular points, the instruction that follows from it. This section describes those points as the methodology states them; it does not evaluate the research or the methodology's reading of it.

| Idea and source named | Where it enters | The instruction or choice it informs | What remains open |
|---|---|---|---|
| Analytic assessment (Jönsson, 2010) | Assessment, Phase 6 | Judge each aspect separately; every judgement carries a symbol, points and a comment. The methodology names three risks, fragmentation, aspect inflation and mechanical application, and assigns each a countermeasure: a later synthesis stage, a SOLO check on the rubric, and an instruction to read the whole answer first. | Whether the countermeasures work, and what the division into aspects loses for a given task. |
| Criterion-referenced assessment and emergent criteria (Sadler, 1989, 2009) | Assessment, Phase 6 | Judge against the rubric, never against other students; write so the student can see how the answer meets the criteria; cite the student's words. Generous interpretation, with the interpretation written down, is the methodology's answer to Sadler's point that fixed criteria cannot anticipate every valid answer. | Whether documented interpretation keeps judgements consistent across a class, and how interpretation drifts over many answers. The foundation asks for a calibration pause after every three or four students; the saved assessment does not establish that the pause happened. |
| SOLO taxonomy (Biggs and Collis, 1982) | Rubric design, Phase 4 | Express levels of quality as structural complexity: one element, several, related, extended. Check that a rubric's levels match the cognitive demand of the question. | Whether a rubric built this way captures the qualities that matter in the task. |
| SOLO taxonomy, applied | Assessment, Phase 6 | The quality symbols map to SOLO levels. | The methodology states that the symbols emerged from practice and map to SOLO implicitly; the correspondence is asserted, not tested. |
| Validity argument (Kane, 2006; Hirsh, 2019) | The stage structure: Phases 6, 9, 10, 11 | Keep scoring, synthesis, extrapolation and decision as separate stages so that each inference gets its own warrant, and so that a missing answer is not read directly as a missing competence. | Separate stages and files do not establish that each inference was warranted. |
| Hermeneutic synthesis (Moss, 1994, 2003) | Interpretation, Phase 9 | Look for patterns across a student's answers; treat inconsistency as information; let subject knowledge guide the reading. | The methodology labels its Moss references preliminary, based on secondary sources and observed behaviour, with primary reading pending. |
| Feedback (Sadler, 1989; Hattie and Timperley, 2007) | Feedback, Phases 12 and 14 | Structure feedback around where the student is, where the student is heading and the next step; permit comparison with the student's own earlier work, forbid comparison with other students. | Whether students can use the feedback produced. Not studied. |

Two things follow from the table. A theory name in an instruction shows what the instruction was written to do, not that the instruction does it; where a methodology document asserts a benefit, as the assessment methodology does for analytic assessment, the assertion is part of the design, not evidence for it. And the questions in the last column are of two kinds: some can be settled by reading the primary sources and comparing them with the instructions, and some only by studying assessments produced with the tool.

Sources: [foundation](../methodology/pedagogical/00_foundation.md), [assessment methodology](../methodology/pedagogical/phase6_assessment_method.md), [rubric design](../methodology/pedagogical/phase4_rubric_design_method.md), [generalisation](../methodology/pedagogical/phase9_generalization_method.md#L15), [extrapolation](../methodology/pedagogical/phase10_extrapolation_method.md), [feedback](../methodology/pedagogical/phase12_feedback_method.md).

## What the representation preserves and what it obscures

Each stage writes a representation of the one before it. Compilation keeps most of what the assessment held and can retain the extracted answer; the numerical overview keeps only points; interpretation adds judgements. The question is what each representation preserves, leaves out or adds, and how that shapes the next reading.

The saved assessment keeps, for each aspect, a symbol, points and a comment that the methodology requires to cite the student's own words; one next step; and, where generous interpretation was applied, the interpretation, if the assessor wrote it down as instructed. Uncertainty has a place, through the symbol reserved for a problematic or borderline reading. What the record does not keep is the proposal as it was first made, the teacher's questions, and the reasons an alternative reading was rejected. The record is the outcome of the examination, not the examination.

The compiled report includes detailed assessments and, when the parser supplies them, the extracted answers and question context. Its numerical overview lists points, maxima and percentages by question; it contains neither the aspect comments nor their quality symbols. The detailed sections can retain both. The numerical parser tries this overview first and falls back to assessed question files. Later interpretation stages load the records specified for that stage, including fuller reports, so reducing information in a summary does not by itself remove the detail from all later work. It remains possible for a reader to overlook a qualification when attending to a total.

Retrieval returns selected question sections from the progressive student report. Those sections can contain the extracted answer as well as the assessment and its reasons. The tool does not reopen the source PDF or recover the discussion that preceded saving. A teacher can revisit the material preserved in the report, but cannot assume that an omitted passage or an earlier alternative interpretation will be recoverable there.

The methodology draws a line between what an assessment records and what can be inferred from it: assessments are to say what the exam shows, not what the student understands, and the stage structure keeps synthesis and extrapolation out of the assessment itself. That line is one of wording and of stage. A comment that says "shows" is still an interpretation, and the record cannot tell a careful reading from a careless one. What the software can show is where each claim sits in the chain; whether the claim is justified has to be read from the claim.

Sources: [observation and aspect-level scoring](../methodology/pedagogical/00_foundation.md), [assessment record](../packages/assessment-mcp/src/types/assessment.ts#L18), [report generation](../packages/assessment-data-mcp/src/assessment_data_mcp/phase7/generator.py#L295), [numerical parser](../packages/assessment-data-mcp/src/assessment_data_mcp/phase8/hybrid_parser.py#L25), [retrieval](../packages/assessment-mcp/src/tools/hermeneutic_read.ts#L145).

## Questions for investigation

The design raises questions that the documentation cannot answer, because they concern what happens when teachers use the tool. This section names them and says what would count as evidence. None has been studied.

| Question | What in the design raises it | What would answer it |
|---|---|---|
| What does the teacher hand over: remembering, administration, comparison, interpretation, or decisions? | Saved judgements and reasons, compiled reports and retrieval are built to relieve the teacher of holding every assessment in mind. Cognitive offloading and the extended-mind literature are possible lenses, not established properties of the tool. | Observation of teachers working through a class with and without the records, and what they consult when. |
| Do the records anchor later judgements to earlier ones? | Later stages can receive both earlier assessment records and numerical summaries. Which representation draws the teacher's attention may influence the subsequent judgement. | Comparison of interpretations made with and without access to earlier records, and cases where a teacher revised an earlier judgement after synthesis. |
| How far do teachers rely on the AI's proposal? | The AI proposes an assessment for teacher review. The saved assessment holds the submitted result, so the result alone does not reveal how the teacher examined or revised it. | Records of proposals alongside submitted assessments, and the pattern of revisions across a class. |
| Do the countermeasures against fragmentation and mechanical application work? | The methodology names both risks and assigns instructions intended to address them; saving an assessment does not establish that these instructions were followed. | Assessments compared with holistic readings of the same answers, and the calibration pauses the methodology asks for. |
| What does a project-local edit to the methodology change in practice? | Adaptation is a design intention with a known reach at source level and no edit-and-reload trial. | A trial that edits an instruction, restarts where needed, and compares proposals before and after. |
| What inferences can the analytic assessments support? | The stage structure separates scoring, synthesis, extrapolation and decision; keeping stages separate does not establish the warrants for their conclusions. | Validity argumentation applied to a set of completed assessments, from the aspect judgements to the grade decision. |

The first four can be studied with fabricated answers and a small group of teachers. The fifth is a technical trial. The sixth needs completed assessments of real work, and therefore the data-handling conditions set out in the README's risk section.
