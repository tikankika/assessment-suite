import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import {
  deriveProjectPath,
  logWorkflowAction,
  safeStateOperation,
} from '../shared/project_state_manager.js';

/**
 * process_memo - Save a process memo during assessment work
 *
 * Captures decisions, conventions, observations, and uncertainties
 * that arise during the assessment process. Examples:
 * - "stu1 skriver 1, istället för 1. — vi tolkar det som fråga 1"
 * - "Vi placerar markers före frågenumret, inte efter"
 * - "Tveksam på gränsen mellan E och C för Q003a"
 *
 * Saves timestamped markdown files to _process_memos/ in the project root.
 * Cross-references in workflow_log.
 */

export interface ProcessMemoInput {
  project_path: string;
  note: string;
  phase?: number;
  memo_type?: 'decision' | 'convention' | 'observation' | 'uncertainty';
  related_students?: string[];
  related_questions?: string[];
}

export interface ProcessMemoResult {
  success: boolean;
  memo_path: string;
  memo_count: number;
  timestamp: string;
}

export async function processMemo(args: ProcessMemoInput): Promise<ProcessMemoResult> {
  const {
    project_path,
    note,
    phase,
    memo_type = 'observation',
    related_students,
    related_questions,
  } = args;

  if (!note || note.trim().length === 0) {
    throw new Error('Memo text is required');
  }

  const stateProjectPath = await deriveProjectPath(project_path);
  const projectRoot = stateProjectPath || project_path;

  const memoDir = join(projectRoot, '_process_memos');
  await fs.mkdir(memoDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const fileTimestamp = timestamp.replace(/[:.]/g, '-').replace('Z', '');
  const memoFilename = `memo_${fileTimestamp}.md`;
  const memoPath = join(memoDir, memoFilename);

  // Build markdown content
  const lines: string[] = [];
  lines.push('---');
  lines.push(`type: process_memo`);
  lines.push(`created: ${timestamp}`);
  lines.push(`date: ${timestamp.split('T')[0]}`);
  lines.push(`memo_type: ${memo_type}`);
  if (phase) lines.push(`phase: ${phase}`);
  if (related_students?.length) lines.push(`related_students: [${related_students.join(', ')}]`);
  if (related_questions?.length) lines.push(`related_questions: [${related_questions.join(', ')}]`);
  lines.push(`metadata_version: "1.0"`);
  lines.push('provenance:');
  lines.push('  tool: process_memo');
  lines.push('  ai_assisted: true');
  lines.push('---');
  lines.push('');
  lines.push(`# Processmemo — ${memo_type}`);
  lines.push('');
  lines.push(note.trim());
  lines.push('');

  await fs.writeFile(memoPath, lines.join('\n'), 'utf-8');

  // Count existing memos
  let memoCount = 0;
  try {
    const files = await fs.readdir(memoDir);
    memoCount = files.filter(f => f.startsWith('memo_') && f.endsWith('.md')).length;
  } catch {
    memoCount = 1;
  }

  // Log to workflow_log
  if (stateProjectPath) {
    await safeStateOperation(
      () => logWorkflowAction(
        stateProjectPath,
        phase || 0,
        'process_memo',
        'memo_save',
        {
          memo_type,
          note_length: note.length,
          related_students,
          related_questions,
        },
        {
          saved_to: memoPath,
          memo_count: memoCount,
          success: true,
        }
      ),
      'process_memo logWorkflowAction'
    );
  }

  return {
    success: true,
    memo_path: memoPath,
    memo_count: memoCount,
    timestamp,
  };
}
