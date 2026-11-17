import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Heading, Text } from '@studyforge/mobile-ui';
import type { FlashcardStudySessionCard } from '@shared-types';
import { telemetryOutbox } from './telemetry';
import { useRecordOnLeave } from './useRecordOnLeave';
import type { IMobileFlashcardSet } from './studyData';

export function FlashcardPlayer({
  userId,
  set,
}: {
  userId: string;
  set: IMobileFlashcardSet;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [outcomes, setOutcomes] = useState<
    Record<string, FlashcardStudySessionCard['outcome']>
  >({});
  const startedAt = useRef(new Date().toISOString());
  const cards = set.flashcards;
  const card = cards[index];
  const finished = index >= cards.length;
  const marked = Object.keys(outcomes).length;
  const failed = useMemo(
    () =>
      Object.values(outcomes).filter((outcome) => outcome === 'failed').length,
    [outcomes],
  );

  const session = useRecordOnLeave(marked > 0, () => {
    void telemetryOutbox.enqueue({
      kind: 'flashcardSession',
      userId,
      request: {
        flashcardSetId: set.id,
        startedAt: startedAt.current,
        completedAt: new Date().toISOString(),
        cards: Object.entries(outcomes).map(([cardId, outcome]) => ({
          cardId,
          outcome,
        })),
      },
    });
  });

  useEffect(() => {
    if (finished) session.recordNow();
  }, [finished, session]);

  const mark = (outcome: FlashcardStudySessionCard['outcome']) => {
    if (!card) return;
    setOutcomes((current) => ({ ...current, [card.id]: outcome }));
    if (outcome === 'learned' && set.isLanguageLearning) {
      void telemetryOutbox.enqueue({
        kind: 'learnedVocabulary',
        userId,
        request: {
          flashcardSetId: set.id,
          flashcardId: card.id,
          ...(card.term ? { term: card.term } : {}),
        },
      });
    }
    setFlipped(false);
    setIndex((value) => value + 1);
  };

  if (!cards.length)
    return <Text tone="muted">This flashcard set has no cards yet.</Text>;

  if (finished || !card) {
    return (
      <View className="items-center gap-3 py-8">
        <Heading level={2}>Session done</Heading>
        <Text tone="muted">
          {marked - failed} got it · {failed} to review again
        </Text>
        <Button
          label="Study again"
          onPress={() => {
            session.recordNow();
            session.reset();
            startedAt.current = new Date().toISOString();
            setIndex(0);
            setOutcomes({});
          }}
        />
      </View>
    );
  }

  return (
    <View className="gap-4">
      <Text variant="caption" tone="muted" className="text-center">
        Card {index + 1} of {cards.length}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={flipped ? 'Shows the question' : 'Shows the answer'}
        onPress={() => setFlipped((value) => !value)}
        className="min-h-[300px] items-center justify-center rounded-[26px] border border-border bg-background p-6"
      >
        <Text variant="caption" tone="muted" className="mb-3">
          {flipped ? 'Answer' : 'Tap to flip'}
        </Text>
        <Text
          className={
            flipped
              ? 'text-center text-lg'
              : 'text-center text-[22px] font-sans-semibold'
          }
        >
          {flipped ? card.back : card.front}
        </Text>
        {flipped && (card.explanation || card.description) ? (
          <Text tone="muted" className="mt-3 text-center">
            {card.explanation ?? card.description}
          </Text>
        ) : null}
      </Pressable>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            label="Again"
            variant="secondary"
            onPress={() => mark('failed')}
          />
        </View>
        <View className="flex-1">
          <Button label="Got it" onPress={() => mark('learned')} />
        </View>
      </View>
    </View>
  );
}
