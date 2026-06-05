/**
 * reflect_uncertainty - Create quality review documents for uncertain assessments
 *
 * Creates structured review documents for bedömningsansvarig when teacher
 * is uncertain about an assessment.
 *
 * @see methodology/cross_phase/quality_assurance_method.md (cross-phase methodology)
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { StudentReader } from '../core/student_reader.js';
import { RubricParser } from '../shared/rubric_parser.js';
import { FOLDERS } from '../shared/folder_constants.js';
import { ExamConfigReader } from '../shared/exam_config_reader.js';
import {
  deriveProjectPath,
  logWorkflowAction,
  safeStateOperation,
  getPhase6Session,
} from '../shared/project_state_manager.js';

// ============================================================================
// Types
// ============================================================================

export interface UncertaintyReviewerInput {
  q_file_path: string;
  student_id: string;
  reason: string;
  detailed_analysis: string;
  options: {
    a: { description: string; next_step: string };
    b: { description: string; next_step: string };
  };
  comparison_students?: string[];
  aspect_of_concern?: string;
}

export interface UncertaintyReviewerResult {
  success: boolean;
  saved_to: string;
  student_id: string;
  question_id: string;
  timestamp: string;
}

interface StudentData {
  id: string;
  answer: string;
  wordCount: number;
  assessment: string | null;
}

interface QuestionData {
  id: string;
  title: string;
  maxPoints: number;
  rubricSection: string;
}

// ============================================================================
// Main Function
// ============================================================================

export async function reflectUncertainty(
  args: UncertaintyReviewerInput
): Promise<UncertaintyReviewerResult> {
  const {
    q_file_path,
    student_id,
    reason,
    detailed_analysis,
    options,
    comparison_students,
    aspect_of_concern,
  } = args;

  console.error('[reflect_uncertainty] START ========================');
  console.error('[reflect_uncertainty] q_file_path:', q_file_path);
  console.error('[reflect_uncertainty] student_id:', student_id);
  console.error('[reflect_uncertainty] reason:', reason.slice(0, 50) + '...');

  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const dateStr = new Date().toISOString().split('T')[0];

  // Step 1: Derive project path
  console.error('[reflect_uncertainty] Step 1: Deriving project path...');
  const projectPath = await deriveProjectPath(q_file_path);
  if (!projectPath) {
    throw new Error('Could not derive project path from q_file_path');
  }
  console.error('[reflect_uncertainty] Step 1: projectPath:', projectPath);

  // Step 2: Get assessor from session state (ADR-005)
  let assessor = 'Unknown';
  const session = await getPhase6Session(projectPath);
  if (session?.assessor) {
    assessor = session.assessor;
  }
  console.error('[reflect_uncertainty] Step 2: assessor:', assessor);

  // Step 3: Extract question ID from Q-file path
  console.error('[reflect_uncertainty] Step 3: Extracting question ID...');
  const examConfigReader = new ExamConfigReader();
  const questionId = examConfigReader.extractQuestionId(q_file_path) || 'Unknown';
  console.error('[reflect_uncertainty] Step 3: questionId:', questionId);

  // Step 4: Read Q-file once and extract all student data from it
  console.error('[reflect_uncertainty] Step 4: Reading student data...');
  const qFileContent = await fs.readFile(q_file_path, 'utf-8');
  const studentData = getStudentDataFromContent(qFileContent, student_id);
  if (!studentData) {
    throw new Error(`Student ${student_id} not found in ${q_file_path}`);
  }
  console.error('[reflect_uncertainty] Step 4: Found student, wordCount:', studentData.wordCount);

  // Step 5: Get question data (title, points, rubric)
  console.error('[reflect_uncertainty] Step 5: Reading question data...');
  const questionData = await getQuestionData(projectPath, q_file_path, questionId);
  console.error('[reflect_uncertainty] Step 5: Question:', questionData.title, questionData.maxPoints + 'p');

  // Step 6: Get comparison students if requested (reuse already-read content)
  let comparisonData: StudentData[] = [];
  if (comparison_students && comparison_students.length > 0) {
    console.error('[reflect_uncertainty] Step 6: Reading comparison students...');
    for (const compId of comparison_students) {
      const compStudent = getStudentDataFromContent(qFileContent, compId);
      if (compStudent) {
        comparisonData.push(compStudent);
      }
    }
    console.error('[reflect_uncertainty] Step 6: Found', comparisonData.length, 'comparison students');
  }

  // Step 7: Generate review document
  console.error('[reflect_uncertainty] Step 7: Generating review document...');
  const reviewContent = generateReviewDocument({
    timestamp,
    assessor,
    questionId,
    questionData,
    studentData,
    reason,
    aspect_of_concern,
    detailed_analysis,
    options,
    comparisonData,
  });

  // Step 8: Create output folder and write file
  console.error('[reflect_uncertainty] Step 8: Writing review file...');
  const outputFolder = path.join(projectPath, '05_uncertainty_review');
  await fs.mkdir(outputFolder, { recursive: true });

  const filename = `${questionId}_${student_id}_Review_${dateStr}.md`;
  const outputPath = path.join(outputFolder, filename);
  await fs.writeFile(outputPath, reviewContent, 'utf-8');
  console.error('[reflect_uncertainty] Step 8: Written to:', outputPath);

  // Step 9: Log workflow action
  console.error('[reflect_uncertainty] Step 9: Logging workflow action...');
  await safeStateOperation(
    () => logWorkflowAction(
      projectPath,
      6,
      'reflect_uncertainty',
      'quality_review_created',
      {
        q_file_path,
        student_id,
        reason: reason.slice(0, 100),
        has_comparison: comparison_students ? comparison_students.length > 0 : false,
      },
      {
        saved_to: outputPath,
        question_id: questionId,
        success: true,
      }
    ),
    'reflect_uncertainty logWorkflowAction'
  );

  console.error('[reflect_uncertainty] SUCCESS');
  console.error('[reflect_uncertainty] END ==========================');

  return {
    success: true,
    saved_to: outputPath,
    student_id,
    question_id: questionId,
    timestamp,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get student data including the full BEDÖMNING section from pre-read content
 */
