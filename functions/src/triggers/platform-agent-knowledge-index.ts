import { defineSecret } from 'firebase-functions/params';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as functions from 'firebase-functions/v2';
import { PlatformAgentKnowledgeIndexService } from '@study-forge/backend-agent/knowledge/platform-agent-knowledge-index-service';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';

const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

function readStringField(
  data: FirebaseFirestore.DocumentData | undefined,
  key: string,
): string | undefined {
  const value = data?.[key];
  return typeof value === 'string' ? value : undefined;
}

export const indexPlatformAgentKnowledgeDocument = onDocumentWritten(
  {
    document: 'platformAgentKnowledgeDocuments/{docId}',
    region: 'asia-east1',
    secrets: [llmSettingsEncryptionKey],
  },
  async (event) => {
    const docId = event.params.docId;
    const afterSnapshot = event.data?.after;
    const beforeSnapshot = event.data?.before;

    if (!afterSnapshot?.exists) {
      await PlatformAgentKnowledgeIndexService.deleteDocumentChunks(docId);
      return;
    }

    const after = afterSnapshot.data();
    const before = beforeSnapshot?.data();
    const status = readStringField(after, 'status');
    const indexingStatus = readStringField(after, 'indexingStatus');

    if (status !== 'published' || indexingStatus !== 'indexing') {
      return;
    }
    if (readStringField(before, 'indexingStatus') === 'indexing') {
      return;
    }

    const title = readStringField(after, 'title') ?? 'Untitled';
    const bodyMarkdown = readStringField(after, 'bodyMarkdown') ?? '';
    const publishedBy = readStringField(after, 'publishedBy') ?? 'system';
    const publishedContentHash = readStringField(after, 'publishedContentHash');
    if (!publishedContentHash) {
      await FirestorePaths.platformAgentKnowledgeDocument(docId).set(
        {
          indexingStatus: 'failed',
          indexingError: 'Published content hash is missing.',
        },
        { merge: true },
      );
      return;
    }

    try {
      await PlatformAgentKnowledgeIndexService.replaceDocumentChunks({
        embeddingUserId: publishedBy,
        docId,
        docTitle: title,
        bodyMarkdown,
        sourceContentHash: publishedContentHash,
      });

      const docRef = FirestorePaths.platformAgentKnowledgeDocument(docId);
      await docRef.firestore.runTransaction(async (transaction) => {
        const current = await transaction.get(docRef);
        const currentData = current.data();
        if (
          !current.exists ||
          currentData?.status !== 'published' ||
          currentData?.indexingStatus !== 'indexing' ||
          currentData?.publishedContentHash !== publishedContentHash
        ) {
          return;
        }
        transaction.set(
          docRef,
          {
            indexingStatus: 'indexed',
            indexedAt: new Date().toISOString(),
            indexingError: null,
          },
          { merge: true },
        );
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      functions.logger.error('Platform agent knowledge indexing failed', {
        docId,
        message,
      });
      await FirestorePaths.platformAgentKnowledgeDocument(docId).set(
        {
          indexingStatus: 'failed',
          indexingError: message,
        },
        { merge: true },
      );
    }
  },
);
