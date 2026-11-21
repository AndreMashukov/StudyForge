import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import type { NarrationPart, NarrationPlaybackRate } from '@shared-types';
import {
  loadNarrationPosition,
  saveNarrationPosition,
  type INarrationPosition,
} from '../../lib/storage/narrationStorage';
import {
  cachedNarrationPartUri,
  narrationChimeUri,
} from './narrationAudioCache';
import {
  firstPartStep,
  isPartPlayable,
  locateTimelinePosition,
  narrationTotalMs,
  nextPartStep,
  partDurationMs,
  timelinePositionMs,
  type NextPartStep,
} from './narrationTimeline';

export type NarrationPlayerStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'waiting'
  | 'ended'
  | 'error';

export interface INarrationPlayer {
  status: NarrationPlayerStatus;
  /** Part being read, for following along in the reader. */
  currentPartIndex: number | null;
  positionMs: number;
  totalMs: number;
  error: string | null;
  play: () => void;
  pause: () => void;
  skipBy: (deltaMs: number) => void;
  /** Stops playback and forgets the position, e.g. after the narration is removed. */
  reset: () => void;
}

const POSITION_SAVE_INTERVAL_MS = 10_000;

/**
 * Plays a narration's parts as one recording (ADR 013). Lives as long as the
 * reader screen: leaving the reader stops playback. Keeps playing with the
 * phone locked and shows lock-screen controls.
 */
