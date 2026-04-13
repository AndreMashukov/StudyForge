import { useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useFlushInteractionSessionMutation } from '../store/api/InteractionTracking/interactionTrackingApi';
import { ArtifactType } from '@shared-types';

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
const IDLE_THRESHOLD_MS = 60_000; // 1 minute without activity = idle

interface UseInteractionTrackerOptions {
  artifactId: string | undefined;
  artifactType: ArtifactType;
  directoryId: string | undefined;
}

export const useInteractionTracker = ({
  artifactId,
  artifactType,
  directoryId,
}: UseInteractionTrackerOptions) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [flushSession] = useFlushInteractionSessionMutation();

  const accumulatedSecondsRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const startedAtRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(!document.hidden);

  const flush = useCallback(() => {
    if (
      !artifactId ||
      !directoryId ||
      !user?.uid ||
      !startedAtRef.current ||
      accumulatedSecondsRef.current <= 0
    ) {
      return;
    }

    const seconds = accumulatedSecondsRef.current;
    accumulatedSecondsRef.current = 0;

    flushSession({
      artifactId,
      artifactType,
      directoryId,
      activeSeconds: seconds,
      startedAt: startedAtRef.current,
    });
  }, [artifactId, artifactType, directoryId, user?.uid, flushSession]);

  // Track user activity (mouse, keyboard, scroll, touch)
  useEffect(() => {
    if (!artifactId || !directoryId || !user?.uid) return;

    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('scroll', onActivity, { passive: true });
    window.addEventListener('touchstart', onActivity, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('touchstart', onActivity);
    };
  }, [artifactId, directoryId, user?.uid]);

  // Heartbeat: accumulate active time every interval
  useEffect(() => {
    if (!artifactId || !directoryId || !user?.uid) return;

    startedAtRef.current = new Date().toISOString();
    accumulatedSecondsRef.current = 0;

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const isIdle = now - lastActivityRef.current > IDLE_THRESHOLD_MS;

      if (isVisibleRef.current && !isIdle) {
        accumulatedSecondsRef.current += HEARTBEAT_INTERVAL_MS / 1000;
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [artifactId, directoryId, user?.uid]);

  // Visibility change: flush on hide, resume on show
  useEffect(() => {
    if (!artifactId || !directoryId || !user?.uid) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        isVisibleRef.current = false;
        flush();
      } else {
        isVisibleRef.current = true;
        lastActivityRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [artifactId, directoryId, user?.uid, flush]);

  // Flush on unmount
  useEffect(() => {
    if (!artifactId || !directoryId || !user?.uid) return;

    return () => {
      flush();
    };
  }, [artifactId, directoryId, user?.uid, flush]);

  // Flush on beforeunload (tab close / navigation away)
  useEffect(() => {
    if (!artifactId || !directoryId || !user?.uid) return;

    const onBeforeUnload = () => {
      flush();
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [artifactId, directoryId, user?.uid, flush]);
};
