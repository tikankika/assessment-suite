import { describe, it, expect } from 'vitest';
import { escapeRegex } from '../src/utils/regex_utils.js';

/**
 * Tests for regex security — escapeRegex prevents ReDoS attacks
 * when user-controlled strings are interpolated into RegExp.
 */

describe('escapeRegex', () => {
  it('escapes all special regex characters', () => {
    const special = '.*+?^${}()|[]\\';
    const escaped = escapeRegex(special);
    // Should not throw when used in RegExp
    expect(() => new RegExp(escaped)).not.toThrow();
    // Each char should be escaped with backslash
    expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('leaves normal strings unchanged', () => {
    expect(escapeRegex('Q001')).toBe('Q001');
    expect(escapeRegex('hello world')).toBe('hello world');
  });

  it('prevents ReDoS via question IDs', () => {
    // An attacker could craft a question_id that causes catastrophic backtracking
    const malicious = '(a+)+$';
    const escaped = escapeRegex(malicious);

    // The escaped version should be a safe literal match
    const regex = new RegExp(`^Question\\s+${escaped}[:\\s]`, 'i');

    // This should complete instantly (not hang)
    const start = Date.now();
    regex.test('Question (a+)+$ : something');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100); // Should be < 1ms
  });

  it('handles question IDs with parentheses', () => {
    const qid = 'Q1(a)';
    const escaped = escapeRegex(qid);
    const regex = new RegExp(`^##\\s*Fråga\\s+${escaped}`, 'i');

    expect(regex.test('## Fråga Q1(a)')).toBe(true);
    expect(regex.test('## Fråga Q1a')).toBe(false);
  });

  it('handles question IDs with brackets', () => {
    const qid = 'Q[1]';
    const escaped = escapeRegex(qid);
    const regex = new RegExp(`Question\\s+${escaped}`, 'i');

    expect(regex.test('Question Q[1]')).toBe(true);
    expect(regex.test('Question Q1')).toBe(false);
  });
});
