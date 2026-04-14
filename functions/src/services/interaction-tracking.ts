import { FieldPath, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { FirestorePaths } from '../lib/firestore-paths';
import { ArtifactType, InteractionStat } from '../../libs/shared-types/src/index';

const EMPTY_ARTIFACT_COUNTS: Record<ArtifactType, number> = {
  document: 0,
  quiz: 0,
  flashcardSet: 0,
  slideDeck: 0,
  diagramQuiz: 0,
  sequenceQuiz: 0,
};

/**
 * Collect ancestor directory IDs by walking up parentId chain.
 * Returns [directoryId, parentId, grandparentId, ...] — leaf first.
 */
export async function getAncestorDirectoryIds(
  userId: string,
  directoryId: string
): Promise<string[]> {
  const ancestors: string[] = [directoryId];
  let currentId: string | null = directoryId;

  // Walk up the tree (max 10 levels to match directory depth limit)
  for (let depth = 0; depth < 10 && currentId; depth++) {
    const dirDoc = await FirestorePaths.directory(userId, currentId).get();
    if (!dirDoc.exists) break;

    const parentId = dirDoc.data()?.parentId as string | null;
    if (!parentId) break;

    ancestors.push(parentId);
    currentId = parentId;
  }

  return ancestors;
}

/**
 * Flush a user interaction session: persist session doc + propagate stats to ancestors.
 */
export async function flushInteractionSession(
  userId: string,
  data: {
    artifactId: string;
    artifactType: ArtifactType;
    directoryId: string;
    activeSeconds: number;
    startedAt: string;
  }
): Promise<string> {
  const { artifactId, artifactType, directoryId, activeSeconds, startedAt } = data;

  if (activeSeconds <= 0) {
    throw new Error('activeSeconds must be positive');
  }

  const now = new Date();
  const date = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

  // 1. Persist the session document
  const sessionRef = FirestorePaths.interactionSessions(userId).doc();
  await sessionRef.set({
    userId,
    artifactId,
    artifactType,
    directoryId,
    startedAt: Timestamp.fromDate(new Date(startedAt)),
    lastActiveAt: Timestamp.now(),
    activeSeconds,
    date,
  });

  // 2. Get ancestor chain for hierarchical rollup
  const ancestorIds = await getAncestorDirectoryIds(userId, directoryId);

  logger.info('Propagating interaction stats', {
    userId,
    directoryId,
    ancestorIds,
    activeSeconds,
    date,
  });

  // 3. Batch increment stats for leaf + all ancestors
  const batch = FirestorePaths.interactionSessions(userId).firestore.batch();

  for (let i = 0; i < ancestorIds.length; i++) {
    const dirId = ancestorIds[i];
    const statId = `${dirId}_${date}`;
    const statRef = FirestorePaths.interactionStat(userId, statId);
    const isLeaf = i === 0;

    // Use mergeFields with explicit FieldPath for the nested byArtifactType field.
    // set() with { merge: true } and dot-notation keys creates literal top-level
    // fields (e.g. "byArtifactType.diagramQuiz") rather than nested paths.
    // mergeFields + FieldPath is the correct way to atomically increment a nested field.
    batch.set(
      statRef,
      {
        userId,
        directoryId: dirId,
        date,
        totalSeconds: FieldValue.increment(activeSeconds),
        ownSeconds: isLeaf
          ? FieldValue.increment(activeSeconds)
          : FieldValue.increment(0),
        byArtifactType: { [artifactType]: FieldValue.increment(activeSeconds) },
        sessionCount: FieldValue.increment(1),
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
      }
    );
  }

  await batch.commit();

  return sessionRef.id;
}

/**
 * Query interaction stats for a date range, optionally filtered by directory.
 */
export async function getInteractionStats(
  userId: string,
  data: {
    directoryId?: string;
    startDate: string;
    endDate: string;
  }
): Promise<InteractionStat[]> {
  const { directoryId, startDate, endDate } = data;

  let query = FirestorePaths.interactionStats(userId)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate);

  if (directoryId) {
    query = query.where('directoryId', '==', directoryId);
  }

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      userId: d.userId,
      directoryId: d.directoryId,
      date: d.date,
      totalSeconds: d.totalSeconds || 0,
      ownSeconds: d.ownSeconds || 0,
      byArtifactType: {
        ...EMPTY_ARTIFACT_COUNTS,
        ...(d.byArtifactType || {}),
      },
      sessionCount: d.sessionCount || 0,
    };
  });
}

/**
 * Recalculate interaction stats ancestry after a directory move.
 *
 * When a directory moves from oldParentId → newParentId, the old ancestor chain
 * had the moved subtree's totalSeconds rolled up into it; the new ancestor chain
 * does not yet. This function adjusts the affected ancestor stat documents in
 * batch so totals stay consistent.
 *
 * - ownSeconds on ancestors is never touched (it only reflects their own artifacts).
 * - The moved directory's own stat documents are correct and unchanged.
 */
