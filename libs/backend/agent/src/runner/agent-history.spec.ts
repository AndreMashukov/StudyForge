import { describe, expect, it } from 'vitest';
import { withExecutedActionContext } from './agent-history';

describe('withExecutedActionContext', () => {
  it('returns the reply unchanged when no actions ran', () => {
    expect(withExecutedActionContext('Started generating.')).toBe(
      'Started generating.',
    );
    expect(withExecutedActionContext('Started generating.', [])).toBe(
      'Started generating.',
    );
  });

  it('appends document ids from executed actions for later turns', () => {
    expect(
      withExecutedActionContext(
        'Started generating document "Knowledge Gaps Recap".',
        [
          {
            kind: 'create_document',
            summary: 'Started document generation for "Knowledge Gaps Recap"',
            entityId: 'HBETddUOzkX4G2ILTCGD',
            jobId: 'job-1',
          },
        ],
      ),
    ).toBe(
      [
        'Started generating document "Knowledge Gaps Recap".',
        '',
        '[Executed actions]',
        '- create_document id=HBETddUOzkX4G2ILTCGD jobId=job-1 Started document generation for "Knowledge Gaps Recap"',
      ].join('\n'),
    );
  });
});
