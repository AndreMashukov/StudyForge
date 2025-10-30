import { baseApi } from '../baseApi';
import { 
  DocumentEnhanced, 
  CreateDocumentRequest,
  CreateDocumentFromUrlRequest,
  UpdateDocumentRequest,
  DeleteDocumentRequest,
  GenerateFromPromptRequest,
  GenerateFromPromptResponse
} from "@shared-types";

interface ListDocumentsResponse {
  documents: DocumentEnhanced[];
  total: number;
  hasMore: boolean;
}

export const documentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUserDocuments: builder.query<ListDocumentsResponse, void>({
      query: () => ({
        functionName: 'getUserDocuments',
        data: {}
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
      query: (documentId) => ({
        functionName: 'getDocument',
        data: { documentId }
      }),
      transformResponse: (response: { success: boolean; document: DocumentEnhanced }) => {
        return response.document;
      },
      providesTags: (result, error, documentId) => [
        { type: 'Document', id: documentId }
      ],
    }),
    
    createDocument: builder.mutation<DocumentEnhanced, CreateDocumentRequest>({
      query: (data) => ({
        functionName: 'createDocument',
        data
      }),
      transformResponse: (response: { success: boolean; document: DocumentEnhanced }) => {
        return response.document;
      },
      invalidatesTags: ['Document'],
    }),
    
    createDocumentFromUrl: builder.mutation<DocumentEnhanced, CreateDocumentFromUrlRequest>({
      query: (data) => ({
        functionName: 'createDocumentFromUrl',
        data
      }),
      transformResponse: (response: { success: boolean; document: DocumentEnhanced }) => {
        return response.document;
      },
      invalidatesTags: ['Document'],
    }),
    
    generateFromPrompt: builder.mutation<GenerateFromPromptResponse, GenerateFromPromptRequest>({
      query: (data) => ({
        functionName: 'generateFromPrompt',
        data: data
      }),
      transformResponse: (response: any) => {
        // Firebase Functions return data wrapped in the response
        return {
          documentId: response.documentId,
          title: response.title,
          content: response.content,
          wordCount: response.wordCount,
          metadata: response.metadata,
        };
      },
      invalidatesTags: ['Document'],
    }),
    
    updateDocument: builder.mutation<DocumentEnhanced, UpdateDocumentRequest & { documentId: string }>({
      query: (data) => ({
        functionName: 'updateDocument',
        data
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Document', id: arg.documentId }
      ],
    }),
    
    deleteDocument: builder.mutation<{ success: boolean }, DeleteDocumentRequest>({
      query: (data) => ({
        functionName: 'deleteDocument',
        data
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Document', id: arg.documentId },
        'Document', // Invalidate the general tag to refetch the documents list
        { type: 'Directory', id: 'CONTENTS' }, // Invalidate directory contents
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
      query: (documentId) => ({
        functionName: 'getDocumentContent',
        data: { documentId }
      }),
      transformResponse: (response: { success: boolean; content: string }) => {
        return { content: response.content };
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
  useCreateDocumentFromUrlMutation,
  useGenerateFromPromptMutation,
  useUpdateDocumentMutation,
  useDeleteDocumentMutation,
  useSearchDocumentsQuery,
  useLazySearchDocumentsQuery,
} = documentsApi;