import { describe, it, expect, vi } from 'vitest';

// Make every candidate location of the detection instructions unreadable,
// while leaving all other file reads untouched.
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    readFile: async (file: Parameters<typeof actual.readFile>[0], ...rest: unknown[]) => {
      if (String(file).includes('phase6_post_format_detection')) {
        throw Object.assign(new Error(`ENOENT: no such file, open '${String(file)}'`), { code: 'ENOENT' });
      }
      return (actual.readFile as (...args: unknown[]) => unknown)(file, ...rest);
    },
  };
});

const { loadPostFormatMethodology } = await import('../src/tools/phase6_post_format.js');

// The methodology document is the source of truth (code-as-plumber rule). When
// it cannot be loaded, the tool must stop and name the missing file, not carry
// on with instructions written into the code.
describe('phase6_post_format without its methodology document', () => {
  it('throws an error that names the missing methodology file', async () => {
    await expect(loadPostFormatMethodology()).rejects.toThrow(
      /methodology\/technical\/phase6_post_format_detection\.md/,
    );
  });

});
