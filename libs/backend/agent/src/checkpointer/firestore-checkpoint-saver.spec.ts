import { describe, expect, it } from 'vitest';
import type { Checkpoint } from '@langchain/langgraph-checkpoint';
import {
  applyOverflowChannelValues,
  CheckpointOverflowUnavailableError,
} from './firestore-checkpoint-saver';

function emptyCheckpoint(): Checkpoint {
  return {
    v: 4,
    id: 'cp-1',
    ts: new Date().toISOString(),
    channel_values: {},
    channel_versions: {},
    versions_seen: {},
  };
}

describe('applyOverflowChannelValues', () => {
  it('rejects missing overflow channel values', () => {
    expect(() => applyOverflowChannelValues(emptyCheckpoint(), undefined)).toThrow(
      CheckpointOverflowUnavailableError,
    );
  });

  it('restores overflow channel values onto the checkpoint', () => {
    const checkpoint = applyOverflowChannelValues(emptyCheckpoint(), {
      finalReply: 'ok',
    });
    expect(checkpoint.channel_values).toEqual({ finalReply: 'ok' });
  });
});
