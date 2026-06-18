/**
 * Finding A guard: the workspace boundary (RFC-035) is enforced at dispatch on
 * an allowlist of argument NAMES (PATH_ARG_NAMES). Any path-typed tool argument
 * whose name isn't on that list silently bypasses the boundary. This test
 * fails if a tool declares a `*_path` / `*_dir` / `*_folder` argument that is
 * not workspace-enforced — which is how `exam_config_path` slipped through.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const serverSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/server.ts'),
  'utf8'
);

function declaredPathArgNames(src: string): Set<string> {
  const m = src.match(/const PATH_ARG_NAMES\s*=\s*\[([\s\S]*?)\];/);
  if (!m) throw new Error('PATH_ARG_NAMES declaration not found in server.ts');
  return new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
}

function pathLikeArgNames(src: string): Set<string> {
  const names = new Set<string>();
  // schema property declarations like `  exam_config_path: {`
  for (const m of src.matchAll(
    /^\s+([a-z][a-z0-9_]*(?:_path|_dir|_folder|_directory)):\s*\{/gm
  )) {
    names.add(m[1]);
  }
  return names;
}

describe('PATH_ARG_NAMES covers every path-typed tool argument (finding A)', () => {
  it('every *_path/_dir/_folder argument is workspace-enforced', () => {
    const declared = declaredPathArgNames(serverSrc);
    const uncovered = [...pathLikeArgNames(serverSrc)].filter((n) => !declared.has(n));
    expect(
      uncovered,
      `path-typed tool args missing from PATH_ARG_NAMES (would bypass the workspace boundary): ${uncovered.join(
        ', '
      )}`
    ).toEqual([]);
  });
});
