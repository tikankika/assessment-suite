/**
 * Project Repair - Path Portability Fix (RFC-015)
 *
 * Converts absolute paths in state files to relative paths,
 * enabling projects to be shared across machines.
 *
 * Handles:
 * - project_state.json: phase6.assessment_file, phase6.original_file
 * - sources.yaml: original_path fields
 *
 * Does NOT migrate workflow_log.jsonl (historical audit trail)
 */

import { promises as fs } from 'fs';
import { join, relative, isAbsolute, basename, dirname } from 'path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import type {
  ProjectRepairResult,
  PathChange,
  DetectedAbsolutePath,
} from '../types/repair_types.js';
import {
  loadProjectState,
  saveProjectState,
  logWorkflowAction,
  type ProjectState,
  type SourcesYaml,
} from '../shared/project_state_manager.js';
import { ALL_KNOWN_FOLDERS } from '../shared/folder_constants.js';

// ============================================================================
// Path Utilities (RFC-015)
// ============================================================================

/**
 * Check if a path is absolute
 * Handles both Unix (/Users/...) and Windows (C:\...) paths
 */
export function isAbsolutePath(p: string): boolean {
  if (!p) return false;
  // Unix absolute path
  if (p.startsWith('/')) return true;
  // Windows absolute path (C:\ or D:\)
  if (/^[A-Z]:\\/i.test(p)) return true;
  return false;
}

/**
 * Convert absolute path to relative path within project
 * Returns null if path is not within project or cannot be converted
 */
export function toRelativePath(
  projectRoot: string,
  absolutePath: string
): string | null {
  if (!isAbsolutePath(absolutePath)) {
    // Already relative
    return absolutePath;
  }

  // Try direct conversion using path.relative()
  const rel = relative(projectRoot, absolutePath);

  // If relative path starts with "..", the file is outside project
  if (rel.startsWith('..')) {
    // Try to find known project directories in the path
    // ADR-007: Use canonical folder names from folder_constants
    const knownDirs = [...ALL_KNOWN_FOLDERS];

    const parts = absolutePath.split('/');
    for (const dir of knownDirs) {
      const idx = parts.findIndex((p) => p === dir || p.startsWith(dir));
      if (idx >= 0) {
        return parts.slice(idx).join('/');
      }
    }

    return null; // Cannot convert
  }

  return rel;
}

/**
 * Convert relative path to absolute path
 */
export function toAbsolutePath(
  projectRoot: string,
  relativePath: string
): string {
  if (isAbsolutePath(relativePath)) {
    return relativePath; // Already absolute (legacy)
  }
  return join(projectRoot, relativePath);
}

/**
 * Resolve a stored path (handles both legacy absolute and new relative)
 * This provides backward compatibility for legacy projects
 */
export function resolvePath(
  projectRoot: string,
  storedPath: string
): string {
  if (!storedPath) return storedPath;

  if (isAbsolutePath(storedPath)) {
    // Legacy absolute path - try to resolve
    console.warn(`[project_repair] Legacy absolute path: ${storedPath}`);

    // First try: convert directly
    const rel = toRelativePath(projectRoot, storedPath);
    if (rel) {
      const resolved = join(projectRoot, rel);
      return resolved;
    }

    // Fallback: return as-is (will likely fail)
    return storedPath;
  }

  // New relative path
  return join(projectRoot, storedPath);
}

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Scan project_state.json for absolute paths
 */
async function scanProjectState(
  projectPath: string
): Promise<DetectedAbsolutePath[]> {
  const detected: DetectedAbsolutePath[] = [];

  try {
    const state = await loadProjectState(projectPath);

    // Check phase6 session paths
    if (state.phase6) {
      if (state.phase6.assessment_file && isAbsolutePath(state.phase6.assessment_file)) {
        detected.push({
          file: 'project_state.json',
          field: 'phase6.assessment_file',
          value: state.phase6.assessment_file,
          suggested_relative: toRelativePath(projectPath, state.phase6.assessment_file),
        });
      }

      if (state.phase6.original_file && isAbsolutePath(state.phase6.original_file)) {
        detected.push({
          file: 'project_state.json',
          field: 'phase6.original_file',
          value: state.phase6.original_file,
          suggested_relative: toRelativePath(projectPath, state.phase6.original_file),
        });
      }
    }

    // Check for any other absolute paths in phases
    for (const [phaseName, phaseInfo] of Object.entries(state.phases || {})) {
      for (const [key, value] of Object.entries(phaseInfo)) {
        if (typeof value === 'string' && isAbsolutePath(value)) {
          detected.push({
            file: 'project_state.json',
            field: `phases.${phaseName}.${key}`,
            value: value,
            suggested_relative: toRelativePath(projectPath, value),
          });
        }
      }
    }
  } catch (error) {
    // File might not exist
  }

  return detected;
}

