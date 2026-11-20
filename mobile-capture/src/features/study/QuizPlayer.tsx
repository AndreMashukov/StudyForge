import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Heading, Text, cn } from '@studyforge/mobile-ui';
import type { RecordQuizAttemptAnswerInput } from '@shared-types';
import { startChat } from '../assistant/chatNavigation';
import { telemetryOutbox } from './telemetry';
import { useRecordOnLeave } from './useRecordOnLeave';
import type { IMobileQuiz } from './studyData';

export function QuizPlayer({
  userId,
  quiz,
}: {
  userId: string;
  quiz: IMobileQuiz;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<RecordQuizAttemptAnswerInput[]>([]);
  const startedAt = useRef(Date.now());
  const questionStartedAt = useRef(Date.now());
  const questions = quiz.questions;
  const question = questions[index];
  const picked = answers.find((answer) => answer.questionIndex === index);
  const correct = answers.filter(
    (answer) =>
      answer.selectedAnswer === questions[answer.questionIndex]?.correctAnswer,
  ).length;

  const attempt = useRecordOnLeave(answers.length > 0, () => {
    void telemetryOutbox.enqueue({
      kind: 'quizAttempt',
      userId,
      request: {
        quizId: quiz.id,
        quizType: 'quiz',
        startedAt: new Date(startedAt.current).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.current,
        answers,
      },
    });
  });

  const done = questions.length > 0 && !question;
  useEffect(() => {
    if (done) attempt.recordNow();
  }, [done, attempt]);

  const pick = (option: number) => {
    if (picked) return;
    setAnswers((current) => [
      ...current,
      {
        questionIndex: index,
        selectedAnswer: option,
        timeSpentMs: Date.now() - questionStartedAt.current,
      },
    ]);
  };

  const next = () => {
    questionStartedAt.current = Date.now();
    setIndex((value) => value + 1);
  };

  if (!questions.length)
    return <Text tone="muted">This quiz has no questions yet.</Text>;

  if (!question) {
    return (
      <View className="items-center gap-3 py-8">
        <Heading level={2}>
          {correct} / {questions.length}
        </Heading>
        <Text tone="muted">Your result is saved to Statistics.</Text>
        <Button
          label="Done"
          onPress={() => {
            attempt.recordNow();
            router.back();
          }}
        />
      </View>
    );
  }

  return (
    <View className="gap-4">
      <Text variant="caption" tone="muted" className="text-center">
        Question {index + 1} of {questions.length}
      </Text>
      <Text className="text-[19px] font-sans-semibold leading-7">
        {question.question}
      </Text>
      <View className="gap-2">
        {question.options.map((option, optionIndex) => {
          const isCorrect = optionIndex === question.correctAnswer;
          const isPicked = picked?.selectedAnswer === optionIndex;
          return (
            <Pressable
              key={optionIndex}
              accessibilityRole="button"
              accessibilityState={{
                selected: isPicked,
                disabled: Boolean(picked),
              }}
              onPress={() => pick(optionIndex)}
              className={cn(
                'flex-row items-center gap-3 rounded-2xl border px-4 py-3.5',
                picked && isCorrect
                  ? 'border-accent'
                  : picked && isPicked
                    ? 'border-destructive'
                    : 'border-border',
              )}
            >
              <View
                className={cn(
                  'h-7 w-7 items-center justify-center rounded-full border',
                  picked && isCorrect
                    ? 'border-accent bg-accent'
                    : picked && isPicked
                      ? 'border-destructive bg-destructive'
                      : 'border-border',
                )}
              >
                <Text
                  variant="caption"
                  className={
                    picked && (isCorrect || isPicked)
                      ? 'text-primary-foreground'
                      : undefined
                  }
                >
                  {'ABCDEFGH'[optionIndex]}
                </Text>
              </View>
              <Text className="flex-1">{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {picked ? (
        <View className="gap-2">
          <Text className="font-sans-medium">
            {picked.selectedAnswer === question.correctAnswer
              ? 'Correct.'
              : 'Not quite.'}
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                label="Ask why"
                variant="secondary"
                onPress={() =>
                  startChat(router, {
                    message: `In my quiz "${quiz.title}", explain question ${index + 1}: "${question.question}". The correct answer is "${question.options[question.correctAnswer] ?? ''}".`,
                    directoryId: quiz.directoryId,
                    ...(quiz.documentId ? { documentId: quiz.documentId } : {}),
                    label: quiz.title,
                  })
                }
              />
            </View>
            <View className="flex-1">
              <Button
                label={index + 1 < questions.length ? 'Next' : 'See result'}
                onPress={next}
              />
            </View>
          </View>
        </View>
      ) : question.hint ? (
        <Text variant="caption" tone="muted">
          Hint: {question.hint}
        </Text>
      ) : null}
    </View>
  );
}
