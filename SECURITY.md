# Assessment Suite 0.8.0: security and data handling

Assessment Suite runs two local servers that an AI application calls to prepare materials and save and retrieve assessments. This document explains the data and execution risks, the controls implemented in the servers, and the project's vulnerability reporting policy. Version 0.8.0 is under development.

## Reporting a vulnerability

Report security problems through GitHub's [private vulnerability reporting](https://github.com/tikankika/assessment-suite/security/advisories/new), available under **Security → Report a vulnerability**. Do not open a public issue for a vulnerability.

Include the affected version or source revision, the AI application and operating system, a description of the impact, and steps to reproduce the problem. Include a suggested mitigation if you have one. Use fabricated material for the reproduction, and check screenshots and logs for personal data, credentials and private file paths before attaching them.

You can expect an acknowledgement within a week. Please allow time for a fix before public disclosure.

## Supported versions

| Version | Security support |
|---|---|
| 0.8.x | Supported |
| Earlier than 0.8 | Unsupported |

## Material supplied to the tools

PDFs, answers and other supplied material must be free of personal data before they reach the AI application. Assessment Suite does not detect or remove identifiers. Check the text, filenames and file metadata before supplying material.

Replacing a name with a code does not by itself establish anonymity. An answer can still identify someone through its contents or through other information that can be linked to it, such as a described event, a workplace or a family circumstance, even when no name appears. See the Swedish Authority for Privacy Protection's explanation of [personal data](https://www.imy.se/en/organisations/data-protection/this-applies-accordning-to-gdpr/the-purposes-and-scope-of-gdpr/personal-data/).

Use fabricated student answers for first trials. Keep real student material outside the source repository, including folders excluded by `.gitignore`. Examples, tests, issue reports and contributions must use student material fabricated from the outset.

## Where material is processed

The servers perform file operations on the computer and return tool results to the AI application. These results can contain student answers, saved judgements and methodology instructions. When the application includes this material in a request to a remote model, it leaves the computer. A locally executed operation does not determine where its result is subsequently processed.

Which stages send answers to the model depends on what the model is asked to read. Assessment reads every answer to every question, and the later interpretation and feedback stages read the compiled records; these send student text by design. Stages that move or transform files, such as conversion, extraction and report generation, do not need the model to read answers, but their tool results and any preview the teacher opens still enter the conversation.

The chosen application, model service and account configuration determine model processing, retention and access. Establish those conditions before supplying material. Assessment Suite does not select a model provider or guarantee a processing region, and the repository does not determine a fixed number of model requests per answer.

Network activity also occurs outside model requests. The setup tool downloads course material when supplied with a syllabus URL. Installing the Python MCPB bundle can require the application and `uv` to download a runtime and dependencies. These are separate operations from sending assessment material to a model.

## Workspace checks and their limits

Both servers require a workspace directory at startup. Choose a dedicated folder for assessment work and configure both servers to use it.

Startup checks reject the filesystem root, the user's home directory, specified system directories, nonexistent directories, ordinary files and directories that are not writable. Some broad folders, such as the user's Documents folder, produce a warning but remain permitted.

Before dispatching a tool call, each server checks a defined list of file and directory argument names against its workspace. The path validators resolve existing symbolic links when checking whether a path is inside the permitted directory. Selected tools also validate identifiers used to construct filenames. The implementation can be inspected in the [assessment server](packages/assessment-mcp/src/server.ts), [data server](packages/assessment-data-mcp/src/assessment_data_mcp/server.py) and their [TypeScript](packages/assessment-mcp/src/core/path_validator.ts) and [Python](packages/assessment-data-mcp/src/assessment_data_mcp/validators/path_validator.py) validators.

These checks are application code. They do not isolate the server processes from the operating system, constrain every possible file operation, or restrict the AI application's other tools and file permissions. The server processes run with the user's privileges and are not isolated from the network; a compromised dependency from npm or pip could send data out regardless of the workspace boundary. The servers also load software and methodology from their installation and configuration, including an optional `METHODOLOGY_PATH` outside the assessment workspace. Workspace validation does not inspect file contents for personal data or control subsequent model processing.

## Saved files, reports and logs

Assessment work creates local copies and derived records. Generated reports can contain answer text as well as judgements, points and feedback. Treat a report as assessment material when deciding where to store or share it.

The tools also write project logs. These can contain file paths and student identifiers; workflow action records can contain points and assessment aspect details. Rejected workspace requests write the requested path and workspace path to the server's diagnostic output. The AI application may retain that output under its own logging settings.

Account for source copies, reports, logs, conversation history, synchronisation and backups when managing access and deletion. Check the contents of any file before sharing it for support or research. Excluding a folder from Git does not restrict access to it or prevent other software from copying it.

## Executable software and editable instructions

An MCPB bundle contains server software that the AI application runs on the computer. Check its source, contents, startup commands and requested access before installing it. The current manifests launch the assessment server with Node.js and the data server through `uv`. Review the [assessment manifest](packaging/mcpb/assessment/manifest.json) and [data manifest](packaging/mcpb/data/manifest.json) for those commands and settings.

Methodology documents supply instructions to the model. Changes to those files can change the guidance it receives. Which stages read which file is described in the design document: an edited project copy reaches the assessment stage, while the later stages read from the installation or from `METHODOLOGY_PATH`. Review an edited or shared methodology before using it, and review tool actions prompted by material being assessed. Instructions embedded in an answer must not be treated as permission to disclose files or change the assessment procedure.

The workflow asks the teacher to examine AI proposals and decide what to save. Saving a judgement or recording a confirmation does not demonstrate that this review occurred. The [workflow guide](docs/WORKFLOW-INTEGRATION.md) describes the review activities and the records they produce.

## Organisational conditions

Before institutional use, establish who is responsible for the material, which application and services are permitted, and how access, retention and incidents are handled. The local servers and the teacher-review workflow do not establish compliance with data-protection or education requirements.

The EU AI Act addresses systems intended to evaluate learning outcomes in Annex III, point 3(b). Its classification rules require examination of the intended use; teacher involvement alone does not settle that classification. Consult the [current regulation](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02024R1689-20260727), particularly Article 6 and Annex III, when assessing a proposed institutional use.

In Sweden, the school's responsible authority (*huvudmannen*) is the data controller for student material, not the individual teacher; inform them before institutional use, and carry out a data protection impact assessment where one is required. Grades are set by a teacher under the Education Act (skollagen 3 kap. 16 §); the grade-decision stage produces a proposal for the teacher's decision and must not be used to set grades on its own.

## Known open issues

- Pseudonymisation of student IDs is weak, and pseudonymisation on its own does not meet the input condition above.
- There is no automated detection of personal data; removing it is the teacher's manual responsibility.
- There is no data protection impact assessment template.
- There is no process isolation; the servers run with the user's privileges.
- Where the model provider processes data depends on the application and the provider; check this for the application you use.
