// Quiz Types (Document-centric architecture)
export interface Quiz {
  id: string;
  documentId: string; // Primary reference to the source document
  title: string;
  questions: QuizQuestion[];
  createdAt: Date;
  userId?: string;
  
  // New fields for document-based architecture
  generationAttempt?: number; // Track multiple generations per document
  documentTitle?: string; // Cache for performance
}

export interface QuizQuestion {
  question: string;
  options: string[]; // 4 options
  correctAnswer: number; // index of correct option
  explanation: string; // Mandatory explanation for the correct answer
}

// Document Types (New document-centric data model)
export interface Document {
  id: string;
  title: string;
  content: string; // Markdown content stored in Firebase Storage
  sourceType: 'url' | 'upload';
  sourceUrl?: string; // For URL-sourced documents
  fileName?: string; // For uploaded documents
  fileSize: number; // In bytes
  wordCount: number;
  readingTime: number; // In minutes
  createdAt: Date;
  userId?: string;
  storageUrl: string; // Firebase Storage download URL for the markdown file
}

// Document Enums
export enum DocumentSourceType {
  URL = 'url',
  UPLOAD = 'upload',
  GENERATED = 'generated'
}

export enum DocumentStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived', 
  DELETED = 'deleted'
}

// Enhanced Document interface
export interface DocumentEnhanced {
  id: string;
  userId: string;
  title: string;
  description: string;
  sourceType: DocumentSourceType;
  sourceUrl?: string;
  wordCount: number;
  status: DocumentStatus;
  storageUrl: string;
  storagePath: string;
  tags: string[];
  createdAt: Date | { toDate(): Date }; // Can be Date or Firestore Timestamp
  updatedAt: Date | { toDate(): Date }; // Can be Date or Firestore Timestamp
}

// Document metadata for UI display
export interface DocumentMetadata {
  id: string;
  title: string;
  sourceType: 'url' | 'upload';
  sourceUrl?: string;
  fileName?: string;
  fileSize: number;
  wordCount: number;
  readingTime: number;
  createdAt: Date;
  quizCount?: number; // Number of quizzes created from this document
}

// API Types (Document-centric architecture)
export interface GenerateQuizRequest {
  documentId: string;
  quizName?: string; // Optional custom name, defaults to "Quiz from [Document Title]"
  additionalPrompt?: string; // Optional additional instructions for quiz generation
}

export interface GenerateQuizResponse {
  quizId: string;
  quiz: Quiz;
}

export interface GetQuizResponse {
  quiz: Quiz;
}

export interface GetUserQuizzesResponse {
  quizzes: Quiz[];
}

export interface GetDocumentQuizzesRequest {
  documentId: string;
}

export interface GetDocumentQuizzesResponse {
  quizzes: Quiz[];
}

// Enhanced Document API Types
export interface CreateDocumentRequest {
  title: string;
  description?: string;
  content: string;
  sourceType: DocumentSourceType;
  sourceUrl?: string;
  status?: DocumentStatus;
  tags?: string[];
}

export interface UpdateDocumentRequest {
  title?: string;
  description?: string;
  content?: string;
  status?: DocumentStatus;
  tags?: string[];
}

// Storage Types
export interface StorageFile {
  path: string;
  downloadUrl: string;
  metadata: StorageMetadata;
}

export interface StorageMetadata {
  contentType: string;
  size: number;
  timeCreated: string;
  updated: string;
  customMetadata: Record<string, string>;
}

// Enhanced Document Metadata
export interface DocumentMetadataEnhanced {
  title: string;
  sourceType: DocumentSourceType;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Document API Types (New endpoints)
export interface CreateDocumentFromUrlRequest {
  url: string;
  title?: string; // Optional override for document title
}

export interface UploadDocumentRequest {
  fileName: string;
  content: string; // Base64 encoded markdown content
  title?: string; // Optional override for document title
}

export interface CreateDocumentResponse {
  documentId: string;
  document: Document;
}

export interface GetDocumentResponse {
  document: Document;
}

export interface GetUserDocumentsResponse {
  documents: DocumentMetadata[];
}

export interface DeleteDocumentRequest {
  documentId: string;
}

export interface DeleteDocumentResponse {
  success: boolean;
  deletedQuizCount?: number; // Number of associated quizzes deleted
}

// API Error Types
export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Gemini Integration Types
export interface GeminiQuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface GeminiQuizResponse {
  title: string;
  questions: GeminiQuizQuestion[];
}

// Web Scraping Types (Updated for markdown conversion)
export interface ScrapedContent {
  title: string;
  content: string; // Now represents clean, structured content
  markdownContent?: string; // Converted markdown content
  author?: string;
  publishDate?: string;
  wordCount: number;
}

// Firebase Storage Types
export interface StorageFile {
  path: string;
  downloadUrl: string;
  metadata: StorageMetadata;
}

// Content Processing Types
export interface ContentProcessor {
  processUrl(url: string): Promise<ProcessedContent>;
  processMarkdownFile(content: string, fileName: string): Promise<ProcessedContent>;
  validateContent(content: string): ContentValidationResult;
}

export interface ProcessedContent {
  title: string;
  content: string; // Clean markdown content
  wordCount: number;
  readingTime: number; // Calculated in minutes
  metadata: {
    sourceType: 'url' | 'upload';
    sourceUrl?: string;
    fileName?: string;
    originalSize: number;
    processedSize: number;
  };
}

export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  wordCount: number;
  estimatedReadingTime: number;
}

// File Upload Types
export interface FileUploadValidation {
  maxSize: number; // 100KB = 100 * 1024 bytes
  allowedTypes: string[]; // ['text/markdown', 'text/plain']
  allowedExtensions: string[]; // ['.md', '.markdown']
}

export interface UploadValidationResult {
  isValid: boolean;
  errors: string[];
  fileInfo: {
    name: string;
    size: number;
    type: string;
    extension: string;
  };
}

// Quiz Followup API Types
export interface GenerateFollowupRequest {
  documentId: string;
  questionText: string;
  userSelectedAnswer: string;
  correctAnswer?: string;
  questionOptions?: string[];
  quizTitle?: string;
}

export interface GenerateFollowupResponse {
  documentId: string;
  title: string;
  content: string;
}

export interface QuizFollowupContext {
  originalDocument: {
    title: string;
    content: string;
  };
  question: {
    text: string;
    options: string[];
    userAnswer: string;
    correctAnswer?: string;
  };
  quiz: {
    title: string;
  };
}

// Auth Types
export interface User {
  uid: string;
  email: string;
  displayName?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}