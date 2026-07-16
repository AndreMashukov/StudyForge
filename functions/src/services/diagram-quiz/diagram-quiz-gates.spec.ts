import { describe, expect, it } from 'vitest';
import { findSingleQuotedBracketLabels } from './diagram-quiz-gates';

describe('findSingleQuotedBracketLabels', () => {
  it('flags single-quoted bracket labels', () => {
    const source = `flowchart TD
  User['User Request'] --> Agent['LlmAgent']
  cfg['include_contents='none'']`;
    expect(findSingleQuotedBracketLabels(source)).toEqual([
      "['User Request']",
      "['LlmAgent']",
      "['include_contents='none'']",
    ]);
  });

  it('flags doubled single-quote wrappers', () => {
    expect(findSingleQuotedBracketLabels(`prompt[''History Only'']`)).toEqual([
      "[''History Only'']",
    ]);
  });

  it('allows plain and double-quoted labels', () => {
    const source = `flowchart TD
  User[User Request] --> Agent["LlmAgent"]
  cfg["include_contents=none"]
  A["path/with'apostrophe"]`;
    expect(findSingleQuotedBracketLabels(source)).toEqual([]);
  });
});
