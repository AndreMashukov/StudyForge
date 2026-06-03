import 'server-only';

import { requireAdminSession } from '../auth/session';
import { getAdminFirestore } from '../firebase/admin';

export interface IAdminDocumentSummary {
  id: string;
  userId: string;
  title: string;
  createdAt?: string;
}

export async function listRecentDocuments(
  limit = 25
): Promise<IAdminDocumentSummary[]> {
  await requireAdminSession();

  const db = getAdminFirestore();
  const usersSnapshot = await db.collection('users').limit(10).get();
  const documents: IAdminDocumentSummary[] = [];

  for (const userDoc of usersSnapshot.docs) {
    const docsSnapshot = await userDoc.ref
      .collection('documents')
      .limit(Math.ceil(limit / 10))
      .get();

    for (const doc of docsSnapshot.docs) {
      const data = doc.data();
      documents.push({
        id: doc.id,
        userId: userDoc.id,
        title: (data.title as string) || 'Untitled',
        createdAt:
          typeof data.createdAt?.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : undefined,
      });
    }
  }

  return documents.slice(0, limit);
}
