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
} from '../../lib/storage/narrationStorage';
import { combinedNarrationUri } from './narrationAudioCache';
import {
  firstUnheardOffsetMs,
  hasNewPlayableParts,
  isNarrationComplete,
  joinedDurationMs,
  mapPositionMs,
  narrationTotalMs,
  partIndexAtPosition,
  playableParts,
} from './narrationTimeline';

export type NarrationPlayerStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
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
/** After a playback failure the player reloads itself, but not more often than this. */
const RECOVER_MIN_INTERVAL_MS = 5_000;
/** A local file that has not loaded by then has failed; the player gives no error for it. */
const LOAD_TIMEOUT_MS = 15_000;
const LOAD_FAILED_MESSAGE =
  'The narration could not be played. Tap play to try again.';

/**
 * Plays a narration (ADR 013) as one audio file: the ready parts joined in
 * order. With one source there is no part boundary for the app to handle, so
 * it keeps playing with the app in the background or the phone locked, and
 * loop is the player's own. Lives as long as the reader screen: leaving the
 * reader stops playback. Shows lock-screen controls.
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
  const [loadedTotalMs, setLoadedTotalMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  const partsRef = useRef(parts);
  const rateRef = useRef(rate);
  const loopRef = useRef(loop);
  const statusRef = useRef(status);
  /** The parts joined into the file that is loaded now. */
  const includedRef = useRef<NarrationPart[]>([]);
  const positionRef = useRef(0);
  const pendingSeekMsRef = useRef<number | null>(null);
  const loadTokenRef = useRef(0);
  const savedPositionRef = useRef<number | null>(null);
  const lastSaveRef = useRef(0);
  const extendingRef = useRef(false);
  /** The loaded source has reached a playable state; a later idle means it failed. */
  const sourceReadyRef = useRef(false);
  const lastRecoverRef = useRef(0);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The player loops the file itself; only when the file has the whole narration. */
  const nativeLoopRef = useRef(false);

  partsRef.current = parts;
  rateRef.current = rate;
  loopRef.current = loop;
  statusRef.current = status;

  const savePosition = useCallback(
    (force = false) => {
      if (!documentId || !includedRef.current.length) return;
      const now = Date.now();
      if (!force && now - lastSaveRef.current < POSITION_SAVE_INTERVAL_MS)
        return;
      lastSaveRef.current = now;
      savedPositionRef.current = positionRef.current;
      saveNarrationPosition(documentId, positionRef.current);
    },
    [documentId],
  );

  const clearLoadTimer = useCallback(() => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    loadTimerRef.current = null;
  }, []);

  /** Forgets everything about the loaded narration; the saved position is kept. */
  const clearDocumentState = useCallback(() => {
    loadTokenRef.current += 1;
    clearLoadTimer();
    playerRef.current?.pause();
    includedRef.current = [];
    positionRef.current = 0;
    pendingSeekMsRef.current = null;
    sourceReadyRef.current = false;
    savedPositionRef.current = null;
    setLoadedTotalMs(null);
    setCurrentPartIndex(null);
    setPositionMs(0);
    setError(null);
    setStatus('idle');
  }, [clearLoadTimer]);

  // A reader that shows another document starts from that document's own state.
  // Declared before the saved-position load, so that load is not cleared.
  useEffect(() => {
    clearDocumentState();
  }, [documentId, clearDocumentState]);

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

  /** Sets the player's own loop, which only a complete file may use. */
  const applyLoop = useCallback((player: AudioPlayer) => {
    const nativeLoop =
      loopRef.current &&
      isNarrationComplete(includedRef.current, partsRef.current);
    nativeLoopRef.current = nativeLoop;
    player.loop = nativeLoop;
  }, []);

  /** Loads the joined audio of `included` and plays it from `startMs`. */
  const loadJoined = useCallback(
    async (included: NarrationPart[], startMs: number) => {
      const player = playerRef.current;
      if (!player || !documentId) return;
      const token = ++loadTokenRef.current;
      sourceReadyRef.current = false;
      clearLoadTimer();
      setStatus('loading');
      try {
        const uri = await combinedNarrationUri(documentId, included);
        if (token !== loadTokenRef.current) return;
        includedRef.current = included;
        setLoadedTotalMs(joinedDurationMs(included));
        pendingSeekMsRef.current = startMs > 0 ? startMs : null;
        player.replace({ uri });
        applyLoop(player);
        player.setPlaybackRate(rateRef.current, 'high');
        player.play();
        // A source that fails before it loads sends no status that says so.
        loadTimerRef.current = setTimeout(() => {
          loadTimerRef.current = null;
          if (token !== loadTokenRef.current || sourceReadyRef.current) return;
          loadTokenRef.current += 1;
          playerRef.current?.pause();
          setError(LOAD_FAILED_MESSAGE);
          setStatus('error');
        }, LOAD_TIMEOUT_MS);
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
    [documentId, clearLoadTimer, applyLoop],
  );

  const finishPlayback = useCallback(() => {
    const included = includedRef.current;
    if (
      !extendingRef.current &&
      hasNewPlayableParts(included, partsRef.current)
    ) {
      // More of the narration was generated while this played: carry on into it.
      extendingRef.current = true;
      const next = playableParts(partsRef.current);
      void loadJoined(next, firstUnheardOffsetMs(included, next) ?? 0).finally(
        () => {
          extendingRef.current = false;
        },
      );
      return;
    }
    if (loopRef.current) {
      // Looping a narration that is still being prepared: start the file over.
      positionRef.current = 0;
      setPositionMs(0);
      const player = playerRef.current;
      if (player) {
        void player.seekTo(0).then(() => player.play());
      }
      return;
    }
    positionRef.current = 0;
    setPositionMs(0);
    setCurrentPartIndex(null);
    setStatus('ended');
    if (documentId) {
      savedPositionRef.current = null;
      saveNarrationPosition(documentId, 0);
    }
  }, [documentId, loadJoined]);

  /**
   * The audio player gives no error to JavaScript. A source that had loaded and
   * then drops back to idle has failed (for example the decoder gave up), so
   * reload the audio where it stopped instead of leaving a dead player.
   */
  const recoverFromFailure = useCallback(() => {
    const now = Date.now();
    if (now - lastRecoverRef.current < RECOVER_MIN_INTERVAL_MS) {
      setError('Playback stopped. Tap play to try again.');
      setStatus('error');
      return;
    }
    lastRecoverRef.current = now;
    void loadJoined(playableParts(partsRef.current), positionRef.current);
  }, [loadJoined]);

  const handleStatus = (update: AudioStatus) => {
    if (!includedRef.current.length) return;
    if (update.playbackState === 'idle' && sourceReadyRef.current) {
      sourceReadyRef.current = false;
      recoverFromFailure();
      return;
    }
    if (update.isLoaded) {
      sourceReadyRef.current = true;
      clearLoadTimer();
    }
    if (update.isLoaded && pendingSeekMsRef.current !== null) {
      const seekMs = pendingSeekMsRef.current;
      pendingSeekMsRef.current = null;
      void playerRef.current?.seekTo(seekMs / 1000);
    }
    // With the player's own loop on, the file simply starts over.
    if (update.didJustFinish && !nativeLoopRef.current) {
      finishPlayback();
      return;
    }
    positionRef.current = update.currentTime * 1000;
    setPositionMs(positionRef.current);
    setCurrentPartIndex(
      partIndexAtPosition(includedRef.current, positionRef.current),
    );
    if (update.isLoaded) {
      setStatus(
        update.playing ? 'playing' : update.isBuffering ? 'loading' : 'paused',
      );
      if (update.playing) savePosition();
    }
  };
  // Through a ref, so the player's listener always sees the latest closure.
  const handleStatusRef = useRef(handleStatus);
  handleStatusRef.current = handleStatus;

  const ensurePlayer = useCallback((): AudioPlayer => {
    if (playerRef.current) return playerRef.current;
    const player = createAudioPlayer(null, { updateInterval: 500 });
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

  const play = useCallback(async () => {
    const player = ensurePlayer();
    setError(null);
    player.setActiveForLockScreen(true, {
      title,
      artist: 'StudyForge narration',
    });
    const ready = playableParts(partsRef.current);
    if (!ready.length) return;

    const loaded = includedRef.current.length > 0;
    const ended = statusRef.current === 'ended';
    const failed = statusRef.current === 'error';
    if (
      loaded &&
      !ended &&
      !failed &&
      // A file that never finished loading (paused while it loaded) is loaded again.
      sourceReadyRef.current &&
      !hasNewPlayableParts(includedRef.current, ready)
    ) {
      player.play();
      return;
    }
    // Start over after the end; otherwise continue from where listening
    // stopped, at the same place in the new file even if parts were added before it.
    const resumeFrom = ended
      ? 0
      : loaded
        ? mapPositionMs(includedRef.current, ready, positionRef.current)
        : (savedPositionRef.current ?? 0);
    lastRecoverRef.current = Date.now();
    await loadJoined(
      ready,
      resumeFrom < joinedDurationMs(ready) ? resumeFrom : 0,
    );
  }, [ensurePlayer, loadJoined, title]);

  const pause = useCallback(() => {
    // A load still in progress must not start playing after the pause.
    loadTokenRef.current += 1;
    clearLoadTimer();
    playerRef.current?.pause();
    if (statusRef.current === 'loading' && !sourceReadyRef.current) {
      setStatus(includedRef.current.length ? 'paused' : 'idle');
    }
    savePosition(true);
  }, [savePosition, clearLoadTimer]);

  const skipBy = useCallback((deltaMs: number) => {
    const player = playerRef.current;
    if (!player || !includedRef.current.length) return;
    const total = joinedDurationMs(includedRef.current);
    const target = Math.min(
      Math.max(0, positionRef.current + deltaMs),
      Math.max(0, total - 500),
    );
    positionRef.current = target;
    setPositionMs(target);
    void player.seekTo(target / 1000);
  }, []);

  const reset = useCallback(() => {
    clearDocumentState();
    if (documentId) saveNarrationPosition(documentId, 0);
  }, [clearDocumentState, documentId]);

  useEffect(() => {
    if (playerRef.current) playerRef.current.setPlaybackRate(rate, 'high');
  }, [rate]);

  // Loop is the player's own once the file has every part; until then it is
  // handled at the end of the file, where new parts are joined in.
  useEffect(() => {
    if (playerRef.current) applyLoop(playerRef.current);
  }, [loop, parts, applyLoop]);

  // Leaving the reader stops playback and releases the player.
  useEffect(
    () => () => {
      savePosition(true);
      clearLoadTimer();
      const player = playerRef.current;
      playerRef.current = null;
      if (player) {
        player.pause();
        player.clearLockScreenControls();
        player.remove();
      }
    },
    [savePosition, clearLoadTimer],
  );

  return {
    status,
    currentPartIndex,
    positionMs,
    totalMs:
      loadedTotalMs !== null && status !== 'idle'
        ? loadedTotalMs
        : narrationTotalMs(parts),
    error,
    play: () => void play(),
    pause,
    skipBy,
    reset,
  };
}
