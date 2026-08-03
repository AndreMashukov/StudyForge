import { getBytes, ref } from 'firebase/storage';
import type { DocumentContentFormat } from '@shared-types';
import { auth, storage } from '../config/firebase';

export function getDocumentHtmlStoragePath(userId: string, documentId: string): string {
  return `users/${userId}/documents/${documentId}/content.html`;
}

export function getDocumentMarkdownStoragePath(userId: string, documentId: string): string {
  return `users/${userId}/documents/${documentId}/content.md`;
}

export async function fetchDocumentContentFromStorage(
  documentId: string,
  options?: { storagePath?: string; contentFormat?: DocumentContentFormat }
): Promise<{ content: string; contentFormat: DocumentContentFormat }> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('Authentication required');
  }

  if (!documentId.trim()) {
    throw new Error('Document ID is required');
  }

  const candidates: Array<{ path: string; contentFormat: DocumentContentFormat }> = [];
  if (options?.storagePath) {
    candidates.push({
      path: options.storagePath,
      contentFormat: options.contentFormat ?? (options.storagePath.endsWith('.html') ? 'html' : 'markdown'),
    });
  } else if (options?.contentFormat === 'html') {
    candidates.push({ path: getDocumentHtmlStoragePath(userId, documentId), contentFormat: 'html' });
  } else if (options?.contentFormat === 'markdown') {
    candidates.push({ path: getDocumentMarkdownStoragePath(userId, documentId), contentFormat: 'markdown' });
  } else {
    candidates.push(
      { path: getDocumentHtmlStoragePath(userId, documentId), contentFormat: 'html' },
      { path: getDocumentMarkdownStoragePath(userId, documentId), contentFormat: 'markdown' }
    );
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const fileRef = ref(storage, candidate.path);
      const bytes = await getBytes(fileRef);
      return {
        content: new TextDecoder('utf-8').decode(bytes),
        contentFormat: candidate.contentFormat,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Document content not found in storage');
}
