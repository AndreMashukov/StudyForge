import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button, Text, cn, mobileUiColors } from '@studyforge/mobile-ui';
import {
  NARRATION_PLAYBACK_RATES,
  type NarrationPlaybackRate,
} from '@shared-types';
import { usePreferencesStore } from '../preferences/store/preferencesStore';
import { Chip, Sheet } from '../shell/ui';
import type { IDocumentNarration } from './useDocumentNarration';
import type { INarrationPlayer } from './useNarrationPlayer';

const SKIP_MS = 15_000;

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

function rateLabel(rate: NarrationPlaybackRate): string {
  return rate === 1 ? 'Normal' : `${rate}×`;
}

function creditsLabel(credits: number): string {
  if (credits === 0) return 'no credits';
  return credits === 1 ? '1 credit' : `${credits} credits`;
}

function IconControl({
  icon,
  label,
  onPress,
  disabled,
  large,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  large?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'items-center justify-center rounded-full',
        large ? 'h-14 w-14 bg-primary' : 'h-11 w-11',
        disabled && 'opacity-40',
      )}
    >
      <MaterialIcons
        name={icon}
        size={large ? 32 : 26}
        color={
          large ? mobileUiColors.primaryForeground : mobileUiColors.foreground
        }
      />
    </Pressable>
  );
}

export interface INarrationBar {
  narration: IDocumentNarration;
  player: INarrationPlayer;
  online: boolean;
}

/**
 * Listen control at the top of the reader (ADR 013): offers narration with its
 * price, plays it, and lets the learner remove it.
 */
