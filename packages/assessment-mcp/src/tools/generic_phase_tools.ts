/**
 * Generic Phase Tools — RFC-030 §6.2
 *
 * Two generic tools for Phase 9-12:
 *   phase_start(phase, project_path, student_id)  — load data + methodology
 *   phase_complete(session_id, content)            — dual-write + cleanup
 *
 * Phase selected via parameter. No per-phase tool names.
 * No phase_continue — LLM reads methodology and drives dialogue.
 * For drafts, LLM calls the existing student_report_update tool.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GenericPhaseOrchestrator } from '../core/generic_phase_orchestrator.js';
import { PHASE_CONFIGS } from '../core/phase_configs.js';
import type {
  GenericPhaseStartResult,
  GenericPhaseCompleteResult,
} from '../types/generic_phase_types.js';

// Singleton orchestrators per phase
const orchestrators = new Map<number, GenericPhaseOrchestrator>();

function getOrchestrator(phase: number): GenericPhaseOrchestrator {
  let orch = orchestrators.get(phase);
  if (!orch) {
    const config = PHASE_CONFIGS[phase];
    if (!config) {
      throw new Error(
        `Unknown phase ${phase}. Supported phases: ${Object.keys(PHASE_CONFIGS).join(', ')}`,
      );
    }
    orch = new GenericPhaseOrchestrator(config);
    orchestrators.set(phase, orch);
  }
  return orch;
}

// ============================================================
// TOOL DEFINITIONS
// ============================================================

const supportedPhases = Object.keys(PHASE_CONFIGS).join(', ');

export const phaseStartTool: Tool = {
  name: 'phase_start',
  description: `Start an AI-assisted assessment phase for a student.

Supported phases: ${supportedPhases}
- Phase 9: Kvalitativ generalisering (Kane/Hirsh)
- Phase 10: Extrapolering — criteria mapping to ILOs
- Phase 11: Betygsbeslut — grading decision
- Phase 12: Återkoppling — formative feedback
- Phase 13: Lärarsammanfattning — class-level teacher summary (student_id not required)
- Phase 14: Elevåterkoppling — student-facing feedback

This tool:
1. Loads input data from previous phases
2. Loads phase-specific methodology (full text)
3. Creates a dialogue session
4. Returns loaded data + methodology for LLM-driven dialogue

Read the methodology carefully and follow its process.
For Phase 9–12, use student_report_update to save per-student drafts during the dialogue.
Phase 13 (class-level) and Phase 14 (student feedback) are saved via phase_complete, not student_report_update.
When done, call phase_complete with the final content.`,
  inputSchema: {
    type: 'object',
    properties: {
      phase: {
        type: 'number',
        description: `Phase number (${supportedPhases})`,
      },
      project_path: {
        type: 'string',
        description: 'Path to assessment project root',
      },
      student_id: {
        type: 'string',
        description: 'Student identifier (e.g., "100100_200101")',
      },
    },
    required: ['phase', 'project_path'],
  },
};

export const phaseCompleteTool: Tool = {
  name: 'phase_complete',
  description: `Complete a phase session and save the final document.

Call this when the LLM-driven dialogue is finished and you have the final content.

This tool:
1. Removes any draft section from the Complete_ report
2. Writes final phase section to Complete_ report (with markers)
3. Saves standalone file to the phase output folder
4. Logs workflow action
5. Cleans up the session`,
  inputSchema: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Session ID from phase_start',
      },
      content: {
        type: 'string',
        description: 'Final markdown content for the phase section',
      },
    },
    required: ['session_id', 'content'],
  },
};

// ============================================================
// TOOL HANDLERS
// ============================================================

export async function handlePhaseStart(
  args: { phase: number; project_path: string; student_id?: string },
): Promise<GenericPhaseStartResult> {
  const orch = getOrchestrator(args.phase);
  const config = PHASE_CONFIGS[args.phase];
  const studentId = config?.classLevel ? 'class' : args.student_id;
  if (!studentId) {
    throw new Error(`student_id is required for Phase ${args.phase}`);
  }
  return orch.start(args.project_path, studentId);
}

export async function handlePhaseComplete(
  args: { session_id: string; content: string },
): Promise<GenericPhaseCompleteResult> {
  // Extract phase number from session_id (format: "phase9_studentId_timestamp")
  const phaseMatch = args.session_id.match(/^phase(\d+)_/);
  if (!phaseMatch) {
    throw new Error(`Invalid session_id format: ${args.session_id}`);
  }
  const phase = parseInt(phaseMatch[1], 10);
  const orch = getOrchestrator(phase);
  return orch.complete(args.session_id, args.content);
}

// ============================================================
// EXPORTS
// ============================================================

/** All generic phase tool definitions */
export const genericPhaseTools: Tool[] = [
  phaseStartTool,
  phaseCompleteTool,
];

/** Tool handler map for server registration */
export const genericPhaseToolHandlers = {
  phase_start: handlePhaseStart,
  phase_complete: handlePhaseComplete,
};
