import { baseApi } from '../baseApi';
import { createDocumentOnQueryStarted } from '../utils/createDocumentOnQueryStarted';
import { fetchDocumentContentFromStorage } from '../../../services/documentContentStorage';
import { fetchDocumentFromFirestore } from '../../../services/documentFirestore';
import { auth } from '../../../config/firebase';
import { toFirestoreDoc } from '../../../services/firestoreReadUtils';
import { attachArtifactDocListener } from '../utils/artifactDetailRealtime';
import { 
  DocumentEnhanced, 
  CreateDocumentRequest,
  CreateDocumentFromUrlsRequest,
  UpdateDocumentRequest,
  DeleteDocumentRequest,
  GenerateFromPromptRequest,
  GenerateFromPromptResponse,
  UploadDocumentRequest,
  ReviseDocumentWithAIRequest,
  ReviseDocumentWithAIResponse,
} from "@shared-types";

interface ListDocumentsResponse {
  documents: DocumentEnhanced[];
  total: number;
  hasMore: boolean;
}

export interface IGetUserDocumentsArgs {
  limit?: number;
  directoryId?: string;
}

const DEFAULT_USER_DOCUMENTS_LIMIT = 100;

export const documentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUserDocuments: builder.query<ListDocumentsResponse, IGetUserDocumentsArgs | void>({
      query: (args) => ({
        functionName: 'getUserDocuments',
        data: {
          limit: args?.limit ?? DEFAULT_USER_DOCUMENTS_LIMIT,
          ...(args?.directoryId ? { directoryId: args.directoryId } : {}),
        },
      }),
      transformResponse: (response: { success: boolean; documents: DocumentEnhanced[]; total: number; hasMore: boolean }) => {
        return {
          documents: response.documents,
          total: response.total,
          hasMore: response.hasMore,
        };
      },
      providesTags: ['Document'],
    }),
    
    getDocument: builder.query<DocumentEnhanced, string>({
      async queryFn(documentId, _api, _extraOptions, baseQuery) {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Authentication required' },
            },
          };
        }

        if (!documentId.trim()) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Document ID is required' },
            },
          };
        }

        try {
          const document = await fetchDocumentFromFirestore(userId, documentId);
          if (!document) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                data: { message: 'Document not found', code: 'NOT_FOUND' },
              },
            };
          }

          return { data: document };
        } catch (firestoreError) {
          console.warn('Firestore document read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getDocument',
            data: { documentId },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          const response = fallback.data as { success: boolean; document: DocumentEnhanced };
          return { data: response.document };
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
      providesTags: (result, error, documentId) => [
        { type: 'Document', id: documentId }
      ],
      keepUnusedDataFor: 300,
    }),
    
    createDocument: builder.mutation<DocumentEnhanced, CreateDocumentRequest>({
      query: (data) => ({
        functionName: 'createDocument',
        data
      }),
      transformResponse: (response: { success: boolean; document: DocumentEnhanced }) => {
        return response.document;
      },
      invalidatesTags: [
        'Document',
        { type: 'Directory', id: 'LIST' },
      ],
      onQueryStarted: createDocumentOnQueryStarted('Document', 'create document'),
    }),
    
    createDocumentFromUrl: builder.mutation<DocumentEnhanced, CreateDocumentFromUrlsRequest>({
      query: (data) => ({
        functionName: 'createDocumentFromUrl',
        data
      }),
      transformResponse: (response: { success: boolean; document: DocumentEnhanced }) => {
        return response.document;
      },
      invalidatesTags: [
        'Document',
        { type: 'Directory', id: 'LIST' },
      ],
      onQueryStarted: createDocumentOnQueryStarted('Document', 'create document from URL'),
    }),

    uploadAndCreateDocument: builder.mutation<DocumentEnhanced, UploadDocumentRequest>({
      query: (data) => ({
        functionName: 'uploadAndCreateDocument',
        data,
        timeout: 180000,
      }),
      transformResponse: (response: { success: boolean; document: DocumentEnhanced }) => {
        return response.document;
      },
      invalidatesTags: [
        'Document',
        { type: 'Directory', id: 'LIST' },
      ],
      onQueryStarted: createDocumentOnQueryStarted('Document', 'upload document'),
    }),
    
    generateFromPrompt: builder.mutation<GenerateFromPromptResponse, GenerateFromPromptRequest>({
      query: (data) => ({
        functionName: 'generateFromPrompt',
        data: data
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
      }) => {
        // Firebase Functions return data wrapped in the response
        return {
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
        };
      },
      invalidatesTags: [
        'Document',
        { type: 'Directory', id: 'LIST' }, // Invalidate directory list
      ],
    }),
    
    updateDocument: builder.mutation<DocumentEnhanced, UpdateDocumentRequest & { documentId: string }>({
      query: ({ documentId, ...updates }) => ({
        functionName: 'updateDocument',
        data: { documentId, updates },
      }),
      transformResponse: (response: { success: boolean; document: DocumentEnhanced }) =>
        response.document,
      invalidatesTags: (result, error, arg) => [
        { type: 'Document', id: arg.documentId },
        { type: 'Document', id: `${arg.documentId}-content` },
      ],
    }),

    reviseDocumentWithAI: builder.mutation<
      ReviseDocumentWithAIResponse,
      ReviseDocumentWithAIRequest
    >({
      query: (data) => ({
        functionName: 'reviseDocumentWithAI',
        data,
        timeout: 300000,
      }),
      transformResponse: (response: {
        success: boolean;
        data: ReviseDocumentWithAIResponse;
      }) => response.data,
    }),
    
    deleteDocument: builder.mutation<{ success: boolean }, DeleteDocumentRequest>({
      query: (data) => ({
        functionName: 'deleteDocument',
        data
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Document', id: arg.documentId },
        'Document', // Invalidate the general tag to refetch the documents list
        { type: 'Directory', id: 'LIST' }, // Invalidate directory list
      ],
      // Optimistically update the cache to immediately remove the document
      async onQueryStarted({ documentId }, { dispatch, queryFulfilled }) {
        // Optimistically update getUserDocuments cache
        const patchResult = dispatch(
          documentsApi.util.updateQueryData('getUserDocuments', undefined, (draft) => {
            if (draft && draft.documents) {
              draft.documents = draft.documents.filter(doc => doc.id !== documentId);
              draft.total = Math.max(0, (draft.total || 0) - 1);
            }
          })
        );

        try {
          await queryFulfilled;
        } catch {
          // If the mutation fails, undo the optimistic update
          patchResult.undo();
        }
      },
    }),
    
    searchDocuments: builder.query<ListDocumentsResponse, string>({
      query: (query) => ({
        functionName: 'searchDocuments',
        data: { query }
      }),
      providesTags: ['Document'],
    }),

    getDocumentContent: builder.query<{ content: string }, string>({
      async queryFn(documentId, _api, _extraOptions, baseQuery) {
        try {
          const content = await fetchDocumentContentFromStorage(documentId);
          return { data: { content } };
        } catch (storageError) {
          console.warn(
            'Storage document content read failed, falling back to callable:',
            storageError,
          );
          const fallback = await baseQuery({
            functionName: 'getDocumentContent',
            data: { documentId },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          const response = fallback.data as { success: boolean; content: string };
          return { data: { content: response.content } };
        }
      },
      providesTags: (result, error, documentId) => [
        { type: 'Document', id: `${documentId}-content` }
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
  useCreateDocumentFromUrlMutation,
  useGenerateFromPromptMutation,
  useUpdateDocumentMutation,
  useReviseDocumentWithAIMutation,
  useDeleteDocumentMutation,
  useSearchDocumentsQuery,
  useLazySearchDocumentsQuery,
} = documentsApi;