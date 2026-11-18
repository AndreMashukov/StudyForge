import { describe, expect, it } from 'vitest';
import {
  AgentRequestAbortedError,
  isAbortSignal,
  readAgentTurnAbortReason,
  throwIfAgentRequestAborted,
} from './agent-request-abort';

describe('throwIfAgentRequestAborted', () => {
  it('does nothing when the signal is missing or open', () => {
    expect(() => throwIfAgentRequestAborted()).not.toThrow();
    expect(() =>
      throwIfAgentRequestAborted(new AbortController().signal),
    ).not.toThrow();
  });

  it('throws when the signal is aborted', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => throwIfAgentRequestAborted(controller.signal)).toThrow(
      AgentRequestAbortedError,
    );
  });
});

describe('isAbortSignal', () => {
  it('accepts AbortSignal instances', () => {
    expect(isAbortSignal(new AbortController().signal)).toBe(true);
    expect(isAbortSignal({})).toBe(false);
  });
});

describe('readAgentTurnAbortReason', () => {
  it('returns null while the signal is open', () => {
    expect(readAgentTurnAbortReason(new AbortController().signal)).toBeNull();
    expect(readAgentTurnAbortReason()).toBeNull();
  });

  it('reads a known reason', () => {
    const controller = new AbortController();
    controller.abort('deadline');
    expect(readAgentTurnAbortReason(controller.signal)).toBe('deadline');
  });

  it('treats an unknown reason as a cancel', () => {
    const controller = new AbortController();
    controller.abort();
    expect(readAgentTurnAbortReason(controller.signal)).toBe('cancel');
  });
});
