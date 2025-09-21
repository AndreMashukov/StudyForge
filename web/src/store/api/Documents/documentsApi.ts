import { baseApi } from '../baseApi';
import { 
  DocumentEnhanced, 
  ListDocumentsResponse,
  CreateDocumentRequest,
  CreateDocumentFromUrlRequest,
  UpdateDocumentRequest,
  DeleteDocumentRequest
} from 'shared-types';

export const documentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUserDocuments: builder.query<ListDocumentsResponse, void>({
      query: () => ({
        functionName: 'getUserDocuments',
        data: {}
      }),
      providesTags: ['Document'],
    }),
    
    getDocument: builder.query<DocumentEnhanced, string>({
      query: (documentId) => ({
        functionName: 'getDocument',
        data: { documentId }
      }),
      providesTags: (result, error, documentId) => [
        { type: 'Document', id: documentId }
      ],
    }),
    
    createDocument: builder.mutation<DocumentEnhanced, CreateDocumentRequest>({
      query: (data) => ({
        functionName: 'createDocument',
        data
      }),
      invalidatesTags: ['Document'],
    }),
    
    createDocumentFromUrl: builder.mutation<DocumentEnhanced, CreateDocumentFromUrlRequest>({
      query: (data) => ({
        functionName: 'createDocumentFromUrl',
        data
      }),
      invalidatesTags: ['Document'],
    }),
    
    updateDocument: builder.mutation<DocumentEnhanced, UpdateDocumentRequest>({
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
        { type: 'Document', id: arg.documentId }
      ],
    }),
    
    searchDocuments: builder.query<ListDocumentsResponse, string>({
      query: (query) => ({
        functionName: 'searchDocuments',
        data: { query }
      }),
      providesTags: ['Document'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUserDocumentsQuery,
  useLazyGetUserDocumentsQuery,
  useGetDocumentQuery,
  useLazyGetDocumentQuery,
  useCreateDocumentMutation,
  useCreateDocumentFromUrlMutation,
  useUpdateDocumentMutation,
  useDeleteDocumentMutation,
  useSearchDocumentsQuery,
  useLazySearchDocumentsQuery,
} = documentsApi;