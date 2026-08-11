import { useAppDispatch } from '../../hooks/redux';
import { useAuth } from '../../contexts/AuthContext';
import { useFirestoreEffect } from '../../hooks/useFirestoreEffect';
import { subscribeToUserDoc } from '../../services/firestoreReadUtils';
import {
  parseUsageSummaryFromFirestore,
  USAGE_SUMMARY_COLLECTION,
  USAGE_SUMMARY_DOC_ID,
} from '../../services/usageFirestore';
import { usageApi } from '../../store/api/Usage/usageApi';

/**
 * Keeps usage summary RTK cache in sync when the server updates
 * users/{uid}/usageSummary/current (credits, billing, pay-as-you-go).
 * Mirrors the directory realtime pattern: Firestore onSnapshot + upsertQueryData.
 */
export function UsageRealtimeBridge() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const uid = user?.uid;

  useFirestoreEffect(() => {
    if (!uid) {
      return;
    }

    return subscribeToUserDoc(uid, USAGE_SUMMARY_COLLECTION, USAGE_SUMMARY_DOC_ID, (raw) => {
      if (!raw) {
        return;
      }

      const summary = parseUsageSummaryFromFirestore(raw);
      if (!summary) {
        return;
      }

      dispatch(
        usageApi.util.upsertQueryData('getUsageSummary', undefined, summary),
      );
    });
  }, [uid, dispatch]);

  return null;
}
