/**
 * reflect_aspect_analysis - Generate per-aspect statistics from assessed Q-files
 *
 * Parses BEDÖMNING sections to calculate:
 * - Per-aspect mean, min, max, distribution
 *
 * Returns raw statistics. Pedagogical interpretation left to methodology/LLM.
 *
 * @see methodology/cross_phase/descriptive_statistics_method.md (cross-phase methodology)
 */

import { AspectAnalyzer, AspectAnalysisResult } from '../reflection/aspect_analyzer.js';
import { InsightsWriter } from '../reflection/insights_writer.js';
import {
  deriveProjectPath,
  logWorkflowAction,
  safeStateOperation,
} from '../shared/project_state_manager.js';

// ============================================================================
// Types
// ============================================================================

export interface ReflectAspectAnalysisInput {
  q_file_path: string;
  output_format?: 'summary' | 'detailed' | 'json';
  include_students?: boolean;
  append_to_insights?: boolean;
}

export interface ReflectAspectAnalysisResult {
  success: boolean;
  question_id: string;
  assessed_students: number;
  total_students: number;
  output: string | object;
  output_format: string;
  saved_to?: string;
  timestamp: string;
}

// ============================================================================
// Main Function
// ============================================================================

export async function reflectAspectAnalysis(
  args: ReflectAspectAnalysisInput
): Promise<ReflectAspectAnalysisResult> {
  const {
    q_file_path,
    output_format = 'summary',
    include_students = false,
    append_to_insights = false,
  } = args;

  // cross_phase/descriptive_statistics_method.md § 4 export-safety enforcement (Approach A):
  // When append_to_insights is true, force include_students to false.
  // Per-student IDs in formatted output would land in Teacher_Insights.md
  // and reach Anthropic via the Teacher_MCP bridge.
  let effective_include_students = include_students;
  if (append_to_insights && include_students) {
    console.error(
      '[reflect_aspect_analysis] WARNING: include_students=true is incompatible ' +
      'with append_to_insights=true (cross_phase/descriptive_statistics_method.md § 4 (Critical Export-Safety Rule)); ' +
      'forcing include_students=false. Use append_to_insights=false to keep per-student detail in dialogue.'
    );
    effective_include_students = false;
  }

  console.error('[reflect_aspect_analysis] START ========================');
  console.error('[reflect_aspect_analysis] q_file_path:', q_file_path);
  console.error('[reflect_aspect_analysis] output_format:', output_format);
  console.error('[reflect_aspect_analysis] include_students:', include_students, '(effective:', effective_include_students, ')');
  console.error('[reflect_aspect_analysis] append_to_insights:', append_to_insights);

  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

  // Step 1: Analyze Q-file
  console.error('[reflect_aspect_analysis] Step 1: Analyzing Q-file...');
  const analyzer = new AspectAnalyzer();
  let analysis: AspectAnalysisResult;

  try {
    analysis = await analyzer.analyzeQFile(q_file_path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[reflect_aspect_analysis] Error:', message);
    throw new Error(`Failed to analyze Q-file: ${message}`);
  }

  console.error('[reflect_aspect_analysis] Step 1: Found', analysis.assessedStudents, 'assessed students');

  if (analysis.assessedStudents === 0) {
    throw new Error('No assessed students found in Q-file. Complete Phase 6 assessment first.');
  }

  // Step 2: Format output
  console.error('[reflect_aspect_analysis] Step 2: Formatting output as', output_format);
  let output: string | object;

  switch (output_format) {
    case 'json':
      output = analyzer.formatJSON(analysis);
      break;
    case 'detailed':
      output = analyzer.formatDetailed(analysis, effective_include_students);
      break;
    case 'summary':
    default:
      output = analyzer.formatSummary(analysis);
      break;
  }

  // Step 3: Log analysis complete (pedagogical interpretation left to LLM)
  console.error('[reflect_aspect_analysis] Step 3: Analysis complete, aspects:', analysis.aspects.length);

  // Step 4: Optionally append to Teacher_Insights.md
  let savedTo: string | undefined;
  if (append_to_insights && typeof output === 'string') {
    console.error('[reflect_aspect_analysis] Step 4: Appending to Teacher_Insights.md...');
    try {
      const insightsWriter = new InsightsWriter();
      savedTo = await insightsWriter.appendInsight(q_file_path, {
        type: 'summary',
        content: output,
        timestamp,
        relatedQuestions: [analysis.questionId],
      });
      console.error('[reflect_aspect_analysis] Step 4: Saved to:', savedTo);
    } catch (error) {
      console.error('[reflect_aspect_analysis] Step 4: Failed to append to insights:', error);
      // Don't fail the whole operation
    }
  }

  // Step 5: Log workflow action
  const projectPath = await deriveProjectPath(q_file_path);
  if (projectPath) {
    console.error('[reflect_aspect_analysis] Step 5: Logging workflow action...');
    await safeStateOperation(
      () => logWorkflowAction(
        projectPath,
        6,
        'reflect_aspect_analysis',
        'aspect_analysis_complete',
        {
          q_file_path,
          output_format,
          include_students,
          effective_include_students,
          append_to_insights,
        },
        {
          question_id: analysis.questionId,
          assessed_students: analysis.assessedStudents,
          total_students: analysis.totalStudents,
          saved_to: savedTo,
        }
      ),
      'reflect_aspect_analysis logWorkflowAction'
    );
  }

  console.error('[reflect_aspect_analysis] SUCCESS');
  console.error('[reflect_aspect_analysis] END ==========================');

  return {
    success: true,
    question_id: analysis.questionId,
    assessed_students: analysis.assessedStudents,
    total_students: analysis.totalStudents,
    output,
    output_format,
    saved_to: savedTo,
    timestamp,
  };
}
