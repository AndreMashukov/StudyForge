import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import type {
  AgentActionResult,
  AgentProposedDelete,
  AgentReferencedItem,
} from '@shared-types';
import { isAgentTurnTerminal, agentTurnStatusSchema } from '@shared-types';
import type { AgentTurnProgressEvent } from '../directory-agent-service';
import type { AgentTurnAbortReason } from '../runner/agent-request-abort';
import {
  agentActionKey,
  agentDeleteKey,
  agentReferenceKey,
  serializeAgentActions,
  serializeAgentDeletes,
  serializeAgentReferences,
} from './agent-turn-record';

/** The slice of a Firestore DocumentReference the writer needs (fakeable in tests). */
export interface IAgentTurnDocHandle {
  update(data: DocumentData): Promise<unknown>;
  get(): Promise<{ data(): DocumentData | undefined }>;
}

export interface IAgentTurnProgressWriterTimings {
  /** Reply text flushes at most this often. */
  deltaFlushMs: number;
  /** Status, action and card changes flush at most this often. */
  eventFlushMs: number;
  /** Heartbeat-only write after this long without any write. */
  heartbeatMs: number;
  /** How often the worker re-reads the turn for Stop and lease changes. */
  controlPollMs: number;
}

export const DEFAULT_AGENT_TURN_PROGRESS_TIMINGS: IAgentTurnProgressWriterTimings =
  {
    deltaFlushMs: 800,
    eventFlushMs: 250,
    heartbeatMs: 10_000,
    controlPollMs: 2_000,
  };

/** Firestore's document limit is 1 MiB; the live reply never needs to get close. */
const MAX_LIVE_REPLY_CHARS = 100_000;

export interface IAgentTurnProgressWriterOptions {
  turnRef: IAgentTurnDocHandle;
  leaseId: string;
  /** Called once when the turn is stopped ('cancel') or taken over ('superseded'). */
  onControl: (reason: Extract<AgentTurnAbortReason, 'cancel' | 'superseded'>) => void;
  initial?: {
    reply?: string;
    executedActions?: AgentActionResult[];
    proposedDeletes?: AgentProposedDelete[];
    referencedItems?: AgentReferencedItem[];
  };
  timings?: Partial<IAgentTurnProgressWriterTimings>;
  now?: () => Date;
}

/**
 * Mirrors a running turn's progress into its turn doc. Writes are throttled,
 * coalesced and serialized (never more than one in flight), so the doc stays
 * around one write per second. Progress is best effort: a failed write is
 * retried on the next flush, and the finalize transaction is authoritative.
 */
export class AgentTurnProgressWriter {
  private readonly timings: IAgentTurnProgressWriterTimings;
  private readonly now: () => Date;

  private reply: string;
  private statusMessage: string | null = null;
  private readonly actions = new Map<string, AgentActionResult>();
  private readonly deletes = new Map<string, AgentProposedDelete>();
  private readonly references = new Map<string, AgentReferencedItem>();

  private replyDirty = false;
  private statusDirty = false;
  private listsDirty = false;

  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushDueAt = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private controlTimer: ReturnType<typeof setInterval> | null = null;
  private controlInFlight = false;
  private controlFired = false;

  private writeChain: Promise<void> = Promise.resolve();
  private lastWriteAtMs = 0;
  private closed = false;

  constructor(private readonly options: IAgentTurnProgressWriterOptions) {
    this.timings = { ...DEFAULT_AGENT_TURN_PROGRESS_TIMINGS, ...options.timings };
    this.now = options.now ?? (() => new Date());
    this.reply = options.initial?.reply ?? '';
    for (const action of options.initial?.executedActions ?? []) {
      this.actions.set(agentActionKey(action), action);
    }
    for (const proposal of options.initial?.proposedDeletes ?? []) {
      this.deletes.set(agentDeleteKey(proposal), proposal);
    }
    for (const item of options.initial?.referencedItems ?? []) {
      this.references.set(agentReferenceKey(item), item);
    }
  }

  start(): void {
    if (this.closed) {
      return;
    }
    this.lastWriteAtMs = this.now().getTime();
    this.heartbeatTimer = setInterval(() => {
      if (this.now().getTime() - this.lastWriteAtMs >= this.timings.heartbeatMs) {
        this.enqueueWrite({});
      }
    }, this.timings.heartbeatMs);
    this.controlTimer = setInterval(() => {
      void this.pollControl();
    }, this.timings.controlPollMs);
  }

