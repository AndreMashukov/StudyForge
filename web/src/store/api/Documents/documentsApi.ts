import { baseApi } from '../baseApi';
import { createDocumentOnQueryStarted } from '../utils/createDocumentOnQueryStarted';
import type { DocumentContentFormat } from '@shared-types';
import { fetchDocumentContentFromStorage } from '../../../services/documentContentStorage';
import {
  fetchDocumentFromFirestore,
  fetchUserDocumentsFromFirestore,
} from '../../../services/documentFirestore';
import {
  updateDocumentInFirestore,
  deleteDocumentInFirestore,
} from '../../../services/documentMutations';
import { executeBulkOperation } from '../../../services/bulkOperation';
import { auth } from '../../../config/firebase';
import {
  authRequiredError,
  customError,
  notFoundError,
  toFirestoreDoc,
} from '../../../services/firestoreReadUtils';
import { attachArtifactDocListener } from '../utils/artifactDetailRealtime';
import {
  DocumentEnhanced,
  CreateDocumentRequest,
  CreateDocumentFromUrlsRequest,
  CreateDocumentFromPastedTextRequest,
  StartGenerationResponse,
  UpdateDocumentRequest,
  DeleteDocumentRequest,
  GenerateFromPromptRequest,
  GenerateFromPromptResponse,
  UploadDocumentRequest,
  IBulkDeleteDocumentsRequest,
  IBulkOperationResponse,
} from '@shared-types';

interface ListDocumentsResponse {
  documents: DocumentEnhanced[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface IGetUserDocumentsArgs {
  limit?: number;
  directoryId?: string;
  cursor?: string;
}

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const documentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUserDocuments: builder.query<ListDocumentsResponse, IGetUserDocumentsArgs | void>({
      async queryFn(args) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const page = await fetchUserDocumentsFromFirestore(userId, {
            limit: args?.limit,
            directoryId: args?.directoryId,
            cursor: args?.cursor,
          });
          return {
            data: {
              documents: page.documents,
              total: page.total,
              hasMore: page.hasMore,
              nextCursor: page.nextCursor,
            },
          };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: ['Document'],
    }),

    getDocument: builder.query<DocumentEnhanced, string>({
      async queryFn(documentId) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        if (!documentId.trim()) {
          return customError('Document ID is required');
        }

        try {
          const document = await fetchDocumentFromFirestore(userId, documentId);
          if (!document) return notFoundError('Document not found');
          return { data: document };
        } catch (error) {
          return mutationError(error);
        }
      },
      async onCacheEntryAdded(documentId, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        await attachArtifactDocListener({
          collectionName: 'documents',
          docId: documentId,
          cacheDataLoaded,
          cacheEntryRemoved,
          onMapped: (document: DocumentEnhanced) => {
            updateCachedData((draft) => {
              Object.assign(draft, document);
            });
          },
          mapSnapshot: (id, raw) => toFirestoreDoc<DocumentEnhanced>(id, raw),
        });
      },
      providesTags: (_result, _error, documentId) => [
        { type: 'Document', id: documentId },
      ],
      keepUnusedDataFor: 300,
    }),

    createDocument: builder.mutation<DocumentEnhanced, CreateDocumentRequest>({
      query: (data) => ({
        functionName: 'createDocument',
        data,
      }),
      transformResponse: (response: { success: boolean; document: DocumentEnhanced }) =>
        response.document,
      invalidatesTags: ['Document', { type: 'Directory', id: 'LIST' }],
      onQueryStarted: createDocumentOnQueryStarted('Document', 'create document'),
    }),

    createDocumentFromUrl: builder.mutation<DocumentEnhanced, CreateDocumentFromUrlsRequest>({
      query: (data) => ({
        functionName: 'createDocumentFromUrl',
        data,
      }),
      transformResponse: (response: { success: boolean; document: DocumentEnhanced }) =>
        response.document,
      invalidatesTags: ['Document', { type: 'Directory', id: 'LIST' }],
      onQueryStarted: createDocumentOnQueryStarted('Document', 'create document from URL'),
    }),

    uploadAndCreateDocument: builder.mutation<DocumentEnhanced, UploadDocumentRequest>({
      query: (data) => ({
        functionName: 'uploadAndCreateDocument',
        data,
        timeout: 180000,
      }),
      transformResponse: (response: { success: boolean; document: DocumentEnhanced }) =>
        response.document,
      invalidatesTags: ['Document', { type: 'Directory', id: 'LIST' }],
      onQueryStarted: createDocumentOnQueryStarted('Document', 'upload document'),
    }),

