import { describe, expect, it } from 'vitest';
import { directorySharePercentages } from './directorySharePercentages';

describe('directory percentages', () => {
  it('retains small nonzero slices and the original denominator', () => {
    const rows = directorySharePercentages([
      { directoryId: 'large', name: 'Large', value: 999 },
      { directoryId: 'small', name: 'Small', value: 1 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].percentage).toBe(99.9);
    expect(rows[1].percentageLabel).toBe('<1%');
    expect(rows.reduce((sum, row) => sum + row.percentage, 0)).toBe(100);
  });
  it('does not invent shares from zero or invalid data', () => {
    expect(
      directorySharePercentages([
        { directoryId: 'zero', name: 'Zero', value: 0 },
        { directoryId: 'bad', name: 'Bad', value: NaN },
      ]),
    ).toEqual([]);
  });
});
