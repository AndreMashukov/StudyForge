import { describe, expect, it } from 'vitest';
import { buildEmptyModelFallback } from './agent-chat-fallback';

describe('buildEmptyModelFallback', () => {
  it('returns a generic message when no tools ran', () => {
    expect(buildEmptyModelFallback([])).toBe(
      'I finished, but the model returned no text for this turn.'
    );
  });

  it('summarizes list_directories results with paths', () => {
    const text = buildEmptyModelFallback([
      {
        name: 'list_directories',
        ok: true,
        result: [
          { id: 'a', name: 'Python', path: '/Python' },
          { id: 'b', name: 'Screenshots', path: '/Python/Screenshots' },
        ],
      },
    ]);

    expect(text).toContain('Here is what I found from the tool steps:');
    expect(text).toContain('/Python');
    expect(text).toContain('/Python/Screenshots');
    expect(text).not.toContain('model returned no summary text');
  });

  it('summarizes create_directory with path', () => {
    const text = buildEmptyModelFallback([
      {
        name: 'create_directory',
        ok: true,
        result: { id: 'dir-1', name: 'Python', path: '/Python' },
      },
    ]);

    expect(text).toContain('Created directory "Python" at /Python');
  });

  it('includes tool failures', () => {
    const text = buildEmptyModelFallback([
      {
        name: 'create_directory',
        ok: false,
        error: 'Directory with this name already exists at this level',
      },
    ]);

    expect(text).toContain('create_directory failed:');
    expect(text).toContain('already exists');
  });
});
