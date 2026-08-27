import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import type { Directory, DirectoryTreeNode, GetDirectoryTreeResponse } from '@shared-types';
import { auth, db } from '../firebase';

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

function toDirectory(id: string, raw: Record<string, unknown>): Directory {
  return { id, ...raw } as Directory;
}

export async function fetchDirectoryTreeFromFirestore(): Promise<GetDirectoryTreeResponse> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('Authentication required');
  }

  const snapshot = await getDocs(
    query(collection(db, 'users', userId, 'directories'), orderBy('path', 'asc')),
  );

  const directories = snapshot.docs.map((docSnap) =>
    toDirectory(docSnap.id, docSnap.data()),
  );

  return {
    tree: buildDirectoryTreeFromDirectories(directories),
    totalDirectories: directories.length,
  };
}
