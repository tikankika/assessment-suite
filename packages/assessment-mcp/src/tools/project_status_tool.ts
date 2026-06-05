/**
 * Project Status MCP Tool (RFC-013: Session Continuity)
 *
 * The missing tool that enables resuming projects. Reads state files,
 * lists Q-files, shows progress, and provides recommendations.
 *
 * Usage:
 *   project_status({ project_path: "/path/to/project" })
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getProjectStatus,
  formatProjectStatus,
} from '../core/project_status.js';
import type { ProjectStatusResult } from '../types/project_status_types.js';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const projectStatusTool: Tool = {
  name: 'project_status',
  description: `Get comprehensive status of an assessment project (RFC-013: Session Continuity).

WHEN TO USE:
- Starting work on an existing project
- Resuming after a break
- Checking progress before Phase 8+
- Finding where to continue assessment

WHAT IT RETURNS:
- Project overview (name, created, last updated)
- Phase completion status (1-7+)
- Q-file list with assessment progress per question
- Active session info (if any)
- Source file locations (rubric, exam, methodology)
- Recommendations for next steps

This tool reads project_state.json, sources.yaml, and scans Q-files
to provide a complete picture of project status.`,
  inputSchema: {
    type: 'object',
    properties: {
      project_path: {
        type: 'string',
        description:
          'Path to assessment project root (where project_state.json is located)',
      },
    },
    required: ['project_path'],
  },
};

// ============================================================================
// TOOL HANDLER
// ============================================================================

export async function handleProjectStatus(args: {
  project_path: string;
}): Promise<ProjectStatusResult & { formatted_output: string }> {
  const result = await getProjectStatus(args.project_path);

  // Add formatted output for easy display
  return {
    ...result,
    formatted_output: formatProjectStatus(result),
  };
}
