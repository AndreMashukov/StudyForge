import { onlineManager } from '@tanstack/react-query';
import { recordFlashcardStudySessionInFirestore } from '@studyforge/client-data/flashcardStudySessionMutations';
import { recordLearnedVocabularyInFirestore } from '@studyforge/client-data/learnedVocabularyMutations';
import { recordQuizAttemptInFirestore } from '@studyforge/client-data/learningTelemetryMutations';
import { auth } from '../../lib/firebase';
import {
  getStorageString,
  hydrateAppStorage,
  setStorageString,
} from '../../lib/storage/appStorage';
import { createTelemetryOutbox } from './telemetryOutbox';

const OUTBOX_STORAGE_KEY = 'studyforge.mobile.telemetryOutbox.v1';

export const telemetryOutbox = createTelemetryOutbox({
  storage: {
    read: () => getStorageString(OUTBOX_STORAGE_KEY),
    write: (value) => setStorageString(OUTBOX_STORAGE_KEY, value),
  },
  senders: {
    quizAttempt: (userId, request) =>
      recordQuizAttemptInFirestore(userId, request),
    flashcardSession: (userId, request) =>
      recordFlashcardStudySessionInFirestore(userId, request),
    learnedVocabulary: (userId, request) =>
      recordLearnedVocabularyInFirestore({ userId, ...request }),
  },
  isOnline: () => onlineManager.isOnline(),
  canSend: (entry) => auth.currentUser?.uid === entry.userId,
});

let started = false;

/** Load the queue, send anything left from earlier sessions, and resend whenever the device comes back online. */
export async function startTelemetryOutbox(): Promise<void> {
  if (started) return;
  started = true;
  await hydrateAppStorage([OUTBOX_STORAGE_KEY]);
  void telemetryOutbox.flush();
  onlineManager.subscribe((online) => {
    if (online) void telemetryOutbox.flush();
  });
  auth.onAuthStateChanged((user) => {
    if (user) void telemetryOutbox.flush();
  });
}
