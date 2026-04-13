import { useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useFlushInteractionSessionMutation } from '../store/api/InteractionTracking/interactionTrackingApi';
import { ArtifactType } from '@shared-types';
import { auth, useEmulator } from '../config/firebase';

const HEARTBEAT_INTERVAL_MS = 30_000;
const IDLE_THRESHOLD_MS = 60_000;

const FUNCTIONS_REGION = 'asia-east1';
const EMULATOR_FUNCTIONS_HOST = 'http://127.0.0.1:5001';

/**
 * Derive the callable function URL from env config (no SDK internals).
 * Mirrors the emulator/production decision made in config/firebase.ts.
 */
function getCallableFunctionUrl(functionName: string): string {
  const projectId = auth.app.options.projectId;
  if (useEmulator) {
    return `${EMULATOR_FUNCTIONS_HOST}/${projectId}/${FUNCTIONS_REGION}/${functionName}`;
  }
  return `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net/${functionName}`;
}

interface IUseInteractionTrackerOptions {
  artifactId: string | undefined;
  artifactType: ArtifactType;
  directoryId: string | undefined;
}

export const useInteractionTracker = ({
  artifactId,
  artifactType,
  directoryId,
}: IUseInteractionTrackerOptions) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [flushSession] = useFlushInteractionSessionMutation();

  const accumulatedSecondsRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const startedAtRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(!document.hidden);

  const flush = useCallback(async () => {
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

    try {
      await flushSession({
        artifactId,
        artifactType,
        directoryId,
        activeSeconds: seconds,
        startedAt: startedAtRef.current,
      }).unwrap();
      accumulatedSecondsRef.current -= seconds;
    } catch {
      // Mutation failed — seconds remain in the buffer for the next flush
    }
  }, [artifactId, artifactType, directoryId, user?.uid, flushSession]);

  /**
   * Fire-and-forget flush via fetch+keepalive for beforeunload only.
   * Uses env-based URL derivation — no Firebase SDK internals.
   */
  const flushWithKeepAlive = useCallback(async () => {
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

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const url = getCallableFunctionUrl('flushInteractionSession');
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            artifactId,
            artifactType,
            directoryId,
            activeSeconds: seconds,
            startedAt: startedAtRef.current,
          },
        }),
        keepalive: true,
      });
    } catch {
      // Best-effort: page is unloading, nothing to recover
    }
  }, [artifactId, artifactType, directoryId, user?.uid]);

  useEffect(() => {
    if (!artifactId || !directoryId || !user?.uid) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('scroll', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [artifactId, directoryId, user?.uid]);

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

  useEffect(() => {
    if (!artifactId || !directoryId || !user?.uid) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isVisibleRef.current = false;
        flush();
      } else {
        isVisibleRef.current = true;
        lastActivityRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [artifactId, directoryId, user?.uid, flush]);

  useEffect(() => {
    if (!artifactId || !directoryId || !user?.uid) return;

    return () => {
      flush();
    };
  }, [artifactId, directoryId, user?.uid, flush]);

  useEffect(() => {
    if (!artifactId || !directoryId || !user?.uid) return;

    const handleBeforeUnload = () => {
      flushWithKeepAlive();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [artifactId, directoryId, user?.uid, flushWithKeepAlive]);
};
