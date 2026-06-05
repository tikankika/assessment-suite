/**
 * Reflection Tools - Cross-Phase Meta-Analysis
 * 
 * These tools support pedagogical reflection and meta-analysis
 * across all phases (Phase 3, 6, 7, 8, and beyond).
 * 
 * @module reflection
 * @see RFC-014 - Source Directory Restructure
 * @see methodology/cross_phase/README.md (cross-phase methodology — covers all three reflection tools)
 */

export { AspectAnalyzer } from './aspect_analyzer.js';
export { InsightsWriter } from './insights_writer.js';
export { reflectUncertainty } from './uncertainty_reviewer.js';

// Type exports
export type {
  AspectStatistics,
  AspectAnalysisResult,
} from './aspect_analyzer.js';

export type {
  InsightEntry,
} from './insights_writer.js';

export type {
  UncertaintyReviewerInput,
  UncertaintyReviewerResult,
} from './uncertainty_reviewer.js';
