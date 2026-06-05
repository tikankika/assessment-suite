import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { loadProjectState } from '../src/shared/project_state_manager.js';

const TEST_DIR = '/tmp/project_state_manager_test';

describe('loadProjectState', () => {
  afterAll(async () => {
    try { await fs.rm(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
  });

  it('throws a clear, actionable error on corrupt project_state.json', async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.writeFile(join(TEST_DIR, 'project_state.json'), '{ this is : not valid json', 'utf-8');
    // Must name the file (not a raw "Unexpected token" SyntaxError).
    await expect(loadProjectState(TEST_DIR)).rejects.toThrow(/project_state\.json/);
  });

  it('loads a valid project_state.json', async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.writeFile(join(TEST_DIR, 'project_state.json'), JSON.stringify({ current_phase: 6 }), 'utf-8');
    const state = await loadProjectState(TEST_DIR);
    expect(state).toBeTruthy();
  });
});
