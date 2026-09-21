import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateSessionId } from '../src/core/base_session_manager.js';

describe('generateSessionId', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the <prefix>_<student>_<timestamp>_<random> format', () => {
    expect(generateSessionId('phase10', 'student-a')).toMatch(/^phase10_student-a_\d+_[0-9a-f]{12}$/);
  });

  it('does not use Math.random, which is not a cryptographic source', () => {
    const spy = vi.spyOn(Math, 'random');
    generateSessionId('phase10', 'student-a');
    expect(spy).not.toHaveBeenCalled();
  });

  it('produces distinct IDs for the same student within the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const ids = new Set(Array.from({ length: 200 }, () => generateSessionId('phase10', 'student-a')));
    expect(ids.size).toBe(200);
  });
});
