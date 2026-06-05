/**
 * PhaseDataLoader - Generic file loading for Phase 13 aggregation
 *
 * RFC-029 §15: Replaces 5 nearly-identical loadPhaseXData() functions
 * in phase13_aggregator.ts with a single generic utility.
 *
 * Each function followed the same pattern:
 *   readdir(dir) → filter(pattern) → readFile → parse → collect
 *
 * This module parameterises the variable parts (folder, pattern, parser).
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Options for loading phase data files.
 */
export interface PhaseDataLoadOptions<T> {
  /** Absolute path to the project root */
  projectPath: string;
  /** Folder name under project root (e.g. FOLDERS.PHASE8_QUANTITATIVE) */
  folder: string;
  /** Filter predicate applied to each filename in the directory */
  fileFilter: (filename: string) => boolean;
  /** Parse file content into a typed result (return null to skip) */
  parser: (content: string, filename: string) => T | null;
}

/**
 * Load and parse all matching files from a phase output directory.
 *
 * Silently skips files that fail to read or parse, and returns an
 * empty array if the directory does not exist — matching the
 * existing behaviour of the individual loadPhaseXData() functions.
 */
export async function loadPhaseData<T>(options: PhaseDataLoadOptions<T>): Promise<T[]> {
  const dir = path.join(options.projectPath, options.folder);
  const results: T[] = [];

  try {
    const files = await fs.readdir(dir);
    const matching = files.filter(options.fileFilter);

    for (const file of matching) {
      try {
        const content = await fs.readFile(path.join(dir, file), 'utf-8');
        const parsed = options.parser(content, file);
        if (parsed) results.push(parsed);
      } catch {
        // Skip invalid files (matches original behaviour)
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return results;
}
