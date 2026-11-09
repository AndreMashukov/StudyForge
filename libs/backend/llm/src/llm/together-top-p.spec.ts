import { describe, expect, it } from 'vitest';
import { topPInsideTogetherErrorRange } from './together-top-p';

const TOGETHER_TOP_P_ERROR =
  'Together API error 400: {"error":{"type":"invalid_request_error","code":"invalid_top_p","message":"top_p must be within [0.95, 1], got 0.9","param":null}}';

describe('topPInsideTogetherErrorRange', () => {
  it('raises 0.9 into the range Together reported', () => {
    expect(topPInsideTogetherErrorRange(0.9, TOGETHER_TOP_P_ERROR)).toBe(0.95);
  });

  it('lowers a value above the reported maximum', () => {
    expect(
      topPInsideTogetherErrorRange(
        1.2,
        'top_p must be within [0.95, 1], got 1.2',
      ),
    ).toBe(1);
  });

  it('does not retry when top_p is already inside the range', () => {
    expect(topPInsideTogetherErrorRange(0.95, TOGETHER_TOP_P_ERROR)).toBe(
      undefined,
    );
  });

  it('ignores unrelated Together errors', () => {
    expect(
      topPInsideTogetherErrorRange(0.9, 'Together API error 400: model not found'),
    ).toBe(undefined);
  });
});
