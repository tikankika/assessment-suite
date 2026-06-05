import { InsightsWriter, InsightEntry } from '../reflection/insights_writer.js';
import {
  deriveProjectPath,
  logWorkflowAction,
  updateSources,
  safeStateOperation,
} from '../shared/project_state_manager.js';

/**
 * reflect_insights - Save a teacher insight (metareflektion) to Teacher_Insights.md
 *
 * Philosophy: Claude Desktop generates insights SPONTANEOUSLY during assessment.
 * This tool just SAVES them - it does NOT prompt or automate insight generation.
 *
 * IMPORTANT: This is for METAREFLECTIONS (why students make errors, pedagogical insights).
 * For student progression DATA, use Assessment_Status_Summary.md (automated).
 *
 * @param args.assessment_path - Path to any Q-file (used to determine folder)
 * @param args.insight_type - Category: pattern | pedagogical | critical | summary
 * @param args.content - Free-text insight from Claude Desktop
 * @param args.related_students - Optional: Student IDs this relates to
 * @param args.related_questions - Optional: Question numbers (e.g., "Q1", "Q3")
 * @returns Result with savedTo path and timestamp
 *
 * @see methodology/cross_phase/meta_reflection_method.md (canonical cross-phase methodology)
 */

export interface ReflectInsightsInput {
  assessment_path: string;
  insight_type: 'pattern' | 'pedagogical' | 'critical' | 'summary';
  content: string;
  related_students?: string[];
  related_questions?: string[];
}

export interface ReflectInsightsResult {
  success: boolean;
  savedTo: string;
  type: string;
  timestamp: string;
}

export async function reflectInsights(args: ReflectInsightsInput): Promise<ReflectInsightsResult> {
  const { assessment_path, insight_type, content, related_students, related_questions } = args;

  console.error('[reflect_insights] START ========================');
  console.error('[reflect_insights] assessment_path:', assessment_path);
  console.error('[reflect_insights] insight_type:', insight_type);
  console.error('[reflect_insights] content length:', content?.length);
  console.error('[reflect_insights] related_students:', related_students);
  console.error('[reflect_insights] related_questions:', related_questions);

  // Validate content is not empty
  if (!content || content.trim() === '') {
    console.error('[reflect_insights] ERROR: Empty content');
    throw new Error('content cannot be empty');
  }

  // Validate insight_type
  const validTypes = ['pattern', 'pedagogical', 'critical', 'summary'];
  if (!validTypes.includes(insight_type)) {
    console.error('[reflect_insights] ERROR: Invalid insight_type:', insight_type);
    throw new Error(
      `Invalid insight_type "${insight_type}". ` +
      `Must be one of: ${validTypes.join(', ')}. ` +
      'NOTE: "trend" is not valid - student progression is automated data in Assessment_Status_Summary.md!'
    );
  }

  const writer = new InsightsWriter();
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const entry: InsightEntry = {
    type: insight_type,
    content: content.trim(),
    timestamp,
    relatedStudents: related_students,
    relatedQuestions: related_questions,
  };

  console.error('[reflect_insights] Appending insight to file...');
  const savedPath = await writer.appendInsight(assessment_path, entry);
  console.error('[reflect_insights] Saved to:', savedPath);

  // Update project state tracking
  // RFC-029 §19.2 P10: reflect_insights is a meta-reflection tool used during
  // Phase 6 assessment — not a phase completion event. Removed markPhaseComplete.
  const stateProjectPath = await deriveProjectPath(assessment_path);
  if (stateProjectPath) {
    // Update sources.yaml with teacher insights file
    await safeStateOperation(
      () => updateSources(stateProjectPath, 'teacher_insights', {
        type: 'markdown',
        copied_to: 'Teacher_Insights.md',
        note: 'Teacher insights and metareflections during Phase 6',
      }),
      'reflect_insights updateSources'
    );

    // Log workflow action
    await safeStateOperation(
      () => logWorkflowAction(
        stateProjectPath,
        6,
        'reflect_insights',
        'insight_save',
        {
          assessment_path,
          insight_type,
          content_length: content.length,
          related_students: related_students,
          related_questions: related_questions,
        },
        {
          saved_to: savedPath,
          success: true,
        }
      ),
      'reflect_insights logWorkflowAction'
    );
  }

  console.error('[reflect_insights] SUCCESS');
  console.error('[reflect_insights] END ==========================');

  return {
    success: true,
    savedTo: savedPath,
    type: insight_type,
    timestamp,
  };
}