export function NarrationBar({ narration, player, online }: INarrationBar) {
  const rate = usePreferencesStore((state) => state.narrationRate);
  const loop = usePreferencesStore((state) => state.narrationLoop);
  const setRate = usePreferencesStore((state) => state.setNarrationRate);
  const setLoop = usePreferencesStore((state) => state.setNarrationLoop);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const { check, record, quote } = narration;
  if (check === 'tooLong') {
    return (
      <Text variant="caption" tone="muted" className="mb-3">
        This document is too long to narrate.
      </Text>
    );
  }
  if (check !== 'narratable') return null;

  const parts = record?.parts ?? [];
  const readyCount = parts.filter((part) => part.status === 'ready').length;
  const failedCount = parts.filter((part) => part.status === 'failed').length;
  const generating = record?.status === 'generating';
  const hasAudio = readyCount > 0;
  const locked = quote?.unavailableReason === 'featureDisabled';
  const canGenerate = Boolean(quote?.available && quote.partsToGenerate > 0);

  if (locked && !hasAudio) {
    return (
      <View className="mb-3 flex-row items-center gap-3 rounded-2xl bg-card px-4 py-3">
        <MaterialIcons
          name="lock-outline"
          size={22}
          color={mobileUiColors.mutedForeground}
        />
        <View className="flex-1">
          <Text className="font-sans-semibold">Listen to this document</Text>
          <Text variant="caption" tone="muted">
            Narration is included in paid plans.
          </Text>
        </View>
      </View>
    );
  }

  const offerLabel = !hasAudio
    ? `Listen · ${creditsLabel(quote?.credits ?? 0)}`
    : quote?.voiceChanged
      ? `Narrate again in the new voice · ${creditsLabel(quote.credits)}`
      : `Narrate ${quote?.partsToGenerate === 1 ? '1 missing part' : `${quote?.partsToGenerate ?? 0} missing parts`} · ${creditsLabel(quote?.credits ?? 0)}`;

  const playing = player.status === 'playing' || player.status === 'loading';
  const progress =
    player.totalMs > 0 ? Math.min(1, player.positionMs / player.totalMs) : 0;
  const nextRate = (): NarrationPlaybackRate => {
    const index = NARRATION_PLAYBACK_RATES.indexOf(rate);
    return NARRATION_PLAYBACK_RATES[
      (index + 1) % NARRATION_PLAYBACK_RATES.length
    ];
  };

  return (
    <View className="mb-4 rounded-2xl bg-card px-4 py-3">
      {hasAudio ? (
        <>
          <View className="flex-row items-center justify-center gap-4">
            <IconControl
              icon="fast-rewind"
              label="Back 15 seconds"
              onPress={() => player.skipBy(-SKIP_MS)}
              disabled={player.currentPartIndex === null}
            />
            <IconControl
              icon={playing ? 'pause' : 'play-arrow'}
              label={playing ? 'Pause narration' : 'Play narration'}
              onPress={() => (playing ? player.pause() : player.play())}
              large
            />
            <IconControl
              icon="fast-forward"
              label="Forward 15 seconds"
              onPress={() => player.skipBy(SKIP_MS)}
              disabled={player.currentPartIndex === null}
            />
          </View>
          <View
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: 100,
              now: Math.round(progress * 100),
            }}
          >
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
          <View className="mt-1 flex-row justify-between">
            <Text variant="caption" tone="muted">
              {formatClock(player.positionMs)}
            </Text>
            <Text variant="caption" tone="muted">
              {formatClock(player.totalMs)}
            </Text>
          </View>
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <Chip
              label={rateLabel(rate)}
              icon="speed"
              onPress={() => setRate(nextRate())}
            />
            <Chip
              label="Loop"
              icon="repeat"
              selected={loop}
              onPress={() => setLoop(!loop)}
            />
            <Chip
              label="Remove"
              icon="delete-outline"
              disabled={!online || narration.removing || generating}
              onPress={() => setRemoveOpen(true)}
            />
          </View>
          {player.error ? (
            <Text variant="caption" tone="destructive" className="mt-2">
              {player.error}
            </Text>
          ) : null}
        </>
      ) : null}

      {generating ? (
        <Text
          variant="caption"
          tone="muted"
          className={hasAudio ? 'mt-2' : undefined}
        >
          {`Preparing narration: ${readyCount} of ${parts.length} parts ready`}
        </Text>
      ) : null}
      {!generating && failedCount > 0 ? (
        <Text variant="caption" tone="muted" className="mt-2">
          {failedCount === 1
            ? 'One part could not be narrated and is skipped.'
            : `${failedCount} parts could not be narrated and are skipped.`}
        </Text>
      ) : null}

      {!generating && canGenerate ? (
        <Button
          label={narration.starting ? 'Starting…' : offerLabel}
          icon={hasAudio ? 'refresh' : 'headphones'}
          variant={hasAudio ? 'secondary' : 'primary'}
          size="sm"
          className="mt-2"
          disabled={!online || narration.starting}
          onPress={() => setConfirmOpen(true)}
        />
      ) : null}
      {!hasAudio && !generating && !canGenerate && narration.quoteLoading ? (
        <Text variant="caption" tone="muted">
          Checking narration…
        </Text>
      ) : null}
      {!hasAudio && !generating && !canGenerate && narration.quoteFailed ? (
        <View>
          <Text variant="caption" tone="muted">
            Narration is not available right now.
          </Text>
          <Button
            label="Try again"
            variant="secondary"
            size="sm"
            className="mt-2"
            disabled={!online}
            onPress={narration.retryQuote}
          />
        </View>
      ) : null}
      {narration.message ? (
        <Text variant="caption" tone="destructive" className="mt-2">
          {narration.message}
        </Text>
      ) : null}

      <Sheet
        visible={confirmOpen}
        title="Narrate this document"
        onClose={() => setConfirmOpen(false)}
      >
        <Text className="mb-2">
          {quote?.voiceChanged
            ? 'The narration voice has changed, so the whole document is narrated again.'
            : hasAudio
              ? 'The parts that changed or could not be narrated are narrated now.'
              : 'StudyForge reads this document aloud in English. Code, tables, diagrams and images are not read.'}
        </Text>
        <Text tone="muted" className="mb-4">
          {`This costs ${creditsLabel(quote?.credits ?? 0)}. Playing it again, at any speed, is free.`}
        </Text>
        <Button
          label={`Narrate · ${creditsLabel(quote?.credits ?? 0)}`}
          icon="headphones"
          disabled={!online || narration.starting}
          onPress={() => {
            setConfirmOpen(false);
            void narration.start();
          }}
        />
      </Sheet>

      <Sheet
        visible={removeOpen}
        title="Remove narration"
        onClose={() => setRemoveOpen(false)}
      >
        <Text className="mb-4">
          This deletes the audio and frees its storage. Listening again will
          cost credits again.
        </Text>
        <Button
          label={narration.removing ? 'Removing…' : 'Remove narration'}
          variant="destructive"
          disabled={!online || narration.removing}
          onPress={() => {
            setRemoveOpen(false);
            player.reset();
            void narration.remove();
          }}
        />
      </Sheet>
    </View>
  );
}