    createDocumentFromPastedText: builder.mutation<
      StartGenerationResponse,
      CreateDocumentFromPastedTextRequest
    >({
      query: (data) => ({
        functionName: 'createDocumentFromPastedText',
        data,
      }),
      transformResponse: (response: StartGenerationResponse & { documentId?: string }) => ({
        success: response.success,
        id: response.documentId || response.id,
        recordType: response.recordType,
        directoryId: response.directoryId,
        generationStatus: response.generationStatus,
      }),
      invalidatesTags: ['Document', { type: 'Directory', id: 'LIST' }],
      onQueryStarted: createDocumentOnQueryStarted('Document', 'create document from pasted text'),
    }),

    generateFromPrompt: builder.mutation<GenerateFromPromptResponse, GenerateFromPromptRequest>({
      query: (data) => ({
        functionName: 'generateFromPrompt',
        data,
      }),
      onQueryStarted: createDocumentOnQueryStarted('Document', 'generate document', {
        successMessage: 'Document is preparing',
      }),
      transformResponse: (response: {
        success: boolean;
        id?: string;
        documentId: string;
        recordType?: 'document';
        directoryId?: string;
        generationStatus?: 'pending';
        title?: string;
        content?: string;
        wordCount?: number;
        metadata?: {
          originalPrompt: string;
          generatedAt: string;
          filesUsed?: number;
        };
      }) => ({
        success: response.success,
        id: response.id || response.documentId,
        documentId: response.documentId,
        recordType: response.recordType || 'document',
        directoryId: response.directoryId || '',
        generationStatus: response.generationStatus || 'pending',
        title: response.title,
        content: response.content,
        wordCount: response.wordCount,
        metadata: response.metadata,
      }),
      invalidatesTags: ['Document', { type: 'Directory', id: 'LIST' }],
    }),

    updateDocument: builder.mutation<
      DocumentEnhanced,
      UpdateDocumentRequest & { documentId: string }
    >({
      async queryFn({ documentId, ...updates }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const document = await updateDocumentInFirestore(userId, documentId, updates);
          return { data: document };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Document', id: arg.documentId },
        'Document',
        { type: 'Directory', id: 'LIST' },
      ],
    }),

    deleteDocument: builder.mutation<{ success: boolean }, DeleteDocumentRequest>({
      async queryFn({ documentId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          await deleteDocumentInFirestore(userId, documentId);
          return { data: { success: true } };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Document', id: arg.documentId },
        'Document',
        { type: 'Directory', id: 'LIST' },
      ],
      async onQueryStarted({ documentId }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          documentsApi.util.updateQueryData('getUserDocuments', undefined, (draft) => {
            if (draft?.documents) {
              draft.documents = draft.documents.filter((doc) => doc.id !== documentId);
              draft.total = Math.max(0, (draft.total || 0) - 1);
            }
          }),
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),

    bulkDeleteDocuments: builder.mutation<
      IBulkOperationResponse,
      IBulkDeleteDocumentsRequest
    >({
      async queryFn({ documentIds }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await executeBulkOperation({
            items: documentIds,
            getItemId: (id) => id,
            runItem: (documentId) =>
              deleteDocumentInFirestore(userId, documentId).then(() => undefined),
          });
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: ['Document', 'Documents', { type: 'Directory', id: 'LIST' }],
    }),

    searchDocuments: builder.query<ListDocumentsResponse, string>({
      query: (searchQuery) => ({
        functionName: 'searchDocuments',
        data: { query: searchQuery },
      }),
      providesTags: ['Document'],
    }),

    getDocumentContent: builder.query<
      { content: string; contentFormat: DocumentContentFormat },
      string
    >({
      async queryFn(documentId, api) {
        try {
          const cachedDocument = documentsApi.endpoints.getDocument
            .select(documentId)(api.getState() as never)?.data;
          const fetched = await fetchDocumentContentFromStorage(documentId, {
            storagePath: cachedDocument?.storagePath || undefined,
            contentFormat: cachedDocument?.contentFormat,
          });
          return { data: fetched };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: (_result, _error, documentId) => [
        { type: 'Document', id: `${documentId}-content` },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUserDocumentsQuery,
  useLazyGetUserDocumentsQuery,
  useGetDocumentQuery,
  useLazyGetDocumentQuery,
  useGetDocumentContentQuery,
  useLazyGetDocumentContentQuery,
  useCreateDocumentMutation,
  useUploadAndCreateDocumentMutation,
  useCreateDocumentFromPastedTextMutation,
  useCreateDocumentFromUrlMutation,
  useGenerateFromPromptMutation,
  useUpdateDocumentMutation,
  useDeleteDocumentMutation,
  useBulkDeleteDocumentsMutation,
  useSearchDocumentsQuery,
  useLazySearchDocumentsQuery,
} = documentsApi;
