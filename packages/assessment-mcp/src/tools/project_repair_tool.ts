/**
 * Project Repair MCP Tool (RFC-015)
 *
 * Fixes path portability issues by converting absolute paths to relative paths.
 * This enables projects to be shared across machines via Nextcloud/Dropbox/etc.
 *
 * Usage:
 *   project_repair({ project_path: "/path/to/project" })
 *   project_repair({ project_path: "/path/to/project", dry_run: true })
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { repairProject } from '../core/project_repair.js';
import type { ProjectRepairResult } from '../types/repair_types.js';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const projectRepairTool: Tool = {
  name: 'project_repair',
  description: `Fix path portability issues in an assessment project (RFC-015).

This tool converts absolute paths (e.g., /Users/username/...) to relative paths,
enabling projects to be shared across different machines.

WHEN TO USE:
- Project was created on a different machine/user account
- MCP tools fail with "file not found" errors
- Project was moved to a different location
- Syncing via Nextcloud/Dropbox/cloud storage

WHAT IT FIXES:
- project_state.json: phase6.assessment_file, phase6.original_file
- sources.yaml: removes original_path (not needed after copying)

WHAT IT PRESERVES:
- workflow_log.jsonl: Not modified (historical audit trail)

Use dry_run=true to preview changes without applying them.`,
  inputSchema: {
    type: 'object',
    properties: {
      project_path: {
        type: 'string',
        description: 'Path to assessment project root (where project_state.json is located)',
      },
      dry_run: {
        type: 'boolean',
        description: 'If true, report what would be changed without applying changes (default: false)',
      },
    },
    required: ['project_path'],
  },
};

// ============================================================================
// TOOL HANDLER
// ============================================================================

export async function handleProjectRepair(
  args: { project_path: string; dry_run?: boolean }
): Promise<ProjectRepairResult> {
  const { project_path, dry_run = false } = args;

  const result = await repairProject(project_path, dry_run);

  return result;
}

// ============================================================================
// FORMAT OUTPUT FOR USER
// ============================================================================

/**
 * Format repair result for human-readable output
 */
export function formatRepairResult(result: ProjectRepairResult): string {
  const lines: string[] = [];

  lines.push(`## Project Repair Result`);
  lines.push('');
  lines.push(`**Status:** ${result.status}`);
  lines.push(`**Project:** ${result.project_path}`);
  lines.push('');

  if (result.status === 'already_portable') {
    lines.push('✅ Project is already portable - no absolute paths found.');
    return lines.join('\n');
  }

  if (result.status === 'error') {
    lines.push('❌ **Error:** ' + (result.warnings[0] || 'Unknown error'));
    return lines.join('\n');
  }

  // Status: repaired
  lines.push('### Summary');
  lines.push(`- Files scanned: ${result.summary.files_scanned}`);
  lines.push(`- Absolute paths found: ${result.summary.absolute_paths_found}`);
  lines.push(`- Paths converted: ${result.summary.paths_converted}`);
  lines.push(`- Files updated: ${result.summary.files_updated.join(', ') || 'none'}`);
  lines.push('');

  if (result.changes.length > 0) {
    lines.push('### Changes');
    for (const change of result.changes) {
      const verifiedIcon = change.verified ? '✅' : '⚠️';
      lines.push(`- **${change.file}** \`${change.field}\``);
      lines.push(`  - Old: \`${change.old_value}\``);
      lines.push(`  - New: \`${change.new_value}\` ${verifiedIcon}`);
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('### Warnings');
    for (const warning of result.warnings) {
      lines.push(`- ⚠️ ${warning}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
