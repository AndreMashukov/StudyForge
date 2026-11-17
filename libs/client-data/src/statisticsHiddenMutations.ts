import { serverTimestamp, setDoc } from 'firebase/firestore';
import {
  encodeStatisticsHiddenFailureId,
  HideStatisticsFailureRequest,
} from '@shared-types';
import { statisticsHiddenFailureRef } from './firestorePaths';

export async function hideStatisticsFailureInFirestore(
  userId: string,
  data: HideStatisticsFailureRequest,
): Promise<string> {
  if (!data.groupKey) {
    throw new Error('groupKey is required');
  }

  const id = encodeStatisticsHiddenFailureId(data.groupKey);
  await setDoc(statisticsHiddenFailureRef(userId, id), {
    id,
    kind: data.kind,
    groupKey: data.groupKey,
    ...(data.quizType ? { quizType: data.quizType } : {}),
    ...(data.quizId ? { quizId: data.quizId } : {}),
    ...(data.questionIndex !== undefined
      ? { questionIndex: data.questionIndex }
      : {}),
    ...(data.flashcardSetId ? { flashcardSetId: data.flashcardSetId } : {}),
    ...(data.flashcardId ? { flashcardId: data.flashcardId } : {}),
    hiddenAt: serverTimestamp(),
  });

  return id;
}
