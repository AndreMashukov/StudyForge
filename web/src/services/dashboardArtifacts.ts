import {
  collection,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type {
  GetInteractionStatsRequest,
  ICompletedDashboardArtifact,
} from '@shared-types';
import { db } from '../config/firebase';

interface IArtifactCollection {
  collectionName: string;
  artifactType: ICompletedDashboardArtifact['artifactType'];
}

export const DASHBOARD_ARTIFACT_COLLECTIONS: IArtifactCollection[] = [
  { collectionName: 'quizzes', artifactType: 'quiz' },
  { collectionName: 'flashcardSets', artifactType: 'flashcardSet' },
  { collectionName: 'slideDecks', artifactType: 'slideDeck' },
  { collectionName: 'diagramQuizzes', artifactType: 'diagramQuiz' },
  { collectionName: 'sequenceQuizzes', artifactType: 'sequenceQuiz' },
  { collectionName: 'matchQuizzes', artifactType: 'matchQuiz' },
];

export function toCompletedDashboardArtifact(
  id: string,
  artifactType: ICompletedDashboardArtifact['artifactType'],
  raw: DocumentData,
): ICompletedDashboardArtifact | null {
  if (
    raw.generationStatus !== undefined &&
    raw.generationStatus !== 'completed'
  )
    return null;
  const timestamp: unknown = raw.completedAt;
  const completedAt =
    timestamp instanceof Timestamp
      ? timestamp.toDate()
      : timestamp instanceof Date
        ? timestamp
        : typeof timestamp === 'string'
          ? new Date(timestamp)
          : null;
  if (!completedAt || !Number.isFinite(completedAt.getTime())) return null;
  return {
    id,
    artifactType,
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title
        : 'Untitled artifact',
    completedAt: completedAt.toISOString(),
  };
}

export async function fetchCompletedDashboardArtifacts(
  userId: string,
  range: Pick<GetInteractionStatsRequest, 'startDate' | 'endDate'>,
): Promise<ICompletedDashboardArtifact[]> {
  const start = new Date(`${range.startDate}T00:00:00.000Z`);
  const end = new Date(`${range.endDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start >= end
  ) {
    throw new Error('Invalid dashboard date range');
  }
  const results = await Promise.all(
    DASHBOARD_ARTIFACT_COLLECTIONS.map(
      async ({ collectionName, artifactType }) => {
        const artifacts: ICompletedDashboardArtifact[] = [];
        let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
        for (;;) {
          // A single timestamp field avoids new composite indexes; each page obeys the list rules.
          const constraints: QueryConstraint[] = [
            where('completedAt', '>=', Timestamp.fromDate(start)),
            where('completedAt', '<', Timestamp.fromDate(end)),
            orderBy('completedAt', 'desc'),
            limit(50),
          ];
          if (cursor) constraints.push(startAfter(cursor));
          const snapshot = await getDocsFromServer(
            query(
              collection(db, 'users', userId, collectionName),
              ...constraints,
            ),
          );
          for (const record of snapshot.docs) {
            const artifact = toCompletedDashboardArtifact(
              record.id,
              artifactType,
              record.data(),
            );
            if (artifact) artifacts.push(artifact);
          }
          if (snapshot.size < 50) break;
          cursor = snapshot.docs[snapshot.docs.length - 1];
        }
        return artifacts;
      },
    ),
  );
  const unique = new Map<string, ICompletedDashboardArtifact>();
  for (const artifact of results.flat())
    unique.set(`${artifact.artifactType}:${artifact.id}`, artifact);
  return [...unique.values()].sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt),
  );
}