  push(event: AgentTurnProgressEvent): void {
    if (this.closed) {
      return;
    }
    switch (event.type) {
      case 'delta':
        if (this.reply.length < MAX_LIVE_REPLY_CHARS) {
          this.reply = `${this.reply}${event.text}`.slice(0, MAX_LIVE_REPLY_CHARS);
          this.replyDirty = true;
        }
        this.scheduleFlush(this.timings.deltaFlushMs);
        return;
      case 'status':
        this.statusMessage = event.message;
        this.statusDirty = true;
        this.scheduleFlush(this.timings.eventFlushMs);
        return;
      case 'action':
        this.actions.set(agentActionKey(event.action), event.action);
        this.listsDirty = true;
        this.scheduleFlush(this.timings.eventFlushMs);
        return;
      case 'delete_proposal':
        this.deletes.set(agentDeleteKey(event.proposal), event.proposal);
        this.listsDirty = true;
        this.scheduleFlush(this.timings.eventFlushMs);
        return;
      case 'reference':
        this.references.set(agentReferenceKey(event.item), event.item);
        this.listsDirty = true;
        this.scheduleFlush(this.timings.eventFlushMs);
        return;
    }
  }

  /** Stops the timers and waits for the last progress write to land. */
  async close(): Promise<void> {
    if (this.closed) {
      await this.writeChain;
      return;
    }
    this.closed = true;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.controlTimer) {
      clearInterval(this.controlTimer);
      this.controlTimer = null;
    }
    this.flushDirty();
    await this.writeChain;
  }

  private scheduleFlush(delayMs: number): void {
    const dueAt = this.now().getTime() + delayMs;
    if (this.flushTimer && this.flushDueAt <= dueAt) {
      return;
    }
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushDueAt = dueAt;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushDirty();
    }, delayMs);
  }

  private flushDirty(): void {
    if (!this.replyDirty && !this.statusDirty && !this.listsDirty) {
      return;
    }
    const update: DocumentData = {};
    if (this.replyDirty) {
      update.reply = this.reply;
      update.replySeq = FieldValue.increment(1);
    }
    if (this.statusDirty) {
      update.statusMessage = this.statusMessage;
    }
    if (this.listsDirty) {
      update.executedActions = serializeAgentActions([...this.actions.values()]);
      update.proposedDeletes = serializeAgentDeletes([...this.deletes.values()]);
      update.referencedItems = serializeAgentReferences([
        ...this.references.values(),
      ]);
    }
    const dirty = {
      reply: this.replyDirty,
      status: this.statusDirty,
      lists: this.listsDirty,
    };
    this.replyDirty = false;
    this.statusDirty = false;
    this.listsDirty = false;
    this.enqueueWrite(update, dirty);
  }

  private enqueueWrite(
    fields: DocumentData,
    dirty?: { reply: boolean; status: boolean; lists: boolean },
  ): void {
    const nowTimestamp = Timestamp.fromDate(this.now());
    this.lastWriteAtMs = nowTimestamp.toMillis();
    const update: DocumentData = {
      ...fields,
      updatedAt: nowTimestamp,
      heartbeatAt: nowTimestamp,
    };
    this.writeChain = this.writeChain.then(async () => {
      try {
        await this.options.turnRef.update(update);
      } catch (error) {
        logger.warn('Agent turn progress write failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Re-mark what this write carried so the next flush sends it again.
        if (dirty) {
          this.replyDirty ||= dirty.reply;
          this.statusDirty ||= dirty.status;
          this.listsDirty ||= dirty.lists;
          if (!this.closed) {
            this.scheduleFlush(this.timings.eventFlushMs);
          }
        }
      }
    });
  }

  private async pollControl(): Promise<void> {
    if (this.closed || this.controlFired || this.controlInFlight) {
      return;
    }
    this.controlInFlight = true;
    try {
      const data = (await this.options.turnRef.get()).data();
      const status = agentTurnStatusSchema.safeParse(data?.status);
      const leaseId: unknown = data?.leaseId;
      if (
        !data ||
        leaseId !== this.options.leaseId ||
        (status.success && isAgentTurnTerminal(status.data))
      ) {
        this.fireControl('superseded');
      } else if (data.cancelRequested === true) {
        this.fireControl('cancel');
      }
    } catch (error) {
      logger.warn('Agent turn control poll failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.controlInFlight = false;
    }
  }

  private fireControl(reason: 'cancel' | 'superseded'): void {
    if (this.controlFired) {
      return;
    }
    this.controlFired = true;
    this.options.onControl(reason);
  }
}
