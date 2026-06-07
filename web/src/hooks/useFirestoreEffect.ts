import { useEffect, useRef, type DependencyList } from 'react';

/**
 * Runs Firestore subscription setup/teardown with StrictMode-safe timing.
 * In development, defers subscribe/unsubscribe by one microtask so React's
 * synchronous remount can cancel before watch targets hit the server.
 */
export const useFirestoreEffect = (
  effect: () => void | (() => void),
  deps: DependencyList,
): void => {
  const cleanupRef = useRef<(() => void) | void>(undefined);

  useEffect(() => {
    let cancelled = false;

    const runSetup = () => {
      if (cancelled) return;
      cleanupRef.current = effect();
    };

    const runCleanup = () => {
      const cleanup = cleanupRef.current;
      cleanupRef.current = undefined;
      cleanup?.();
    };

    if (import.meta.env.DEV) {
      queueMicrotask(runSetup);
    } else {
      runSetup();
    }

    return () => {
      cancelled = true;
      runCleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
