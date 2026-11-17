import { useState } from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  Button,
  Text,
  TextInputField,
  mobileUiColors,
} from '@studyforge/mobile-ui';
import {
  evaluateScratchPadAnswer,
  getCallableErrorMessage,
} from '../../lib/api/studyforgeApi';
import { useIsOnline } from '../../lib/network/online';
import type { IMobileScratchPad } from './libraryData';

/** Reveal mode (free) and Type mode (LLM score 1 to 10 plus a hint), decision 15. */
export function ScratchPadCard({
  documentId,
  pad,
}: {
  documentId: string;
  pad: IMobileScratchPad;
}) {
  const online = useIsOnline();
  const [mode, setMode] = useState<'idle' | 'revealed' | 'typing'>('idle');
  const [answer, setAnswer] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ score: number; hint?: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      setResult(
        await evaluateScratchPadAnswer({
          documentId,
          sectionIndex: pad.sectionIndex,
          userAnswer: answer.trim(),
        }),
      );
    } catch (checkError) {
      setError(getCallableErrorMessage(checkError));
    } finally {
      setChecking(false);
    }
  };

  return (
    <View className="my-3 gap-2 rounded-3xl bg-card p-4">
      <View className="flex-row items-center gap-1.5">
        <MaterialIcons
          name="auto-awesome"
          size={14}
          color={mobileUiColors.mutedForeground}
        />
        <Text variant="caption" tone="muted" className="font-sans-semibold">
          Scratch pad · recall
        </Text>
      </View>
      <Text className="font-sans-medium">{pad.question}</Text>

      {mode === 'idle' ? (
        <View className="flex-row gap-2">
          <Button
            label="Reveal answer"
            size="sm"
            variant="secondary"
            onPress={() => setMode('revealed')}
            className="bg-background"
          />
          <Button
            label="Type an answer"
            size="sm"
            variant="secondary"
            onPress={() => setMode('typing')}
            className="bg-background"
          />
        </View>
      ) : null}

      {mode === 'typing' && !result ? (
        <>
          <TextInputField
            value={answer}
            onChangeText={setAnswer}
            placeholder="Your answer"
            multiline
            numberOfLines={3}
            className="bg-background"
          />
          <View className="flex-row gap-2">
            <Button
              label={checking ? 'Checking…' : 'Check'}
              size="sm"
              disabled={checking || !online || !answer.trim()}
              onPress={() => void check()}
            />
            <Button
              label="Reveal instead"
              size="sm"
              variant="ghost"
              onPress={() => setMode('revealed')}
            />
          </View>
          {!online ? (
            <Text variant="caption" tone="muted">
              Checking needs a connection. You can still reveal the answer.
            </Text>
          ) : null}
        </>
      ) : null}

      {result ? (
        <View className="gap-1 border-t border-border pt-2">
          <Text className="font-sans-semibold">{result.score} / 10</Text>
          {result.hint ? <Text tone="muted">{result.hint}</Text> : null}
          <Button
            label="Show the answer"
            size="sm"
            variant="ghost"
            onPress={() => setMode('revealed')}
          />
        </View>
      ) : null}

      {mode === 'revealed' ? (
        <Text tone="muted" className="border-t border-border pt-2">
          {pad.answer}
        </Text>
      ) : null}
      {error ? (
        <Text variant="caption" tone="destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