export async function recalculateStatsForDirectoryMove(
  userId: string,
  movedDirectoryId: string,
  oldParentId: string | null,
  newParentId: string | null
): Promise<void> {
  // Build old ancestor chain (excluding the moved directory itself)
  const oldAncestors = oldParentId
    ? await getAncestorDirectoryIds(userId, oldParentId)
    : [];

  // Build new ancestor chain (excluding the moved directory itself)
  const newAncestors = newParentId
    ? await getAncestorDirectoryIds(userId, newParentId)
    : [];

  const oldSet = new Set(oldAncestors);
  const newSet = new Set(newAncestors);

  // Ancestors that are in old chain only → need decrement
  const removedAncestors = oldAncestors.filter((id) => !newSet.has(id));
  // Ancestors that are in new chain only → need increment
  const addedAncestors = newAncestors.filter((id) => !oldSet.has(id));

  if (removedAncestors.length === 0 && addedAncestors.length === 0) {
    logger.info('No ancestor changes after directory move, skipping stat recalculation', {
      userId,
      movedDirectoryId,
    });
    return;
  }

  logger.info('Recalculating interaction stats after directory move', {
    userId,
    movedDirectoryId,
    removedAncestors,
    addedAncestors,
  });

  // Query all historical stat docs for the moved directory — each represents one
  // date and carries the full subtree's rolled-up contribution for that day.
  const statSnapshot = await FirestorePaths.interactionStats(userId)
    .where('directoryId', '==', movedDirectoryId)
    .get();

  if (statSnapshot.empty) {
    logger.info('No interaction stats found for moved directory, nothing to recalculate', {
      userId,
      movedDirectoryId,
    });
    return;
  }

  const db = FirestorePaths.interactionStats(userId).firestore;
  const BATCH_LIMIT = 500;
  let currentBatch = db.batch();
  let writesInBatch = 0;
  const batches = [currentBatch];

  const addWrite = () => {
    writesInBatch++;
    if (writesInBatch >= BATCH_LIMIT) {
      currentBatch = db.batch();
      batches.push(currentBatch);
      writesInBatch = 0;
    }
  };

  for (const statDoc of statSnapshot.docs) {
    const stat = statDoc.data();
    const date = stat.date as string;
    const totalSeconds = (stat.totalSeconds as number) || 0;
    const sessionCount = (stat.sessionCount as number) || 0;
    const byArtifactType = (stat.byArtifactType as Record<ArtifactType, number>) || {};

    // Decrement old-only ancestors
    for (const ancestorId of removedAncestors) {
      const statId = `${ancestorId}_${date}`;
      const statRef = FirestorePaths.interactionStat(userId, statId);

      currentBatch.set(
        statRef,
        {
          totalSeconds: FieldValue.increment(-totalSeconds),
          sessionCount: FieldValue.increment(-sessionCount),
          byArtifactType: Object.fromEntries(
            Object.entries(byArtifactType).map(([type, secs]) => [
              type,
              FieldValue.increment(-(secs as number)),
            ])
          ),
        },
        {
          mergeFields: [
            'totalSeconds',
            'sessionCount',
            ...Object.keys(byArtifactType).map(
              (type) => new FieldPath('byArtifactType', type)
            ),
          ],
        }
      );
      addWrite();
    }

    // Increment new-only ancestors
    for (const ancestorId of addedAncestors) {
      const statId = `${ancestorId}_${date}`;
      const statRef = FirestorePaths.interactionStat(userId, statId);

      currentBatch.set(
        statRef,
        {
          userId,
          directoryId: ancestorId,
          date,
          totalSeconds: FieldValue.increment(totalSeconds),
          sessionCount: FieldValue.increment(sessionCount),
          byArtifactType: Object.fromEntries(
            Object.entries(byArtifactType).map(([type, secs]) => [
              type,
              FieldValue.increment(secs as number),
            ])
          ),
        },
        {
          mergeFields: [
            'userId',
            'directoryId',
            'date',
            'totalSeconds',
            'sessionCount',
            ...Object.keys(byArtifactType).map(
              (type) => new FieldPath('byArtifactType', type)
            ),
          ],
        }
      );
      addWrite();
    }
  }

  // Commit all batches sequentially
  for (const batch of batches) {
    await batch.commit();
  }

  logger.info('Interaction stats recalculated after directory move', {
    userId,
    movedDirectoryId,
    statDocsProcessed: statSnapshot.size,
    removedAncestors: removedAncestors.length,
    addedAncestors: addedAncestors.length,
  });
}
