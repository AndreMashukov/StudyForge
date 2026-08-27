import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import type { Directory, DirectoryTreeNode, GetDirectoryTreeResponse } from '@shared-types';
import { auth, db } from '../firebase';
import { directorySchema } from './studyforgeApiSchemas';

function buildDirectoryTreeFromDirectories(directories: Directory[]): DirectoryTreeNode[] {
  const nodeMap = new Map<string, DirectoryTreeNode>();
  const rootNodes: DirectoryTreeNode[] = [];

  for (const dir of directories) {
    nodeMap.set(dir.id, { directory: dir, children: [] });
  }

  for (const dir of directories) {
    const node = nodeMap.get(dir.id);
    if (!node) {
      continue;
    }
    if (dir.parentId && nodeMap.has(dir.parentId)) {
      const parentNode = nodeMap.get(dir.parentId);
      if (parentNode) {
        parentNode.children.push(node);
      }
    } else {
      rootNodes.push(node);
    }
  }

  return rootNodes;
}

function toDateValue(
  value: Date | { toDate(): Date } | { seconds: number; nanoseconds: number } | string,
): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    return new Date(value);
  }
  if ('toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if ('seconds' in value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return new Date();
}

function toDirectory(id: string, raw: unknown): Directory | null {
  const source = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {};
  const parsed = directorySchema.safeParse({
    ...source,
    id,
  });
  if (!parsed.success) {
    return null;
  }
  return {
    ...parsed.data,
    createdAt: toDateValue(parsed.data.createdAt),
    updatedAt: toDateValue(parsed.data.updatedAt),
  };
}

export async function fetchDirectoryTreeFromFirestore(): Promise<GetDirectoryTreeResponse> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('Authentication required');
  }

  const snapshot = await getDocs(
    query(collection(db, 'users', userId, 'directories'), orderBy('path', 'asc')),
  );

  const directories = snapshot.docs.flatMap((docSnap) => {
    const directory = toDirectory(docSnap.id, docSnap.data());
    return directory ? [directory] : [];
  });

  return {
    tree: buildDirectoryTreeFromDirectories(directories),
    totalDirectories: directories.length,
  };
}
