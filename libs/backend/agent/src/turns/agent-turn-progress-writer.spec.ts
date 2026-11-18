import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentData } from 'firebase-admin/firestore';

vi.mock('firebase-functions/v2', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { AgentTurnProgressWriter } from './agent-turn-progress-writer';

interface IFakeTurnRef {
  update: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  writes: DocumentData[];
  doc: DocumentData;
}

function createFakeTurnRef(doc: DocumentData): IFakeTurnRef {
  const writes: DocumentData[] = [];
  const ref: IFakeTurnRef = {
    writes,
    doc,
    update: vi.fn(async (data: DocumentData) => {
      writes.push(data);
    }),
    get: vi.fn(async () => ({ data: () => ref.doc })),
  };
  return ref;
}

const TIMINGS = {
  deltaFlushMs: 800,
  eventFlushMs: 250,
  heartbeatMs: 10_000,
  controlPollMs: 2_000,
};

describe('AgentTurnProgressWriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createWriter(ref: IFakeTurnRef, onControl = vi.fn()) {
    const writer = new AgentTurnProgressWriter({
      turnRef: ref,
      leaseId: 'lease-1',
      onControl,
      timings: TIMINGS,
    });
    writer.start();
    return { writer, onControl };
  }

  it('coalesces reply deltas into one write per flush window', async () => {
    const ref = createFakeTurnRef({ status: 'running', leaseId: 'lease-1' });
    const { writer } = createWriter(ref);

    writer.push({ type: 'delta', text: 'Hel' });
    writer.push({ type: 'delta', text: 'lo' });
    await vi.advanceTimersByTimeAsync(799);
    expect(ref.writes).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(ref.writes).toHaveLength(1);
    expect(ref.writes[0].reply).toBe('Hello');

    await writer.close();
  });

  it('flushes status and actions sooner than reply text', async () => {
    const ref = createFakeTurnRef({ status: 'running', leaseId: 'lease-1' });
    const { writer } = createWriter(ref);

    writer.push({ type: 'delta', text: 'Working' });
    writer.push({
      type: 'action',
      action: { kind: 'create_document', summary: 'Created notes', entityId: 'doc-1' },
    });
    await vi.advanceTimersByTimeAsync(250);

    expect(ref.writes).toHaveLength(1);
    expect(ref.writes[0].reply).toBe('Working');
    expect(ref.writes[0].executedActions).toEqual([
      { kind: 'create_document', summary: 'Created notes', entityId: 'doc-1' },
    ]);

    await writer.close();
  });

  it('dedupes repeated actions and cards', async () => {
    const ref = createFakeTurnRef({ status: 'running', leaseId: 'lease-1' });
    const { writer } = createWriter(ref);
    const action = { kind: 'generate_quiz' as const, summary: 'Quiz', entityId: 'q-1' };

    writer.push({ type: 'action', action });
    writer.push({ type: 'action', action });
    writer.push({ type: 'reference', item: { itemType: 'quiz', id: 'q-1', title: 'Quiz' } });
    writer.push({ type: 'reference', item: { itemType: 'quiz', id: 'q-1', title: 'Quiz' } });
    await writer.close();

    expect(ref.writes).toHaveLength(1);
    expect(ref.writes[0].executedActions).toHaveLength(1);
    expect(ref.writes[0].referencedItems).toHaveLength(1);
  });

  it('never has two writes in flight', async () => {
    const ref = createFakeTurnRef({ status: 'running', leaseId: 'lease-1' });
    let inFlight = 0;
    let maxInFlight = 0;
    ref.update.mockImplementation(async (data: DocumentData) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 600));
      ref.writes.push(data);
      inFlight -= 1;
    });
    const { writer } = createWriter(ref);

    writer.push({ type: 'status', message: 'One' });
    await vi.advanceTimersByTimeAsync(250);
    writer.push({ type: 'status', message: 'Two' });
    await vi.advanceTimersByTimeAsync(250);
    writer.push({ type: 'status', message: 'Three' });
    const closing = writer.close();
    await vi.advanceTimersByTimeAsync(5_000);
    await closing;

    expect(maxInFlight).toBe(1);
    expect(ref.writes.map((write) => write.statusMessage)).toEqual([
      'One',
      'Two',
      'Three',
    ]);
  });

  it('sends a heartbeat when nothing else was written', async () => {
    const ref = createFakeTurnRef({ status: 'running', leaseId: 'lease-1' });
    const { writer } = createWriter(ref);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(ref.writes).toHaveLength(1);
    expect(ref.writes[0].heartbeatAt).toBeDefined();
    expect(ref.writes[0].reply).toBeUndefined();

    await writer.close();
  });

  it('aborts with cancel when Stop is requested', async () => {
    const ref = createFakeTurnRef({ status: 'running', leaseId: 'lease-1' });
    const { writer, onControl } = createWriter(ref);

    ref.doc = { status: 'running', leaseId: 'lease-1', cancelRequested: true };
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onControl).toHaveBeenCalledWith('cancel');

    await vi.advanceTimersByTimeAsync(4_000);
    expect(onControl).toHaveBeenCalledTimes(1);
    await writer.close();
  });

  it('aborts as superseded when another attempt takes the lease', async () => {
    const ref = createFakeTurnRef({ status: 'running', leaseId: 'lease-1' });
    const { writer, onControl } = createWriter(ref);

    ref.doc = { status: 'running', leaseId: 'lease-2' };
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onControl).toHaveBeenCalledWith('superseded');
    await writer.close();
  });

  it('ignores events after close and writes the last dirty state on close', async () => {
    const ref = createFakeTurnRef({ status: 'running', leaseId: 'lease-1' });
    const { writer } = createWriter(ref);

    writer.push({ type: 'delta', text: 'Final words' });
    await writer.close();
    writer.push({ type: 'delta', text: ' ignored' });
    await vi.advanceTimersByTimeAsync(5_000);

    expect(ref.writes).toHaveLength(1);
    expect(ref.writes[0].reply).toBe('Final words');
  });

  it('retries a failed write on the next flush', async () => {
    const ref = createFakeTurnRef({ status: 'running', leaseId: 'lease-1' });
    ref.update.mockRejectedValueOnce(new Error('unavailable'));
    const { writer } = createWriter(ref);

    writer.push({ type: 'status', message: 'Planning...' });
    await vi.advanceTimersByTimeAsync(250);
    expect(ref.writes).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(250);
    expect(ref.writes).toHaveLength(1);
    expect(ref.writes[0].statusMessage).toBe('Planning...');
    await writer.close();
  });
});