function getStudentDataFromContent(
  content: string,
  studentId: string
): StudentData | null {
  const lines = content.split('\n');

  const STUDENT_PATTERN = /^## Elev ([A-Za-z0-9]+) \((\d+) ord\)/;
  const BEDÖMNING_PATTERN = /^### (?:BEDÖMNING|ANALYTIC ASSESSMENT):/;

  let foundStudent = false;
  let currentId = '';
  let wordCount = 0;
  let answerLines: string[] = [];
  let assessmentLines: string[] = [];
  let inAssessment = false;

  for (const line of lines) {
    const headerMatch = line.match(STUDENT_PATTERN);

    if (headerMatch) {
      // If we already found our student, stop
      if (foundStudent) {
        break;
      }

      currentId = headerMatch[1];
      wordCount = parseInt(headerMatch[2], 10);

      if (currentId === studentId) {
        foundStudent = true;
        answerLines = [];
        assessmentLines = [];
        inAssessment = false;
      }
      continue;
    }

    // Separator between students
    if (line === '---' && foundStudent && !inAssessment) {
      // Could be end of answer or separator before assessment
      continue;
    }

    if (foundStudent) {
      if (BEDÖMNING_PATTERN.test(line)) {
        inAssessment = true;
        assessmentLines.push(line);
      } else if (inAssessment) {
        // Check if we hit next student
        if (line.startsWith('## Elev ')) {
          break;
        }
        assessmentLines.push(line);
      } else {
        answerLines.push(line);
      }
    }
  }

  if (!foundStudent) {
    return null;
  }

  return {
    id: studentId,
    answer: answerLines.join('\n').trim(),
    wordCount,
    assessment: assessmentLines.length > 0 ? assessmentLines.join('\n').trim() : null,
  };
}

/**
 * Get question data from exam_config or Q-file
 */
