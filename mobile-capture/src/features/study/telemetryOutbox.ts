import { z } from 'zod';

/**
 * Offline-safe queue for learning telemetry (decision 16). Client telemetry writes
 * are Firestore transactions, which fail offline, so finished study sessions are
 * stored first and written when the device is back online.
 */
const quizAnswerSchema = z.object({
  questionIndex: z.number(),
  selectedAnswer: z.union([
    z.string(),
    z.array(z.string()),
    z.number(),
    z.array(z.number()),
    z.null(),
  ]),
  timeSpentMs: z.number().optional(),
});

const outboxEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('quizAttempt'),
    id: z.string(),
    userId: z.string(),
    attempts: z.number(),
    request: z.object({
      quizId: z.string(),
      quizType: z.enum(['quiz', 'diagramQuiz', 'sequenceQuiz', 'matchQuiz']),
      startedAt: z.string(),
      completedAt: z.string(),
      durationMs: z.number(),
      answers: z.array(quizAnswerSchema),
    }),
  }),
  z.object({
    kind: z.literal('flashcardSession'),
    id: z.string(),
    userId: z.string(),
    attempts: z.number(),
    request: z.object({
      flashcardSetId: z.string(),
      startedAt: z.string(),
      completedAt: z.string(),
      cards: z.array(
        z.object({
          cardId: z.string(),
          outcome: z.enum(['failed', 'learned']),
        }),
      ),
    }),
  }),
  z.object({
    kind: z.literal('learnedVocabulary'),
    id: z.string(),
    userId: z.string(),
    attempts: z.number(),
    request: z.object({
      flashcardSetId: z.string(),
      flashcardId: z.string(),
      term: z.string().optional(),
    }),
  }),
]);

export type IOutboxEntry = z.infer<typeof outboxEntrySchema>;
export type IOutboxEntryInput = IOutboxEntry extends infer E
  ? E extends IOutboxEntry
    ? Omit<E, 'id' | 'attempts'>
    : never
  : never;

/** Drop an entry after this many failed sends (e.g. the set was deleted), so the queue can't wedge. */
export const OUTBOX_MAX_ATTEMPTS = 5;

export interface IOutboxStorage {
  read(): string | undefined;
  write(value: string): void;
}

export interface IOutboxSenders {
  quizAttempt(
    userId: string,
    request: Extract<IOutboxEntry, { kind: 'quizAttempt' }>['request'],
  ): Promise<unknown>;
  flashcardSession(
    userId: string,
    request: Extract<IOutboxEntry, { kind: 'flashcardSession' }>['request'],
  ): Promise<unknown>;
  learnedVocabulary(
    userId: string,
    request: Extract<IOutboxEntry, { kind: 'learnedVocabulary' }>['request'],
  ): Promise<unknown>;
}

export interface ITelemetryOutbox {
  enqueue(entry: IOutboxEntryInput): Promise<void>;
  flush(): Promise<{ sent: number; remaining: number }>;
  pending(): IOutboxEntry[];
}

function send(senders: IOutboxSenders, entry: IOutboxEntry): Promise<unknown> {
  switch (entry.kind) {
    case 'quizAttempt':
      return senders.quizAttempt(entry.userId, entry.request);
    case 'flashcardSession':
      return senders.flashcardSession(entry.userId, entry.request);
    case 'learnedVocabulary':
      return senders.learnedVocabulary(entry.userId, entry.request);
  }
}

export function createTelemetryOutbox(options: {
  storage: IOutboxStorage;
  senders: IOutboxSenders;
  isOnline: () => boolean;
  /** Entries this session may send now; others wait (e.g. queued by another signed-in account). */
  canSend?: (entry: IOutboxEntry) => boolean;
  newId?: () => string;
}): ITelemetryOutbox {
  const newId =
    options.newId ??
    (() => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  let flushing: Promise<{ sent: number; remaining: number }> | null = null;

  const load = (): IOutboxEntry[] => {
    const raw = options.storage.read();
    if (!raw) return [];
    try {
      const parsed = z.array(outboxEntrySchema).safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  };
  const save = (entries: IOutboxEntry[]) =>
    options.storage.write(JSON.stringify(entries));

  const runFlush = async (): Promise<{ sent: number; remaining: number }> => {
    let sent = 0;
    for (const entry of load()) {
      if (!options.isOnline()) break;
      if (options.canSend && !options.canSend(entry)) continue;
      try {
        await send(options.senders, entry);
        save(load().filter((stored) => stored.id !== entry.id));
        sent += 1;
      } catch {
        const remaining = load().flatMap((stored) => {
          if (stored.id !== entry.id) return [stored];
          const attempts = stored.attempts + 1;
          return attempts >= OUTBOX_MAX_ATTEMPTS
            ? []
            : [{ ...stored, attempts }];
        });
        save(remaining);
      }
    }
    return { sent, remaining: load().length };
  };

  const flush = () => {
    if (!flushing) {
      flushing = runFlush().finally(() => {
        flushing = null;
      });
    }
    return flushing;
  };

  return {
    async enqueue(input) {
      const entry = outboxEntrySchema.parse({
        ...input,
        id: newId(),
        attempts: 0,
      });
      save([...load(), entry]);
      await flush();
    },
    flush,
    pending: load,
  };
}