export function useNarrationPlayer(params: {
  documentId: string | undefined;
  title: string;
  parts: NarrationPart[];
  rate: NarrationPlaybackRate;
  loop: boolean;
}): INarrationPlayer {
  const { documentId, title, parts, rate, loop } = params;
  const [status, setStatus] = useState<NarrationPlayerStatus>('idle');
  const [currentPartIndex, setCurrentPartIndex] = useState<number | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  const partsRef = useRef(parts);
  const rateRef = useRef(rate);
  const loopRef = useRef(loop);
  const currentRef = useRef<number | null>(null);
  const modeRef = useRef<'part' | 'chime'>('part');
  const afterChimeRef = useRef<number | null>(null);
  const waitingForRef = useRef<number | null>(null);
  const pendingSeekMsRef = useRef<number | null>(null);
  const loadTokenRef = useRef(0);
  const savedPositionRef = useRef<INarrationPosition | null>(null);
  const lastSaveRef = useRef(0);
  const offsetRef = useRef(0);

  partsRef.current = parts;
  loopRef.current = loop;

  const savePosition = useCallback(
    (force = false) => {
      const partIndex = currentRef.current;
      if (!documentId || partIndex === null) return;
      const now = Date.now();
      if (!force && now - lastSaveRef.current < POSITION_SAVE_INTERVAL_MS)
        return;
      lastSaveRef.current = now;
      const position = { partIndex, offsetMs: offsetRef.current };
      savedPositionRef.current = position;
      saveNarrationPosition(documentId, position);
    },
    [documentId],
  );

  useEffect(() => {
    savedPositionRef.current = null;
    if (!documentId) return;
    let active = true;
    void loadNarrationPosition(documentId).then((position) => {
      if (active) savedPositionRef.current = position;
    });
    return () => {
      active = false;
    };
  }, [documentId]);

  const loadPart = useCallback(
    async (partIndex: number, offsetMs: number) => {
      const player = playerRef.current;
      const part = partsRef.current.find((entry) => entry.index === partIndex);
      if (!player || !documentId || !part || !isPartPlayable(part)) return;
      const token = ++loadTokenRef.current;
      modeRef.current = 'part';
      waitingForRef.current = null;
      currentRef.current = partIndex;
      offsetRef.current = offsetMs;
      setCurrentPartIndex(partIndex);
      setStatus('loading');
      try {
        const uri = await cachedNarrationPartUri(documentId, part);
        if (token !== loadTokenRef.current) return;
        pendingSeekMsRef.current = offsetMs > 0 ? offsetMs : null;
        player.replace({ uri });
        player.setPlaybackRate(rateRef.current, 'high');
        player.play();
      } catch (loadError) {
        if (token !== loadTokenRef.current) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load the narration.',
        );
        setStatus('error');
      }
    },
    [documentId],
  );

  const playChimeThen = useCallback((partIndex: number) => {
    const player = playerRef.current;
    if (!player) return;
    loadTokenRef.current += 1;
    modeRef.current = 'chime';
    afterChimeRef.current = partIndex;
    player.replace({ uri: narrationChimeUri() });
    player.setPlaybackRate(1);
    player.play();
  }, []);

  const followStep = useCallback(
    (step: NextPartStep) => {
      if (step.kind === 'end') {
        currentRef.current = null;
        offsetRef.current = 0;
        setCurrentPartIndex(null);
        setPositionMs(0);
        setStatus('ended');
        if (documentId) {
          savedPositionRef.current = null;
          saveNarrationPosition(documentId, { partIndex: 0, offsetMs: 0 });
        }
        return;
      }
      if (step.kind === 'wait') {
        waitingForRef.current = step.partIndex;
        currentRef.current = step.partIndex;
        offsetRef.current = 0;
        setCurrentPartIndex(step.partIndex);
        setStatus('waiting');
        return;
      }
      if (step.skippedFailed) {
        playChimeThen(step.partIndex);
        return;
      }
      void loadPart(step.partIndex, 0);
    },
    [documentId, loadPart, playChimeThen],
  );

  const handleStatus = useCallback(
    (update: AudioStatus) => {
      const player = playerRef.current;
      if (!player) return;
      if (modeRef.current === 'chime') {
        if (update.didJustFinish && afterChimeRef.current !== null) {
          const next = afterChimeRef.current;
          afterChimeRef.current = null;
          void loadPart(next, 0);
        }
        return;
      }
      const partIndex = currentRef.current;
      if (partIndex === null) return;
      if (update.isLoaded && pendingSeekMsRef.current !== null) {
        const seekMs = pendingSeekMsRef.current;
        pendingSeekMsRef.current = null;
        void player.seekTo(seekMs / 1000);
      }
      offsetRef.current = update.currentTime * 1000;
      setPositionMs(
        timelinePositionMs(partsRef.current, partIndex, offsetRef.current),
      );
      if (update.didJustFinish) {
        savePosition(true);
        followStep(nextPartStep(partsRef.current, partIndex, loopRef.current));
        return;
      }
      if (update.isLoaded) {
        setStatus(
          update.playing
            ? 'playing'
            : update.isBuffering
              ? 'loading'
              : 'paused',
        );
        if (update.playing) savePosition();
      }
    },
    [followStep, loadPart, savePosition],
  );

  const handleStatusRef = useRef(handleStatus);
  handleStatusRef.current = handleStatus;

  const ensurePlayer = useCallback((): AudioPlayer => {
    if (playerRef.current) return playerRef.current;
    const player = createAudioPlayer(null, { updateInterval: 500 });
    // Through a ref, so the listener always sees the latest parts and settings.
    player.addListener('playbackStatusUpdate', (update) =>
      handleStatusRef.current(update),
    );
    playerRef.current = player;
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
    return player;
  }, []);

  const play = useCallback(() => {
    const player = ensurePlayer();
    setError(null);
    player.setActiveForLockScreen(true, {
      title,
      artist: 'StudyForge narration',
    });
    if (status === 'paused' && currentRef.current !== null) {
      player.play();
      return;
    }
    const saved = savedPositionRef.current;
    const savedPart = saved
      ? partsRef.current.find((part) => part.index === saved.partIndex)
      : undefined;
    if (
      saved &&
      savedPart &&
      isPartPlayable(savedPart) &&
      saved.offsetMs < partDurationMs(savedPart)
    ) {
      void loadPart(saved.partIndex, saved.offsetMs);
      return;
    }
    followStep(firstPartStep(partsRef.current));
  }, [ensurePlayer, followStep, loadPart, status, title]);

  const pause = useCallback(() => {
    playerRef.current?.pause();
    savePosition(true);
  }, [savePosition]);

  const skipBy = useCallback(
    (deltaMs: number) => {
      const partIndex = currentRef.current;
      const player = playerRef.current;
      if (partIndex === null || !player) return;
      const target = locateTimelinePosition(
        partsRef.current,
        timelinePositionMs(partsRef.current, partIndex, offsetRef.current) +
          deltaMs,
      );
      if (!target) return;
      const part = partsRef.current.find(
        (entry) => entry.index === target.partIndex,
      );
      if (!part || !isPartPlayable(part)) return;
      if (target.partIndex === partIndex) {
        offsetRef.current = target.offsetMs;
        void player.seekTo(target.offsetMs / 1000);
      } else {
        void loadPart(target.partIndex, target.offsetMs);
      }
    },
    [loadPart],
  );

  const reset = useCallback(() => {
    loadTokenRef.current += 1;
    playerRef.current?.pause();
    currentRef.current = null;
    waitingForRef.current = null;
    savedPositionRef.current = null;
    setCurrentPartIndex(null);
    setPositionMs(0);
    setStatus('idle');
  }, []);

  // A part the player was waiting for has become ready (or failed).
  useEffect(() => {
    const waitingFor = waitingForRef.current;
    if (waitingFor === null) return;
    const part = parts.find((entry) => entry.index === waitingFor);
    if (!part) return;
    if (isPartPlayable(part)) {
      void loadPart(waitingFor, 0);
    } else if (part.status === 'failed') {
      followStep(nextPartStep(parts, waitingFor, loopRef.current));
    }
  }, [parts, loadPart, followStep]);

  useEffect(() => {
    rateRef.current = rate;
    if (modeRef.current === 'part')
      playerRef.current?.setPlaybackRate(rate, 'high');
  }, [rate]);

  // Leaving the reader stops playback and releases the player.
  useEffect(
    () => () => {
      savePosition(true);
      const player = playerRef.current;
      playerRef.current = null;
      if (player) {
        player.pause();
        player.clearLockScreenControls();
        player.remove();
      }
    },
    [savePosition],
  );

  return {
    status,
    currentPartIndex,
    positionMs,
    totalMs: narrationTotalMs(parts),
    error,
    play,
    pause,
    skipBy,
    reset,
  };
}
