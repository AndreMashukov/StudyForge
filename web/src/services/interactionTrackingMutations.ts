import {
  addDoc,
  FieldPath,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { ArtifactType, InteractionStat } from '@shared-types';
import { db } from '../config/firebase';
import { computeExpiresAt } from './firestoreTtl';
import {
  directoryRef,
  interactionSessionCollection,
  interactionStatCollection,
  interactionStatRef,
} from './firestorePaths';

const EMPTY_ARTIFACT_COUNTS: Record<ArtifactType, number> = {
  document: 0,
  quiz: 0,
  flashcardSet: 0,
  slideDeck: 0,
  diagramQuiz: 0,
  sequenceQuiz: 0,
};

export async function getAncestorDirectoryIds(
  userId: string,
  directoryId: string,
): Promise<string[]> {
  const ancestors: string[] = [directoryId];
  let currentId: string | null = directoryId;

  for (let depth = 0; depth < 10 && currentId; depth += 1) {
    const dirDoc = await getDoc(directoryRef(userId, currentId));
    if (!dirDoc.exists()) {
      break;
    }
    const parentId = dirDoc.data().parentId as string | null | undefined;
    if (!parentId) {
      break;
    }
    ancestors.push(parentId);
    currentId = parentId;
  }

  return ancestors;
}

export async function flushInteractionSessionInFirestore(
  userId: string,
  data: {
    artifactId: string;
    artifactType: ArtifactType;
    directoryId: string;
    activeSeconds: number;
    startedAt: string;
  },
): Promise<string> {
  const { artifactId, artifactType, directoryId, activeSeconds, startedAt } = data;
  if (activeSeconds <= 0) {
    throw new Error('activeSeconds must be positive');
  }

  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  const sessionRef = await addDoc(interactionSessionCollection(userId), {
    userId,
    artifactId,
    artifactType,
    directoryId,
    startedAt: Timestamp.fromDate(new Date(startedAt)),
    lastActiveAt: serverTimestamp(),
    activeSeconds,
    date,
    expiresAt: computeExpiresAt(now, 'interactionSession'),
  });

  const ancestorIds = await getAncestorDirectoryIds(userId, directoryId);
  const batch = writeBatch(db);

  for (let i = 0; i < ancestorIds.length; i += 1) {
    const dirId = ancestorIds[i];
    const statId = `${dirId}_${date}`;
    const statRef = interactionStatRef(userId, statId);
    const isLeaf = i === 0;

    batch.set(
      statRef,
      {
        userId,
        directoryId: dirId,
        date,
        totalSeconds: increment(activeSeconds),
        ownSeconds: isLeaf ? increment(activeSeconds) : increment(0),
        byArtifactType: { [artifactType]: increment(activeSeconds) },
        sessionCount: increment(1),
      },
      {
        mergeFields: [
          'userId',
          'directoryId',
          'date',
          'totalSeconds',
          'ownSeconds',
          'sessionCount',
          new FieldPath('byArtifactType', artifactType),
        ],
      },
    );
  }

  await batch.commit();
  return sessionRef.id;
}

export async function getInteractionStatsFromFirestore(
  userId: string,
  data: {
    directoryId?: string;
    startDate: string;
    endDate: string;
  },
): Promise<InteractionStat[]> {
  const constraints = [
    where('date', '>=', data.startDate),
    where('date', '<=', data.endDate),
    ...(data.directoryId ? [where('directoryId', '==', data.directoryId)] : []),
  ];

  const snapshot = await getDocs(
    query(interactionStatCollection(userId), ...constraints),
  );

  return snapshot.docs.map((statDoc) => {
    const d = statDoc.data();
    return {
      id: statDoc.id,
      userId: d.userId as string,
      directoryId: d.directoryId as string,
      date: d.date as string,
      totalSeconds: (d.totalSeconds as number) || 0,
      ownSeconds: (d.ownSeconds as number) || 0,
      byArtifactType: {
        ...EMPTY_ARTIFACT_COUNTS,
        ...(d.byArtifactType as Partial<Record<ArtifactType, number>> | undefined),
      },
      sessionCount: (d.sessionCount as number) || 0,
    };
  });
}

export async function recalculateStatsForDirectoryMove(
  userId: string,
  movedDirectoryId: string,
  oldParentId: string | null,
  newParentId: string | null,
): Promise<void> {
  const oldAncestors = oldParentId
    ? await getAncestorDirectoryIds(userId, oldParentId)
    : [];
  const newAncestors = newParentId
    ? await getAncestorDirectoryIds(userId, newParentId)
    : [];

  const oldSet = new Set(oldAncestors);
  const newSet = new Set(newAncestors);
  const removedAncestors = oldAncestors.filter((id) => !newSet.has(id));
  const addedAncestors = newAncestors.filter((id) => !oldSet.has(id));

  if (removedAncestors.length === 0 && addedAncestors.length === 0) {
    return;
  }

  const movedStatsSnap = await getDocs(
    query(
      interactionStatCollection(userId),
      where('directoryId', '==', movedDirectoryId),
    ),
  );

  if (movedStatsSnap.empty) {
    return;
  }

  for (const movedStat of movedStatsSnap.docs) {
    const statData = movedStat.data();
    const date = statData.date as string;
    const totalSeconds = (statData.totalSeconds as number) || 0;
    const byArtifactType = (statData.byArtifactType as Record<string, number>) || {};

    const batch = writeBatch(db);

    for (const ancestorId of removedAncestors) {
      const statRef = interactionStatRef(userId, `${ancestorId}_${date}`);
      batch.set(
        statRef,
        {
          totalSeconds: increment(-totalSeconds),
          byArtifactType: Object.fromEntries(
            Object.entries(byArtifactType).map(([type, seconds]) => [
              type,
              increment(-seconds),
            ]),
          ),
        },
        { merge: true },
      );
    }

    for (const ancestorId of addedAncestors) {
      const statRef = interactionStatRef(userId, `${ancestorId}_${date}`);
      batch.set(
        statRef,
        {
          userId,
          directoryId: ancestorId,
          date,
          totalSeconds: increment(totalSeconds),
          ownSeconds: increment(0),
          byArtifactType: Object.fromEntries(
            Object.entries(byArtifactType).map(([type, seconds]) => [
              type,
              increment(seconds),
            ]),
          ),
          sessionCount: increment(0),
        },
        { merge: true },
      );
    }

    await batch.commit();
  }
}