/**
 * Scan sources.yaml for absolute paths
 */
async function scanSourcesYaml(
  projectPath: string
): Promise<DetectedAbsolutePath[]> {
  const detected: DetectedAbsolutePath[] = [];
  const sourcesPath = join(projectPath, 'sources.yaml');

  try {
    const content = await fs.readFile(sourcesPath, 'utf-8');
    const sources = yamlLoad(content) as SourcesYaml;

    if (sources?.sources) {
      for (const [sourceKey, sourceEntry] of Object.entries(sources.sources)) {
        // Check original_path
        if (sourceEntry?.original_path && isAbsolutePath(sourceEntry.original_path)) {
          detected.push({
            file: 'sources.yaml',
            field: `sources.${sourceKey}.original_path`,
            value: sourceEntry.original_path,
            suggested_relative: null, // Will be removed, not converted
          });
        }

        // Check original_source (alternative field name)
        if (sourceEntry?.original_source && isAbsolutePath(sourceEntry.original_source)) {
          detected.push({
            file: 'sources.yaml',
            field: `sources.${sourceKey}.original_source`,
            value: sourceEntry.original_source,
            suggested_relative: null, // Will be removed, not converted
          });
        }

        // Check copied_to (if absolute)
        if (sourceEntry?.copied_to && isAbsolutePath(sourceEntry.copied_to)) {
          detected.push({
            file: 'sources.yaml',
            field: `sources.${sourceKey}.copied_to`,
            value: sourceEntry.copied_to,
            suggested_relative: toRelativePath(projectPath, sourceEntry.copied_to),
          });
        }
      }
    }
  } catch (error) {
    // File might not exist
  }

  return detected;
}

// ============================================================================
// Repair Functions
// ============================================================================

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Repair project_state.json
 */
async function repairProjectState(
  projectPath: string,
  dryRun: boolean
): Promise<{ changes: PathChange[]; warnings: string[] }> {
  const changes: PathChange[] = [];
  const warnings: string[] = [];

  try {
    const state = await loadProjectState(projectPath);
    let modified = false;

    if (state.phase6) {
      // Fix assessment_file
      if (state.phase6.assessment_file && isAbsolutePath(state.phase6.assessment_file)) {
        const newPath = toRelativePath(projectPath, state.phase6.assessment_file);
        if (newPath) {
          const absoluteNewPath = join(projectPath, newPath);
          const exists = await fileExists(absoluteNewPath);

          changes.push({
            file: 'project_state.json',
            field: 'phase6.assessment_file',
            old_value: state.phase6.assessment_file,
            new_value: newPath,
            verified: exists,
          });

          if (!exists) {
            warnings.push(
              `File not found after conversion: ${newPath} (was: ${state.phase6.assessment_file})`
            );
          }

          if (!dryRun) {
            state.phase6.assessment_file = newPath;
            modified = true;
          }
        } else {
          warnings.push(
            `Cannot convert path: ${state.phase6.assessment_file} - not within project`
          );
        }
      }

      // Fix original_file
      if (state.phase6.original_file && isAbsolutePath(state.phase6.original_file)) {
        const newPath = toRelativePath(projectPath, state.phase6.original_file);
        if (newPath) {
          const absoluteNewPath = join(projectPath, newPath);
          const exists = await fileExists(absoluteNewPath);

          changes.push({
            file: 'project_state.json',
            field: 'phase6.original_file',
            old_value: state.phase6.original_file,
            new_value: newPath,
            verified: exists,
          });

          if (!exists) {
            warnings.push(
              `File not found after conversion: ${newPath} (was: ${state.phase6.original_file})`
            );
          }

          if (!dryRun) {
            state.phase6.original_file = newPath;
            modified = true;
          }
        } else {
          warnings.push(
            `Cannot convert path: ${state.phase6.original_file} - not within project`
          );
        }
      }
    }

    if (modified && !dryRun) {
      await saveProjectState(projectPath, state);
    }
  } catch (error) {
    warnings.push(`Error reading project_state.json: ${error}`);
  }

  return { changes, warnings };
}

/**
 * Repair sources.yaml - removes original_path fields entirely (RFC-015 decision)
 */
