import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * Run `record` once: when the learner finishes, or when the screen unmounts after
 * they answered at least one item (glossary: quiz attempt / flashcard study session).
 */
export function useRecordOnLeave(hasProgress: boolean, record: () => void) {
  const recorded = useRef(false);
  const latest = useRef({ hasProgress, record });
  latest.current = { hasProgress, record };

  const recordNow = useCallback(() => {
    if (recorded.current || !latest.current.hasProgress) return;
    recorded.current = true;
    latest.current.record();
  }, []);

  /** Start a fresh session (e.g. "Study again") that can be recorded on its own. */
  const reset = useCallback(() => {
    recorded.current = false;
  }, []);

  useEffect(() => () => recordNow(), [recordNow]);
  return useMemo(() => ({ recordNow, reset }), [recordNow, reset]);
}
