/**
 * Shared Utilities - Multi-Phase Common Components
 * 
 * These utilities are used across multiple phases and provide
 * common functionality for parsing, reading, and managing state.
 * 
 * @module shared
 * @see RFC-014 - Source Directory Restructure
 */

export { ExamConfigReader } from './exam_config_reader.js';
export { RubricParser } from './rubric_parser.js';
export {
  generateExamConfig,
  saveExamConfig,
  loadExamConfig,
  generateYAMLString,
} from './yaml_generator.js';

// Project state management - re-export all functions
export {
  loadProjectState,
  saveProjectState,
  updateProjectState,
  logWorkflowAction,
  loadSources,
  updateSources,
  hasProjectState,
  markPhaseInProgress,
  markPhaseComplete,
  markPhaseIncomplete,
  deriveProjectPath,
  safeStateOperation,
  getTimestamp,
} from './project_state_manager.js';

// Type exports
export type {
  ExamConfig,
  QuestionConfig,
  AspectConfig,
  RubricData,
  ExamMetadata,
} from './exam_config_reader.js';

export type {
  PhaseStatus,
  PhaseInfo,
  ProjectState,
  WorkflowLogEntry,
  SourceEntry,
  SourcesYaml,
} from './project_state_manager.js';