async function repairSourcesYaml(
  projectPath: string,
  dryRun: boolean
): Promise<{ changes: PathChange[]; warnings: string[] }> {
  const changes: PathChange[] = [];
  const warnings: string[] = [];
  const sourcesPath = join(projectPath, 'sources.yaml');

  try {
    const content = await fs.readFile(sourcesPath, 'utf-8');
    const sources = yamlLoad(content) as SourcesYaml;
    let modified = false;

    if (sources?.sources) {
      for (const [sourceKey, sourceEntry] of Object.entries(sources.sources)) {
        // Remove original_path entirely (RFC-015 decision)
        if (sourceEntry?.original_path) {
          changes.push({
            file: 'sources.yaml',
            field: `sources.${sourceKey}.original_path`,
            old_value: sourceEntry.original_path,
            new_value: '(removed)',
            verified: true,
          });

          if (!dryRun) {
            delete sourceEntry.original_path;
            modified = true;
          }
        }

        // Remove original_source entirely (RFC-015 decision - alternative field name)
        if (sourceEntry?.original_source && isAbsolutePath(sourceEntry.original_source)) {
          changes.push({
            file: 'sources.yaml',
            field: `sources.${sourceKey}.original_source`,
            old_value: sourceEntry.original_source,
            new_value: '(removed)',
            verified: true,
          });

          if (!dryRun) {
            delete sourceEntry.original_source;
            modified = true;
          }
        }

        // Fix copied_to if absolute
        if (sourceEntry?.copied_to && isAbsolutePath(sourceEntry.copied_to)) {
          const newPath = toRelativePath(projectPath, sourceEntry.copied_to);
          if (newPath) {
            const absoluteNewPath = join(projectPath, newPath);
            const exists = await fileExists(absoluteNewPath);

            changes.push({
              file: 'sources.yaml',
              field: `sources.${sourceKey}.copied_to`,
              old_value: sourceEntry.copied_to,
              new_value: newPath,
              verified: exists,
            });

            if (!exists) {
              warnings.push(
                `File not found: ${newPath} (was: ${sourceEntry.copied_to})`
              );
            }

            if (!dryRun) {
              sourceEntry.copied_to = newPath;
              modified = true;
            }
          }
        }
      }
    }

    // Add version marker if not present
    if (!sources.version && !dryRun) {
      sources.version = '2.0';
      modified = true;
    }

    if (modified && !dryRun) {
      const yamlContent = yamlDump(sources, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        quotingType: "'",
      });
      await fs.writeFile(sourcesPath, yamlContent, 'utf-8');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      warnings.push(`Error reading sources.yaml: ${error}`);
    }
  }

  return { changes, warnings };
}

// ============================================================================
// Main Repair Function
// ============================================================================

/**
 * Repair project to use portable relative paths
 *
 * @param projectPath - Path to project root
 * @param dryRun - If true, report changes without applying them
 * @returns Repair result with changes and warnings
 */
export async function repairProject(
  projectPath: string,
  dryRun: boolean = false
): Promise<ProjectRepairResult> {
  const allChanges: PathChange[] = [];
  const allWarnings: string[] = [];
  const filesUpdated: string[] = [];

  // Verify project exists
  const stateExists = await fileExists(join(projectPath, 'project_state.json'));
  if (!stateExists) {
    return {
      status: 'error',
      project_path: projectPath,
      changes: [],
      warnings: ['project_state.json not found - not a valid assessment project'],
      summary: {
        files_scanned: 0,
        absolute_paths_found: 0,
        paths_converted: 0,
        files_updated: [],
      },
    };
  }

  // Scan for absolute paths first
  const detectedInState = await scanProjectState(projectPath);
  const detectedInSources = await scanSourcesYaml(projectPath);
  const totalDetected = detectedInState.length + detectedInSources.length;

  // If no absolute paths found, project is already portable
  if (totalDetected === 0) {
    return {
      status: 'already_portable',
      project_path: projectPath,
      changes: [],
      warnings: [],
      summary: {
        files_scanned: 2,
        absolute_paths_found: 0,
        paths_converted: 0,
        files_updated: [],
      },
    };
  }

  // Repair project_state.json
  const stateResult = await repairProjectState(projectPath, dryRun);
  allChanges.push(...stateResult.changes);
  allWarnings.push(...stateResult.warnings);
  if (stateResult.changes.length > 0 && !dryRun) {
    filesUpdated.push('project_state.json');
  }

  // Repair sources.yaml
  const sourcesResult = await repairSourcesYaml(projectPath, dryRun);
  allChanges.push(...sourcesResult.changes);
  allWarnings.push(...sourcesResult.warnings);
  if (sourcesResult.changes.length > 0 && !dryRun) {
    filesUpdated.push('sources.yaml');
  }

  // Log the repair action (unless dry run)
  if (!dryRun && allChanges.length > 0) {
    try {
      await logWorkflowAction(
        projectPath,
        0, // Phase 0 = project maintenance
        'project_repair',
        'path_portability_fix',
        { dry_run: false },
        {
          status: 'repaired',
          changes_count: allChanges.length,
          files_updated: filesUpdated,
        }
      );
    } catch (error) {
      allWarnings.push(`Could not log repair action: ${error}`);
    }
  }

  return {
    status: 'repaired',
    project_path: projectPath,
    changes: allChanges,
    warnings: allWarnings,
    summary: {
      files_scanned: 2,
      absolute_paths_found: totalDetected,
      paths_converted: allChanges.length,
      files_updated: filesUpdated,
    },
  };
}
