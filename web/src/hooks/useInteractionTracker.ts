import { useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useFlushInteractionSessionMutation } from '../store/api/InteractionTracking/interactionTrackingApi';
import { ArtifactType } from '@shared-types';
import { auth, functions } from '../config/firebase';

const HEARTBEAT_INTERVAL_MS = 30_000;
const IDLE_THRESHOLD_MS = 60_000;

/**
 * Build the callable function URL for the current environment
 * (emulator or production) so we can use fetch+keepalive on beforeunload.
 */
function getCallableFunctionUrl(functionName: string): string {
  const emulatorHost = (functions as unknown as { _url?: string; customDomain?: string | null }).customDomain;
  // Check if emulator is connected by inspecting the internal emulator origin
  const fnAny = functions as unknown as { emulatorOrigin?: string };
  if (fnAny.emulatorOrigin) {
    const projectId = auth.app.options.projectId;
    return `${fnAny.emulatorOrigin}/${projectId}/asia-east1/${functionName}`;
  }
  if (emulatorHost) {
    return `${emulatorHost}/${functionName}`;
  }
  const projectId = auth.app.options.projectId;
  return `https://asia-east1-${projectId}.cloudfunctions.net/${functionName}`;
}

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

  /**
   * Fire-and-forget flush via fetch+keepalive. Used only in beforeunload
   * where the page is terminating and the RTK mutation would be cancelled.
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
      // Best-effort: page is unloading, nothing to handle
    }
  }, [artifactId, artifactType, directoryId, user?.uid]);

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

  useEffect(() => {
    if (!artifactId || !directoryId || !user?.uid) return;

    return () => {
      flush();
    };
  }, [artifactId, directoryId, user?.uid, flush]);

  useEffect(() => {
    if (!artifactId || !directoryId || !user?.uid) return;

    const onBeforeUnload = () => {
      flushWithKeepAlive();
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [artifactId, directoryId, user?.uid, flushWithKeepAlive]);
};
