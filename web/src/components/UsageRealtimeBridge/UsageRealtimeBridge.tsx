import { useAppDispatch } from '../../hooks/redux';
import { useAuth } from '../../contexts/AuthContext';
import { useFirestoreEffect } from '../../hooks/useFirestoreEffect';
import { subscribeToUserDoc } from '../../services/firestoreReadUtils';
import { baseApi } from '../../store/api/baseApi';
import {
  USAGE_SUMMARY_COLLECTION,
  USAGE_SUMMARY_DOC_ID,
} from '../../services/usageFirestore';

/**
 * Keeps the usage credits meter in sync when the server updates
 * users/{uid}/usageSummary/current after reserve/commit/refund.
 */
export function UsageRealtimeBridge() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const uid = user?.uid;

  useFirestoreEffect(() => {
    if (!uid) {
      return;
    }

    let isInitial = true;

    return subscribeToUserDoc(uid, USAGE_SUMMARY_COLLECTION, USAGE_SUMMARY_DOC_ID, () => {
      if (isInitial) {
        isInitial = false;
        return;
      }

      dispatch(baseApi.util.invalidateTags(['UsageSummary']));
    });
  }, [uid, dispatch]);

  return null;
}
