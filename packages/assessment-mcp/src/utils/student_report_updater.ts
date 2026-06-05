/**
 * Student Report Updater
 *
 * Utility for updating student reports with phase-specific sections.
 * Supports idempotent updates (re-running a phase replaces the section).
 *
 * RFC-018: Used by Phase 9-12 orchestrators to write to complete_assessment/
 * instead of creating separate files per phase.
 *
 * Format:
 * <!-- PHASE_9_START -->
 * ## DEL 2: KVALITATIV GENERALISERING
 * ...content...
 * <!-- PHASE_9_END -->
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';

// ============================================================
// TYPES
// ============================================================

export interface UpdateSectionOptions {
  /** RFC-018: Path to student report (complete_assessment/Complete_{student}.md) */
  reportPath: string;
  /** Phase identifier (e.g., "PHASE_9", "PHASE_10") */
  phaseId: string;
  /** Section title (e.g., "DEL 2: KVALITATIV GENERALISERING") */
  sectionTitle: string;
  /** Markdown content for the section */
  content: string;
  /** Author for changelog entry */
  author?: string;
  /** Description for changelog entry */
  changeDescription?: string;
}

export interface ChangelogEntry {
  date: string;
  phase: string;
  change: string;
  author: string;
}

export interface UpdateResult {
  success: boolean;
  action: 'created' | 'replaced' | 'appended';
  reportPath: string;
  error?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const CHANGELOG_MARKER = '<!-- CHANGELOG_START -->';
const CHANGELOG_END_MARKER = '<!-- CHANGELOG_END -->';

// RFC-018: Phase order for insertion (ensures sections appear in correct order)
// PHASE_7 is base section created by Python Phase 7
// PHASE_X_DRAFT sections are temporary and get replaced by their final version
const PHASE_ORDER = [
  'PHASE_7',  // RFC-018: Base section from Python Phase 7
  'PHASE_8',  // RFC-018: Quantitative summary
  'PHASE_9_DRAFT', 'PHASE_9',
  'PHASE_10_DRAFT', 'PHASE_10',
  'PHASE_11_DRAFT', 'PHASE_11',
  'PHASE_12_DRAFT', 'PHASE_12',
  'PHASE_14_DRAFT', 'PHASE_14',
];

// ============================================================
// MAIN FUNCTION
// ============================================================

/**
 * Update a section in the student report.
 *
 * - If section exists: replace it
 * - If section doesn't exist: append in correct position
 * - Always updates changelog
 */
export async function updateStudentReportSection(
  options: UpdateSectionOptions
): Promise<UpdateResult> {
  const {
    reportPath,
    phaseId,
    sectionTitle,
    content,
    author = 'System',
    changeDescription,
  } = options;

  try {
    // Read existing report
    let reportContent: string;
    try {
      reportContent = await fs.readFile(reportPath, 'utf-8');
    } catch (error) {
      return {
        success: false,
        action: 'created',
        reportPath,
        error: `Report file not found: ${reportPath}. Run Phase 7 first.`,
      };
    }

    // Build section with markers
    const sectionWithMarkers = formatSectionWithMarkers(phaseId, sectionTitle, content);

    // Check if section already exists
    const existingSection = findSection(reportContent, phaseId);
    let action: 'created' | 'replaced' | 'appended';
    let newContent: string;

    if (existingSection) {
      // Replace existing section
      newContent = replaceSection(reportContent, phaseId, sectionWithMarkers);
      action = 'replaced';
    } else {
      // Append in correct position
      newContent = appendSectionInOrder(reportContent, phaseId, sectionWithMarkers);
      action = 'appended';
    }

    // Update changelog
    const changelogEntry: ChangelogEntry = {
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      phase: phaseId.replace('PHASE_', 'Phase '),
      change: changeDescription || `${action === 'replaced' ? 'Uppdaterade' : 'Lade till'} ${sectionTitle}`,
      author,
    };
    newContent = updateChangelog(newContent, changelogEntry);

    // Write back
    await fs.writeFile(reportPath, newContent, 'utf-8');

    return {
      success: true,
      action,
      reportPath,
    };
  } catch (error) {
    return {
      success: false,
      action: 'created',
      reportPath,
      error: `Failed to update report: ${error}`,
    };
  }
}

/**
 * Remove a section from the student report.
 * Used to clean up draft sections when finalizing.
 */
export async function removeStudentReportSection(
  reportPath: string,
  phaseId: string
): Promise<{ success: boolean; removed: boolean; error?: string }> {
  try {
    let reportContent: string;
    try {
      reportContent = await fs.readFile(reportPath, 'utf-8');
    } catch {
      return { success: true, removed: false }; // File doesn't exist, nothing to remove
    }

    const section = findSection(reportContent, phaseId);
    if (!section) {
      return { success: true, removed: false }; // Section doesn't exist
    }

    // Remove the section
    const before = reportContent.slice(0, section.start).trimEnd();
    const after = reportContent.slice(section.end).trimStart();

    const newContent = `${before}\n\n${after}`;

    await fs.writeFile(reportPath, newContent, 'utf-8');

    return { success: true, removed: true };
  } catch (error) {
    return { success: false, removed: false, error: `Failed to remove section: ${error}` };
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Format content with phase markers
 */
function formatSectionWithMarkers(
  phaseId: string,
  sectionTitle: string,
  content: string
): string {
  const startMarker = `<!-- ${phaseId}_START -->`;
  const endMarker = `<!-- ${phaseId}_END -->`;

  return `${startMarker}
## ${sectionTitle}

${content.trim()}

${endMarker}`;
}

/**
 * Find a section by its phase markers
 * Returns {start, end} indices or null if not found
 */
function findSection(
  content: string,
  phaseId: string
): { start: number; end: number } | null {
  const startMarker = `<!-- ${phaseId}_START -->`;
  const endMarker = `<!-- ${phaseId}_END -->`;

  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) return null;

  const endIndex = content.indexOf(endMarker, startIndex);
  if (endIndex === -1) return null;

  return {
    start: startIndex,
    end: endIndex + endMarker.length,
  };
}

/**
 * Replace an existing section
 */
function replaceSection(
  content: string,
  phaseId: string,
  newSection: string
): string {
  const section = findSection(content, phaseId);
  if (!section) return content;

  const before = content.slice(0, section.start);
  const after = content.slice(section.end);

  // Ensure proper spacing
  const trimmedBefore = before.trimEnd();
  const trimmedAfter = after.trimStart();

  return `${trimmedBefore}\n\n${newSection}\n\n${trimmedAfter}`;
}

/**
 * Append section in correct order based on phase
 */
function appendSectionInOrder(
  content: string,
  phaseId: string,
  newSection: string
): string {
  const phaseIndex = PHASE_ORDER.indexOf(phaseId);

  // Find the best insertion point
  // Look for the next phase that exists and insert before it
  for (let i = phaseIndex + 1; i < PHASE_ORDER.length; i++) {
    const nextPhase = PHASE_ORDER[i];
    const nextSection = findSection(content, nextPhase);
    if (nextSection) {
      // Insert before this section
      const before = content.slice(0, nextSection.start).trimEnd();
      const after = content.slice(nextSection.start);
      return `${before}\n\n${newSection}\n\n${after}`;
    }
  }

  // No later phase found - check for changelog
  const changelogIndex = content.indexOf(CHANGELOG_MARKER);
  if (changelogIndex !== -1) {
    // Insert before changelog
    const before = content.slice(0, changelogIndex).trimEnd();
    const after = content.slice(changelogIndex);
    return `${before}\n\n${newSection}\n\n${after}`;
  }

  // No changelog - append at end (before final ---)
  const lastSeparator = content.lastIndexOf('\n---\n');
  if (lastSeparator !== -1 && lastSeparator > content.length - 50) {
    const before = content.slice(0, lastSeparator).trimEnd();
    const after = content.slice(lastSeparator);
    return `${before}\n\n${newSection}\n${after}`;
  }

  // Just append at end
  return `${content.trimEnd()}\n\n${newSection}\n`;
}

/**
 * Update or create changelog section
 */
function updateChangelog(content: string, entry: ChangelogEntry): string {
  const changelogSection = findChangelogSection(content);
  const newEntry = `| ${entry.date} | ${entry.phase} | ${entry.change} | ${entry.author} |`;

  if (changelogSection) {
    // Add entry to existing changelog
    const { start, end, tableEnd } = changelogSection;
    const before = content.slice(0, tableEnd);
    const after = content.slice(tableEnd);
    return `${before}\n${newEntry}${after}`;
  } else {
    // Create new changelog section
    const changelogContent = `${CHANGELOG_MARKER}
## ÄNDRINGSLOGG

| Datum | Fas | Ändring | Av |
|-------|-----|---------|-----|
${newEntry}

${CHANGELOG_END_MARKER}`;

    // Append at end
    return `${content.trimEnd()}\n\n---\n\n${changelogContent}\n`;
  }
}

/**
 * Find changelog section
 */
function findChangelogSection(
  content: string
): { start: number; end: number; tableEnd: number } | null {
  const startIndex = content.indexOf(CHANGELOG_MARKER);
  if (startIndex === -1) {
    // Try to find changelog by header
    const headerIndex = content.indexOf('## ÄNDRINGSLOGG');
    if (headerIndex === -1) return null;

    // Find end of table (last row before next section or end)
    const afterHeader = content.slice(headerIndex);
    const lines = afterHeader.split('\n');
    let tableEndOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('|') || line.startsWith('#') && i > 0) {
        if (line.startsWith('|')) {
          tableEndOffset = headerIndex + lines.slice(0, i + 1).join('\n').length;
        }
      }
      if (line.startsWith('<!--') || (line.startsWith('#') && i > 2)) {
        break;
      }
    }

    return {
      start: headerIndex,
      end: content.length,
      tableEnd: tableEndOffset || headerIndex + 200,
    };
  }

  const endIndex = content.indexOf(CHANGELOG_END_MARKER, startIndex);

  // Find the last table row
  const sectionContent = content.slice(startIndex, endIndex !== -1 ? endIndex : undefined);
  const lastPipeIndex = sectionContent.lastIndexOf('|');
  const tableEnd = startIndex + lastPipeIndex + 1;

  // Find end of that line
  const afterPipe = content.slice(tableEnd);
  const newlineIndex = afterPipe.indexOf('\n');
  const actualTableEnd = tableEnd + (newlineIndex !== -1 ? newlineIndex : 0);

  return {
    start: startIndex,
    end: endIndex !== -1 ? endIndex + CHANGELOG_END_MARKER.length : content.length,
    tableEnd: actualTableEnd,
  };
}

// ============================================================
// EXPORTS
// ============================================================

export {
  findSection,
  replaceSection,
  formatSectionWithMarkers,
  updateChangelog,
};
