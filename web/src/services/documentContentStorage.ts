import { getBytes, ref } from 'firebase/storage';
import { auth, storage } from '../config/firebase';

export function getDocumentContentStoragePath(userId: string, documentId: string): string {
  return `users/${userId}/documents/${documentId}/content.md`;
}

export async function fetchDocumentContentFromStorage(documentId: string): Promise<string> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('Authentication required');
  }

  if (!documentId.trim()) {
    throw new Error('Document ID is required');
  }

  const fileRef = ref(storage, getDocumentContentStoragePath(userId, documentId));
  const bytes = await getBytes(fileRef);
  return new TextDecoder('utf-8').decode(bytes);
}