async function getQuestionData(
  projectPath: string,
  qFilePath: string,
  questionId: string
): Promise<QuestionData> {
  const examConfigReader = new ExamConfigReader();
  const rubricParser = new RubricParser();

  let title = `Question ${questionId}`;
  let maxPoints = 0;
  let rubricSection = '';

  // Try to load from exam_config.yaml
  const configPath = path.join(projectPath, 'exam_config.yaml');
  try {
    const examConfig = await examConfigReader.load(configPath);
    const questionConfig = examConfigReader.getQuestionById(examConfig, questionId);

    if (questionConfig) {
      title = questionConfig.question_title || title;
      maxPoints = questionConfig.points || 0;

      // Get rubric section
      const rubricPath = path.join(projectPath, FOLDERS.PHASE1_ORIGINAL, 'rubric.md');
      try {
        rubricSection = await rubricParser.extractFullSection(rubricPath, questionConfig);
      } catch {
        // Try 02_markdown folder
        const rubricPath2 = path.join(projectPath, FOLDERS.PHASE2_MARKDOWN, 'rubric.md');
        try {
          rubricSection = await rubricParser.extractFullSection(rubricPath2, questionConfig);
        } catch {
          rubricSection = '[Rubric could not be loaded]';
        }
      }
    }
  } catch {
    // exam_config not found, try to get title from Q-file header
    const content = await fs.readFile(qFilePath, 'utf-8');
    const titleMatch = content.match(/^# (.+)$/m);
    if (titleMatch) {
      title = titleMatch[1];
    }
  }

  return {
    id: questionId,
    title,
    maxPoints,
    rubricSection,
  };
}

/**
 * Generate the complete review document
 */
function generateReviewDocument(params: {
  timestamp: string;
  assessor: string;
  questionId: string;
  questionData: QuestionData;
  studentData: StudentData;
  reason: string;
  aspect_of_concern?: string;
  detailed_analysis: string;
  options: { a: { description: string; next_step: string }; b: { description: string; next_step: string } };
  comparisonData: StudentData[];
}): string {
  const {
    timestamp,
    assessor,
    questionId,
    questionData,
    studentData,
    reason,
    aspect_of_concern,
    detailed_analysis,
    options,
    comparisonData,
  } = params;

  let doc = `# QUALITY REVIEW - ${questionId} (${questionData.title})
## Student: ${studentData.id}

---

**Date:** ${timestamp}
**Assessor:** ${assessor}
**Bedömningsansvarig:** [To be filled]

---

## REASON FOR REVIEW

${reason}

**Specific concern:** ${aspect_of_concern || 'General assessment'}

---

## QUESTION TEXT

**${questionData.title}**

**Max points:** ${questionData.maxPoints}p

---

## RUBRIC

${questionData.rubricSection || '[Rubric not available]'}

---

## STUDENT ANSWER (${studentData.id})

**Word count:** ${studentData.wordCount}

> ${studentData.answer.split('\n').join('\n> ')}

---

## ASSESSOR'S EVALUATION

${studentData.assessment || '[No assessment recorded yet]'}

---

## DETAILED ANALYSIS

${detailed_analysis}

---
`;

  // Add comparison section if there are comparison students
  if (comparisonData.length > 0) {
    doc += `
## CONSISTENCY COMPARISON

| Student | Word Count | Assessment Summary |
|---------|------------|-------------------|
| **${studentData.id}** | ${studentData.wordCount} | Primary review target |
`;
    for (const comp of comparisonData) {
      const assessmentSummary = comp.assessment
        ? comp.assessment.split('\n').slice(0, 2).join(' ').slice(0, 50) + '...'
        : 'Not assessed';
      doc += `| ${comp.id} | ${comp.wordCount} | ${assessmentSummary} |\n`;
    }
    doc += `
---
`;
  }

  doc += `
## QUESTION FOR BEDÖMNINGSANSVARIG

**OPTION A:** ${options.a.description}
- Recommended next step: ${options.a.next_step}

**OPTION B:** ${options.b.description}
- Recommended next step: ${options.b.next_step}

---

## BEDÖMNINGSANSVARIG FEEDBACK

**Decision:** [ ] Option A  OR  [ ] Option B

**Rationale:**

_____________________________________

**Updated assessment (if applicable):**

_____________________________________

**General guidance for similar cases:**

_____________________________________

---

**Reviewed by:** _______________________
**Date:** _______________________
**Signature:** _______________________
`;

  return doc;
}
