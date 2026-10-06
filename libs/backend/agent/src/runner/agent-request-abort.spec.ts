import { describe, expect, it } from 'vitest';
import {
  AgentRequestAbortedError,
  isAbortSignal,
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
