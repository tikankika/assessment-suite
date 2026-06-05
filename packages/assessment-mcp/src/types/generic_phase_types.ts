/**
 * Generic Phase Types — RFC-030 P2
 *
 * Shared types for the GenericPhaseOrchestrator that replaces
 * per-phase orchestrator classes (Phase 9-12).
 *
 * Methodology drives behavior — tools are scaffolding.
 */

import type { BaseSession } from '../core/base_session_manager.js';

// ============================================================
// PHASE CONFIG
// ============================================================

/** Describes how to load one input file for a phase. */
export interface InputFileSpec {
  /** Folder constant (e.g., FOLDERS.PHASE8_QUANTITATIVE) */
  folder: string;
  /** File name pattern. Use `{studentId}` as placeholder. */
  filePattern: string;
  /** How to parse the file content. */
  parser: 'json' | 'text';
  /** Human-readable label for logging / error messages. */
  label: string;
  /** If true, missing file is not an error. */
  optional?: boolean;
}

/** Configuration that fully describes a phase's I/O. */
export interface PhaseConfig {
  phaseNumber: number;
  /** Phase marker ID, e.g. 'PHASE_9' */
  phaseId: string;
  /** Section title in Complete_ report, e.g. 'DEL 2: KVALITATIV GENERALISERING' */
  sectionTitle: string;
  /** Output folder constant, e.g. FOLDERS.PHASE9_QUALITATIVE */
  outputFolder: string;
  /** Standalone filename pattern. Use `{studentId}` as placeholder. */
  standaloneFilePattern: string;
  /** Method name on MethodologyLoader, e.g. 'loadPhase9Methodology' */
  methodologyLoader: string;
  /** Input files to load at start. */
  inputFiles: InputFileSpec[];
  /** If true, this is a class-level phase (no student_id required). */
  classLevel?: boolean;
}

// ============================================================
// SESSION
// ============================================================

/** Session for GenericPhaseOrchestrator — metadata only, no dialogue state. */
export interface GenericPhaseSession extends BaseSession {
  /** Loaded input file data, keyed by InputFileSpec.label. */
  loaded_data: Record<string, unknown>;
}

// ============================================================
// TOOL RESULTS
// ============================================================

/** Response from generic phase start tool. */
export interface GenericPhaseStartResult {
  session_id: string;
  loaded_data: Record<string, unknown>;
  methodology: string;
  project_info: { courseName: string; examName: string };
  /** Assessment purpose document content, or null if not declared yet. */
  assessment_purpose: string | null;
}

/** Response from generic phase complete tool. */
export interface GenericPhaseCompleteResult {
  success: boolean;
  output_path: string;
  standalone_path: string;
  next_step: string;
}
