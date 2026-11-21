import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { narrationRecordSchema, type NarrationRecord } from '@shared-types';
import { db } from '../../lib/firebase';

export interface INarrationRecordState {
  /** Null when the document has no narration. Undefined until the first snapshot. */
  record: NarrationRecord | null | undefined;
  error: Error | null;
}

/** Follows `users/{uid}/narrations/{documentId}`, which Functions update part by part. */
export function useNarrationRecord(
  userId: string | undefined,
  documentId: string | undefined,
): INarrationRecordState {
  const [state, setState] = useState<INarrationRecordState>({
    record: undefined,
    error: null,
  });

  useEffect(() => {
    if (!userId || !documentId) {
      setState({ record: undefined, error: null });
      return;
    }
    let active = true;
    const unsubscribe = onSnapshot(
      doc(db, 'users', userId, 'narrations', documentId),
      (snapshot) => {
        if (!active) return;
        if (!snapshot.exists()) {
          setState({ record: null, error: null });
          return;
        }
        const parsed = narrationRecordSchema.safeParse(snapshot.data());
        setState(
          parsed.success
            ? { record: parsed.data, error: null }
            : {
                record: null,
                error: new Error('This narration could not be read.'),
              },
        );
      },
      (error) => {
        if (active) setState({ record: undefined, error });
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, documentId]);

  return state;
}
