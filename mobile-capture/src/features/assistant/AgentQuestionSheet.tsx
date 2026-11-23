import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { AgentQuestion } from '@shared-types';
import { Badge, Text, cn, mobileUiColors } from '@studyforge/mobile-ui';
import {
  buildAgentQuestionFlowMessage,
  INITIAL_AGENT_QUESTION_FLOW,
  isAgentQuestionFlowComplete,
  previousAgentQuestionAnswer,
  reduceAgentQuestionFlow,
  type AgentQuestionFlowAction,
} from '@studyforge/client-data/agentQuestionFlow';

const MAX_OTHER_ANSWER_LENGTH = 500;

export interface IAgentQuestionSheet {
  questions: AgentQuestion[];
  disabled?: boolean;
  /** Called once with the message holding every answer. */
  onSubmit: (message: string) => void;
  /** Hides the card; the user can still reply in the composer. */
  onDismiss: () => void;
}

/**
 * The agent's clarifying questions above the composer, one at a time. Tapping
 * an option answers and moves on; the recommended option is tagged.
 */
export function AgentQuestionSheet({
  questions,
  disabled = false,
  onSubmit,
  onDismiss,
}: IAgentQuestionSheet) {
  const [flow, setFlow] = useState(INITIAL_AGENT_QUESTION_FLOW);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  const question = questions[Math.min(flow.index, questions.length - 1)];
  const previous = previousAgentQuestionAnswer(flow);

  const dispatch = (action: AgentQuestionFlowAction) => {
    if (disabled) return;
    const next = reduceAgentQuestionFlow(flow, action, questions.length);
    if (isAgentQuestionFlowComplete(next, questions.length)) {
      onSubmit(buildAgentQuestionFlowMessage(questions, next));
      return;
    }
    const nextPrevious = next.answers[next.index];
    const nextQuestion = questions[next.index];
    const reopenOther =
      typeof nextPrevious === 'string' &&
      !nextQuestion?.options.some((option) => option.label === nextPrevious);
    setOtherOpen(reopenOther);
    setOtherText(reopenOther ? nextPrevious : '');
    setFlow(next);
  };

  const submitOther = () => {
    const text = otherText.trim();
    if (text) dispatch({ type: 'answer', answer: text });
  };

  return (
    <View
      accessibilityLabel="The assistant has a question"
      className="mx-3 mb-1 rounded-3xl border border-border bg-card px-4 pb-2 pt-3"
    >
      <View className="flex-row items-center gap-2">
        <MaterialIcons
          name="help-outline"
          size={18}
          color={mobileUiColors.primary}
        />
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          {question.header ? (
            <Text variant="label" numberOfLines={1} className="shrink">
              {question.header}
            </Text>
          ) : null}
          {questions.length > 1 ? (
            <Text variant="caption" tone="muted">
              {flow.index + 1} of {questions.length}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss questions"
          hitSlop={8}
          onPress={onDismiss}
          className="h-8 w-8 items-center justify-center rounded-full"
        >
          <MaterialIcons
            name="close"
            size={20}
            color={mobileUiColors.mutedForeground}
          />
        </Pressable>
      </View>

      {questions.length > 1 ? (
        <View className="mt-2 flex-row gap-1" accessibilityElementsHidden>
          {questions.map((entry, index) => (
            <View
              key={entry.id}
              className={cn(
                'h-1 flex-1 rounded-full',
                index <= flow.index ? 'bg-primary' : 'bg-border',
                index === flow.index ? 'opacity-50' : undefined,
              )}
            />
          ))}
        </View>
      ) : null}

      <Text className="mt-3 font-semibold">{question.question}</Text>

      <View className="mt-3 gap-2">
        {question.options.map((option, index) => {
          const wasChosen = previous === option.label;
          return (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityLabel={
                option.recommended
                  ? `${option.label}, recommended`
                  : option.label
              }
              accessibilityHint={option.description}
              accessibilityState={{ disabled, selected: wasChosen }}
              disabled={disabled}
              onPress={() => dispatch({ type: 'answer', answer: option.label })}
              className={cn(
                'min-h-12 flex-row items-center gap-3 rounded-2xl border px-3 py-2.5 active:bg-background',
                option.recommended || wasChosen
                  ? 'border-primary'
                  : 'border-border',
                disabled ? 'opacity-60' : undefined,
              )}
            >
              <View className="h-6 w-6 items-center justify-center rounded-full border border-border">
                <Text variant="caption" tone="muted">
                  {index + 1}
                </Text>
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="font-medium">{option.label}</Text>
                  {option.recommended ? (
                    <Badge label="Recommended" variant="secondary" />
                  ) : null}
                </View>
                {option.description ? (
                  <Text variant="caption" tone="muted" className="mt-0.5">
                    {option.description}
                  </Text>
                ) : null}
              </View>
              {wasChosen ? (
                <MaterialIcons
                  name="check"
                  size={18}
                  color={mobileUiColors.primary}
                />
              ) : null}
            </Pressable>
          );
        })}

        {question.allowOther ? (
          otherOpen ? (
            <View className="min-h-12 flex-row items-center gap-2 rounded-2xl border border-primary px-3">
              <MaterialIcons
                name="edit"
                size={18}
                color={mobileUiColors.mutedForeground}
              />
              <TextInput
                value={otherText}
                onChangeText={(value) =>
                  setOtherText(value.slice(0, MAX_OTHER_ANSWER_LENGTH))
                }
                placeholder="Type your answer"
                placeholderTextColor={mobileUiColors.placeholder}
                accessibilityLabel="Your own answer"
                autoFocus
                editable={!disabled}
                returnKeyType="send"
                onSubmitEditing={submitOther}
                className="flex-1 py-2.5 font-sans text-base text-foreground"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send answer"
                accessibilityState={{ disabled: disabled || !otherText.trim() }}
                disabled={disabled || !otherText.trim()}
                onPress={submitOther}
                className={cn(
                  'h-9 w-9 items-center justify-center rounded-full',
                  otherText.trim() ? 'bg-primary' : 'bg-background',
                )}
              >
                <MaterialIcons
                  name="arrow-upward"
                  size={18}
                  color={
                    otherText.trim()
                      ? mobileUiColors.primaryForeground
                      : mobileUiColors.placeholder
                  }
                />
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Something else"
              disabled={disabled}
              onPress={() => setOtherOpen(true)}
              className="min-h-12 flex-row items-center gap-3 rounded-2xl border border-dashed border-border px-3 py-2.5"
            >
              <MaterialIcons
                name="edit"
                size={18}
                color={mobileUiColors.mutedForeground}
              />
              <Text tone="muted">Something else…</Text>
            </Pressable>
          )
        ) : null}
      </View>

      <View className="mt-1 flex-row items-center justify-between">
        {flow.index > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous question"
            onPress={() => dispatch({ type: 'back' })}
            className="min-h-11 flex-row items-center px-1"
          >
            <MaterialIcons
              name="chevron-left"
              size={20}
              color={mobileUiColors.mutedForeground}
            />
            <Text tone="muted">Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip this question"
          disabled={disabled}
          onPress={() => dispatch({ type: 'skip' })}
          className="min-h-11 justify-center px-2"
        >
          <Text tone="muted">Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}
