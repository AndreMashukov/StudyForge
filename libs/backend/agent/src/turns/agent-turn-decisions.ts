import {
  AGENT_TURN_HEARTBEAT_STALE_MS,
  AGENT_TURN_QUEUED_STALE_MS,
  isAgentTurnTerminal,
} from '@shared-types';
import {
  agentTurnLastActivityMs,
  type AgentTurnRecord,
} from './agent-turn-record';

/**
 * Total Cloud Tasks attempts for an agent turn. Kept at 1 until mutating tool
 * calls are idempotent across attempts; a retry would otherwise replay the last
 * superstep that was not checkpointed and could, for example, create a
 * document twice. The stale sweep finalizes turns whose worker died.
 */
export const MAX_AGENT_TURN_ATTEMPTS = 1;

/** Sweep thresholds: looser than the client "stuck" hints so the sweep never races a live worker. */
export const AGENT_TURN_SWEEP_QUEUED_STALE_MS = 5 * 60_000;
export const AGENT_TURN_SWEEP_RUNNING_STALE_MS = 3 * 60_000;

/**
 * A queued turn whose task Cloud Tasks accepted can legitimately wait for a
 * dispatch slot when the queue is busy, so it gets a much longer allowance
 * than one whose task was never confirmed.
 */
export const AGENT_TURN_SWEEP_ENQUEUED_STALE_MS = 30 * 60_000;
export const AGENT_TURN_CLIENT_ENQUEUED_STALE_MS = 10 * 60_000;

export interface IAgentTurnStaleThresholds {
  /** Queued, and the task was never confirmed as accepted. */
  queuedMs: number;
  /** Queued, with an accepted task waiting for dispatch. */
  enqueuedMs: number;
  runningMs: number;
}

export const AGENT_TURN_CLIENT_STALE_THRESHOLDS: IAgentTurnStaleThresholds = {
  queuedMs: AGENT_TURN_QUEUED_STALE_MS,
  enqueuedMs: AGENT_TURN_CLIENT_ENQUEUED_STALE_MS,
  runningMs: AGENT_TURN_HEARTBEAT_STALE_MS,
};

export const AGENT_TURN_SWEEP_STALE_THRESHOLDS: IAgentTurnStaleThresholds = {
  queuedMs: AGENT_TURN_SWEEP_QUEUED_STALE_MS,
  enqueuedMs: AGENT_TURN_SWEEP_ENQUEUED_STALE_MS,
  runningMs: AGENT_TURN_SWEEP_RUNNING_STALE_MS,
};

/** True when a non-terminal turn shows no progress for longer than the threshold. */
export function isAgentTurnStale(
  turn: AgentTurnRecord,
  nowMs: number,
  thresholds: IAgentTurnStaleThresholds,
): boolean {
  if (isAgentTurnTerminal(turn.status)) {
    return false;
  }
  if (turn.status === 'queued') {
    const allowanceMs = turn.enqueuedAt
      ? thresholds.enqueuedMs
      : thresholds.queuedMs;
    return nowMs - turn.createdAt.toMillis() > allowanceMs;
  }
  return nowMs - agentTurnLastActivityMs(turn) > thresholds.runningMs;
}

export type AgentTurnStartDecision =
  | { type: 'create' }
  | { type: 'in-progress'; activeTurnId: string }
  | { type: 'replace-stale'; staleTurn: AgentTurnRecord };

/**
 * One active turn per thread. A previous turn that is still live blocks the
 * start; one that looks dead is failed and replaced.
 */
export function decideAgentTurnStart(input: {
  turnId: string;
  activeTurnId: string | null;
  activeTurn: AgentTurnRecord | null;
  nowMs: number;
}): AgentTurnStartDecision {
  if (!input.activeTurnId || input.activeTurnId === input.turnId) {
    return { type: 'create' };
  }
  const active = input.activeTurn;
  if (!active || isAgentTurnTerminal(active.status)) {
    return { type: 'create' };
  }
  if (isAgentTurnStale(active, input.nowMs, AGENT_TURN_CLIENT_STALE_THRESHOLDS)) {
    return { type: 'replace-stale', staleTurn: active };
  }
  return { type: 'in-progress', activeTurnId: input.activeTurnId };
}

export type AgentTurnClaimDecision =
  | { type: 'claim' }
  | { type: 'reclaim' }
  | { type: 'skip'; reason: 'missing' | 'terminal' | 'duplicate-dispatch' }
  | { type: 'finalize-cancelled' }
  | { type: 'fail-exhausted' };

/** What a worker dispatch does with the turn it was handed. */
export function decideAgentTurnClaim(input: {
  turn: AgentTurnRecord | null;
  retryCount: number;
  nowMs: number;
  maxAttempts: number;
}): AgentTurnClaimDecision {
  const { turn } = input;
  if (!turn) {
    return { type: 'skip', reason: 'missing' };
  }
  if (isAgentTurnTerminal(turn.status)) {
    return { type: 'skip', reason: 'terminal' };
  }
  if (turn.status === 'queued') {
    return turn.cancelRequested
      ? { type: 'finalize-cancelled' }
      : { type: 'claim' };
  }

  // Running. A first dispatch that finds a live run is a duplicate delivery.
  const live =
    input.nowMs - agentTurnLastActivityMs(turn) <=
    AGENT_TURN_HEARTBEAT_STALE_MS;
  if (input.retryCount === 0 && live) {
    return { type: 'skip', reason: 'duplicate-dispatch' };
  }
  if (turn.cancelRequested) {
    return { type: 'finalize-cancelled' };
  }
  if (turn.attempt >= input.maxAttempts) {
    return { type: 'fail-exhausted' };
  }
  return { type: 'reclaim' };
}

export type AgentTurnCancelDecision =
  | { type: 'noop' }
  | { type: 'finalize' }
  | { type: 'request' };

/**
 * Stop: a queued or dead turn is finalized right away; a live running turn is
 * flagged and its worker stops within a couple of seconds.
 */
export function decideAgentTurnCancel(
  turn: AgentTurnRecord,
  nowMs: number,
): AgentTurnCancelDecision {
  if (isAgentTurnTerminal(turn.status)) {
    return { type: 'noop' };
  }
  if (turn.status === 'queued') {
    return { type: 'finalize' };
  }
  if (isAgentTurnStale(turn, nowMs, AGENT_TURN_CLIENT_STALE_THRESHOLDS)) {
    return { type: 'finalize' };
  }
  return { type: 'request' };
}
