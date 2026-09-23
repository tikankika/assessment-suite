import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ADR-006 moved question detection to 2B, answer boundaries to 2C and student
// discovery to 2D. A retired label or tool name in text the server hands to
// the model sends it looking for a phase or a tool that no longer exists.
//
// 4D and 4E are gone outright. 4A was reassigned, not retired — Phase 4a is now
// rubric construction, methodology only — so only "4A" as question detection
// is stale. 4B and 4C survived the renumbering.
//
// A line that cites ADR-006 is exempt: those comments record where a phase
// came from, which is the one place the old numbers still belong.

const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');

// Labels: "Phase 4D", "Phase 4E", "Phase 4A … question".
// Tool names: the phase4a_/4d_/4e_ family, phase4c_report and its longer
// predecessor, and phase2c_answer_boundaries — the registered tool is
// phase2c_boundaries; the .md of that name is the methodology file.
const RETIRED =
  /\bphase\s+4[de]\b|\bphase\s+4a[:\s]+question|\bphase4[ade]_\w+|\bphase4c_(student_)?report\b|\bphase2c_answer_boundaries\b(?!\.md)/i;

const EXEMPT = /ADR-006/;

async function tsFilesUnder(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return tsFilesUnder(full);
      return entry.name.endsWith('.ts') ? [full] : [];
    })
  );
  return files.flat();
}

describe('retired phase labels and tool names', () => {
  it('do not appear anywhere under src/', async () => {
    const files = await tsFilesUnder(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);

    const offences: string[] = [];
    for (const file of files) {
      const lines = (await fs.readFile(file, 'utf-8')).split('\n');
      lines.forEach((line, index) => {
        if (!EXEMPT.test(line) && RETIRED.test(line)) {
          offences.push(`${path.relative(SRC_DIR, file)}:${index + 1}: ${line.trim()}`);
        }
      });
    }

    expect(offences).toEqual([]);
  });
});
