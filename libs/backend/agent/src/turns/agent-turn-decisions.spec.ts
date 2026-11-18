import { describe, expect, it } from 'vitest';
import {
  AGENT_TURN_CLIENT_STALE_THRESHOLDS,
  AGENT_TURN_SWEEP_STALE_THRESHOLDS,
  decideAgentTurnCancel,
  decideAgentTurnClaim,
  decideAgentTurnStart,
  isAgentTurnStale,
} from './agent-turn-decisions';
import {
  makeAgentTurnRecord,
  msAgo,
  TURN_FIXTURE_NOW_MS,
} from './agent-turn-test-fixtures';

const NOW = TURN_FIXTURE_NOW_MS;

describe('isAgentTurnStale', () => {
  it('never treats a terminal turn as stale', () => {
    const turn = makeAgentTurnRecord({
      status: 'completed',
      updatedAt: msAgo(60 * 60_000),
    });
    expect(isAgentTurnStale(turn, NOW, AGENT_TURN_SWEEP_STALE_THRESHOLDS)).toBe(
      false,
    );
  });

  it('measures a queued turn from creation', () => {
    const fresh = makeAgentTurnRecord({ createdAt: msAgo(60_000) });
    const old = makeAgentTurnRecord({ createdAt: msAgo(6 * 60_000) });
    expect(isAgentTurnStale(fresh, NOW, AGENT_TURN_SWEEP_STALE_THRESHOLDS)).toBe(
      false,
    );
    expect(isAgentTurnStale(old, NOW, AGENT_TURN_SWEEP_STALE_THRESHOLDS)).toBe(
      true,
    );
  });

  it('measures a running turn from its heartbeat', () => {
    const turn = makeAgentTurnRecord({
      status: 'running',
      updatedAt: msAgo(10 * 60_000),
      heartbeatAt: msAgo(5_000),
    });
    expect(isAgentTurnStale(turn, NOW, AGENT_TURN_CLIENT_STALE_THRESHOLDS)).toBe(
      false,
    );
    expect(
      isAgentTurnStale(
        { ...turn, heartbeatAt: msAgo(4 * 60_000) },
        NOW,
        AGENT_TURN_SWEEP_STALE_THRESHOLDS,
      ),
    ).toBe(true);
  });
});

describe('decideAgentTurnStart', () => {
  it('creates when the thread has no active turn', () => {
    expect(
      decideAgentTurnStart({
        turnId: 'turn-0002',
        activeTurnId: null,
        activeTurn: null,
        nowMs: NOW,
      }),
    ).toEqual({ type: 'create' });
  });

  it('creates when the active turn already finished', () => {
    expect(
      decideAgentTurnStart({
        turnId: 'turn-0002',
        activeTurnId: 'turn-0001',
        activeTurn: makeAgentTurnRecord({ status: 'completed' }),
        nowMs: NOW,
      }),
    ).toEqual({ type: 'create' });
  });

  it('blocks while another turn is live', () => {
    expect(
      decideAgentTurnStart({
        turnId: 'turn-0002',
        activeTurnId: 'turn-0001',
        activeTurn: makeAgentTurnRecord({
          status: 'running',
          heartbeatAt: msAgo(3_000),
        }),
        nowMs: NOW,
      }),
    ).toEqual({ type: 'in-progress', activeTurnId: 'turn-0001' });
  });

  it('replaces a dead active turn', () => {
    const stale = makeAgentTurnRecord({
      status: 'running',
      heartbeatAt: msAgo(5 * 60_000),
    });
    expect(
      decideAgentTurnStart({
        turnId: 'turn-0002',
        activeTurnId: 'turn-0001',
        activeTurn: stale,
        nowMs: NOW,
      }),
    ).toEqual({ type: 'replace-stale', staleTurn: stale });
  });
});

describe('decideAgentTurnClaim', () => {
  const base = { retryCount: 0, nowMs: NOW, maxAttempts: 2 };

  it('skips a missing or finished turn', () => {
    expect(decideAgentTurnClaim({ ...base, turn: null })).toEqual({
      type: 'skip',
      reason: 'missing',
    });
    expect(
      decideAgentTurnClaim({
        ...base,
        turn: makeAgentTurnRecord({ status: 'cancelled' }),
      }),
    ).toEqual({ type: 'skip', reason: 'terminal' });
  });

  it('claims a queued turn', () => {
    expect(
      decideAgentTurnClaim({ ...base, turn: makeAgentTurnRecord() }),
    ).toEqual({ type: 'claim' });
  });

  it('cancels a queued turn the user already stopped', () => {
    expect(
      decideAgentTurnClaim({
        ...base,
        turn: makeAgentTurnRecord({ cancelRequested: true }),
      }),
    ).toEqual({ type: 'finalize-cancelled' });
  });

  it('ignores a duplicate first dispatch of a live run', () => {
    expect(
      decideAgentTurnClaim({
        ...base,
        turn: makeAgentTurnRecord({
          status: 'running',
          attempt: 1,
          heartbeatAt: msAgo(2_000),
        }),
      }),
    ).toEqual({ type: 'skip', reason: 'duplicate-dispatch' });
  });

  it('reclaims a running turn on retry while attempts remain', () => {
    expect(
      decideAgentTurnClaim({
        ...base,
        retryCount: 1,
        turn: makeAgentTurnRecord({
          status: 'running',
          attempt: 1,
          heartbeatAt: msAgo(2_000),
        }),
      }),
    ).toEqual({ type: 'reclaim' });
  });

  it('fails a turn that used all its attempts', () => {
    expect(
      decideAgentTurnClaim({
        ...base,
        retryCount: 1,
        turn: makeAgentTurnRecord({ status: 'running', attempt: 2 }),
      }),
    ).toEqual({ type: 'fail-exhausted' });
  });
});

describe('decideAgentTurnCancel', () => {
  it('does nothing for a finished turn', () => {
    expect(
      decideAgentTurnCancel(makeAgentTurnRecord({ status: 'failed' }), NOW),
    ).toEqual({ type: 'noop' });
  });

  it('finalizes a queued turn right away', () => {
    expect(decideAgentTurnCancel(makeAgentTurnRecord(), NOW)).toEqual({
      type: 'finalize',
    });
  });

  it('flags a live running turn for its worker', () => {
    expect(
      decideAgentTurnCancel(
        makeAgentTurnRecord({ status: 'running', heartbeatAt: msAgo(1_000) }),
        NOW,
      ),
    ).toEqual({ type: 'request' });
  });

  it('finalizes a running turn whose worker went quiet', () => {
    expect(
      decideAgentTurnCancel(
        makeAgentTurnRecord({
          status: 'running',
          heartbeatAt: msAgo(2 * 60_000),
        }),
        NOW,
      ),
    ).toEqual({ type: 'finalize' });
  });
});
