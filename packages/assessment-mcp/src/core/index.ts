/**
 * Assessment_MPC - Core Module Exports
 *
 * Phase 6 assessment workflow modules only.
 * For reflection tools, see ../reflection/
 * For shared utilities, see ../shared/
 *
 * RFC-014: Source directory restructure
 */

// Phase 6 Core - Assessment Workflow
export { StatusManager } from './status_manager.js';
export { StudentReader } from './student_reader.js';
export { AssessmentWriter } from './assessment_writer.js';
export { MethodologyLoader } from './methodology_loader.js';
export { SummaryWriter } from './summary_writer.js';
export { AssessmentParser } from './assessment_parser.js';

// Security utilities
export { validatePath, validatePathOrThrow, isPathWithinBase } from './path_validator.js';
export type { PathValidationResult } from './path_validator.js';

// Phase 4 helpers (could move to phase4/ in future)
export {
  QUESTION_PATTERNS,
  detectQuestionHeader,
  detectExamFormat,
  extractMaxMarks,
  extractQuestionType,
} from './question_patterns.js';
export type { PatternMatch } from './question_patterns.js';
export { RubricWriter } from './rubric_writer.js';
