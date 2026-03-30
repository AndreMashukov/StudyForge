import { Timestamp } from 'firebase/firestore';

// Flashcard Types
export interface Flashcard {
  id: string;    // Unique ID for each card
  front: string; // The term or question
  back: string;  // The definition or answer
  explanation?: string; // Optional longer explanation
}

export interface FlashcardSet {
  id: string;
  userId: string;
  documentId: string;
  documentIds?: string[];
  documentTitle: string;
  title: string;
  flashcards: Flashcard[];
  directoryId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Flashcard API Types
export interface GenerateFlashcardsRequest {
  documentIds: string[];
  directoryId?: string;
  title?: string;
  additionalPrompt?: string;
  /** @deprecated Auto-resolved from directory hierarchy when omitted */
  ruleIds?: string[];
  additionalRuleIds?: string[];
}

export interface GenerateFlashcardsResponse {
  flashcardSetId: string;
  flashcardSet?: FlashcardSet;
}

export interface UpdateFlashcardSetRequest {
  flashcardSetId: string;
  title?: string;
  flashcards?: Flashcard[];
}

// Slide Deck Types
export interface Slide {
  id: string;
  title: string;
  content: string;
  imageStoragePath?: string;
  imageDownloadToken?: string;
  imageUrl?: string;
  speakerNotes?: string;
}

export interface SlideDeck {
  id: string;
  userId: string;
  documentId: string;
  documentIds?: string[];
  documentTitle: string;
  title: string;
  slides: Slide[];
  directoryId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GenerateSlideDeckRequest {
  documentIds: string[];
  directoryId?: string;
  title?: string;
  additionalPrompt?: string;
  /** @deprecated Auto-resolved from directory hierarchy when omitted */
  ruleIds?: string[];
  additionalRuleIds?: string[];
}

export interface GenerateSlideDeckResponse {
  slideDeckId: string;
  slideDeck?: SlideDeck;
}

export interface UpdateSlideDeckRequest {
  slideDeckId: string;
  title?: string;
  slides?: Slide[];
}

// Quiz Types (Document-centric architecture)
export interface Quiz {
  id: string;
  documentId: string; // Primary reference to the source document
  documentIds?: string[]; // All source documents (multi-doc quizzes)
  title: string;
  questions: QuizQuestion[];
  createdAt: Date;
  userId?: string;
  directoryId: string;

  // New fields for document-based architecture
  generationAttempt?: number; // Track multiple generations per document
  documentTitle?: string; // Cache for performance

  // Rule tracking for followup generation
  followupRuleIds?: string[]; // Rules to use when generating followup explanations
}

export interface QuizQuestion {
  question: string;
  options: string[]; // 4 options
  correctAnswer: number; // index of correct option
  explanation: string; // Mandatory explanation for the correct answer
}

// Diagram Quiz — multiple choice where each option is a Mermaid diagram
export interface DiagramQuizQuestion {
  question: string;
  diagrams: string[]; // exactly 4 Mermaid diagram sources
  diagramLabels?: string[];
  correctAnswer: number; // 0–3
  explanation: string;
}

export interface DiagramQuiz {
  id: string;
  userId: string;
  documentId: string;
  documentIds?: string[];
  documentTitle: string;
  title: string;
  questions: DiagramQuizQuestion[];
  directoryId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  generationAttempt?: number;
  followupRuleIds?: string[];
}

export interface GenerateDiagramQuizRequest {
  documentIds: string[];
  directoryId?: string;
  diagramQuizName?: string;
  additionalPrompt?: string;
  quizRuleIds?: string[];
  followupRuleIds?: string[];
  additionalRuleIds?: string[];
}

export interface GenerateDiagramQuizResponse {
  diagramQuizId: string;
  diagramQuiz?: DiagramQuiz;
}

export interface GetDiagramQuizResponse {
  diagramQuiz: DiagramQuiz;
}

export interface GetUserDiagramQuizzesResponse {
  diagramQuizzes: DiagramQuiz[];
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
  directoryId: string;
  createdAt: Date | { toDate(): Date }; // Can be Date or Firestore Timestamp
  updatedAt: Date | { toDate(): Date }; // Can be Date or Firestore Timestamp
}

// Directory Types
export interface Directory {
  id: string;
  userId: string;
  name: string;
  parentId: string | null; // null for root directories
  path: string; // Computed path for breadcrumb navigation (e.g., "/Projects/Web")
  level: number; // Tree depth level (0 for root)
  color?: string; // Optional color for visual organization
  icon?: string; // Optional icon name
  description?: string;
  documentCount: number; // Cached count of documents in this directory
  childCount: number; // Cached count of child directories
  quizCount: number;
  flashcardSetCount: number;
  slideDeckCount: number;
  /** Present for directories created after diagram quizzes; treat missing as 0 */
  diagramQuizCount?: number;
  ruleIds: string[];
  createdAt: Date | { toDate(): Date };
  updatedAt: Date | { toDate(): Date };
}

// Directory Tree Node for UI rendering
export interface DirectoryTreeNode {
  directory: Directory;
  children: DirectoryTreeNode[];
  isExpanded?: boolean;
  isSelected?: boolean;
}

// Directory API Request Types
export interface CreateDirectoryRequest {
  name: string;
  parentId?: string | null;
  color?: string;
  icon?: string;
  description?: string;
}

export interface UpdateDirectoryRequest {
  name?: string;
  color?: string;
  icon?: string;
  description?: string;
}

export interface MoveDirectoryRequest {
  targetParentId: string | null;
}

export interface MoveDocumentRequest {
  targetDirectoryId: string;
}

// Directory API Response Types
export interface CreateDirectoryResponse {
  directoryId: string;
  directory: Directory;
}

export interface GetDirectoryResponse {
  directory: Directory;
}

export interface GetDirectoryTreeResponse {
  tree: DirectoryTreeNode[];
  totalDirectories: number;
}

export interface GetDirectoryContentsResponse {
  directory: Directory;
  subdirectories: Directory[];
  documents: DocumentEnhanced[];
  totalCount: number;
}

export interface GetDirectoryContentsWithArtifactsResponse extends GetDirectoryContentsResponse {
  quizzes: Quiz[];
  flashcardSets: FlashcardSet[];
  slideDecks: SlideDeck[];
  diagramQuizzes: DiagramQuiz[];
  resolvedRules: {
    rules: Rule[];
    inheritanceMap: { [directoryId: string]: Rule[] };
  };
}

export interface GetDirectoryAncestorsResponse {
  ancestors: Directory[];
}

export interface MoveDirectoryResponse {
  directory: Directory;
  affectedDescendants: number;
}

export interface DeleteDirectoryResponse {
  success: boolean;
  deletedDocumentCount: number;
  deletedDirectoryCount: number;
  deletedQuizCount: number;
  deletedFlashcardSetCount: number;
  deletedSlideDeckCount: number;
  deletedDiagramQuizCount?: number;
}

// Directory Validation Types
export interface DirectoryValidationResult {
  isValid: boolean;
  errors: string[];
}

// Directory Constants
export const DIRECTORY_CONSTRAINTS = {
  MAX_NAME_LENGTH: 100,
  MAX_DEPTH: 10,
  MAX_CHILDREN: 500,
  RESERVED_NAMES: ['root', 'system', 'admin'],
} as const;

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
  documentIds: string[]; // One or more source documents to generate a quiz from
  directoryId?: string;
  quizName?: string; // Optional custom name, defaults to "Quiz from [Document Title]"
  additionalPrompt?: string; // Optional additional instructions for quiz generation
  /** @deprecated Auto-resolved from directory when omitted */
  quizRuleIds?: string[];
  /** @deprecated Auto-resolved from directory when omitted */
  followupRuleIds?: string[];
  additionalRuleIds?: string[];
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
  directoryId: string;
  ruleIds?: string[]; // Optional rule IDs for document generation
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
  directoryId: string;
  ruleIds?: string[]; // Optional rules for content processing (Section 6)
}

export interface UploadDocumentRequest {
  fileName: string;
  content: string; // Base64 encoded markdown content
  title?: string; // Optional override for document title
  directoryId: string;
  ruleIds?: string[]; // Optional rules for content processing (Section 6)
}

// File Content Type for Text Prompt Context
export interface IFileContent {
  filename: string;
  content: string;
  size: number;
  type: 'text/plain' | 'text/markdown';
  source?: 'upload' | 'library'; // Optional: track source for logging
  documentId?: string; // Optional: document ID for library documents (ownership validation)
}

export interface GenerateFromPromptRequest {
  prompt: string; // User's text prompt (max 10000 characters)
  files?: IFileContent[]; // Optional reference documents (max 5 files)
  directoryId: string; // Directory to place the generated document
  ruleIds?: string[]; // Optional rules for content generation
}

export interface GenerateFromPromptResponse {
  documentId: string;
  title: string;
  content: string;
  wordCount: number;
  metadata: {
    originalPrompt: string;
    generatedAt: string;
    filesUsed?: number; // Number of context files used
  };
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
  followupRuleIds?: string[]; // Optional rule IDs for followup generation
}

export interface GenerateFollowupResponse {
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
  customInstructions?: string; // Optional custom rules/instructions to inject
}

// Document Question API Types
export interface AskDocumentQuestionRequest {
  documentId: string;
  question: string;
  ruleIds?: string[];
}

export interface AskDocumentQuestionResponse {
  content: string;
}

export interface DocumentQuestionContext {
  document: {
    title: string;
    content: string;
  };
  question: string;
  customInstructions?: string;
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

// Rules Feature Types
export enum RuleApplicability {
  SCRAPING = 'scraping',
  UPLOAD = 'upload',
  PROMPT = 'prompt',
  QUIZ = 'quiz',
  FOLLOWUP = 'followup',
  FLASHCARD = 'flashcard',
  SLIDE_DECK = 'slide_deck',
  DIAGRAM_QUIZ = 'diagram_quiz',
}

export enum RuleColor {
  RED = 'red',
  ORANGE = 'orange',
  YELLOW = 'yellow',
  GREEN = 'green',
  BLUE = 'blue',
  INDIGO = 'indigo',
  PURPLE = 'purple',
  PINK = 'pink',
  GRAY = 'gray',
}

export interface Rule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  content: string; // Markdown content, max 100,000 chars
  color: RuleColor;
  tags: string[];
  applicableTo: RuleApplicability[];
  isDefault: boolean; // Auto-selected for operations
  directoryIds: string[]; // Directories this rule is attached to
  createdAt: Date | { toDate(): Date };
  updatedAt: Date | { toDate(): Date };
}

// Rule API Types
export interface CreateRuleRequest {
  name: string;
  description?: string;
  content: string;
  color: RuleColor;
  tags: string[];
  applicableTo: RuleApplicability[];
  isDefault?: boolean;
}

export interface UpdateRuleRequest {
  ruleId: string;
  name?: string;
  description?: string;
  content?: string;
  color?: RuleColor;
  tags?: string[];
  applicableTo?: RuleApplicability[];
  isDefault?: boolean;
}

export interface DeleteRuleRequest {
  ruleId: string;
}

export interface DeleteRuleResponse {
  success: boolean;
  error?: string; // Error message if rule is attached to directories
}

export interface AttachRuleToDirectoryRequest {
  ruleId: string;
  directoryId: string;
}

export interface DetachRuleFromDirectoryRequest {
  ruleId: string;
  directoryId: string;
}

export interface GetDirectoryRulesRequest {
  directoryId: string;
  includeAncestors?: boolean; // For cascading
}

export interface GetDirectoryRulesResponse {
  rules: Rule[];
  inheritanceMap: {
    [directoryId: string]: Rule[];
  };
}

export interface GetApplicableRulesRequest {
  directoryId: string;
  operation: RuleApplicability;
}

export interface GetApplicableRulesResponse {
  rules: Rule[];
}

export interface FormatRulesForPromptRequest {
  ruleIds: string[];
}

export interface FormatRulesForPromptResponse {
  formattedRules: string;
}

export interface GetRulesResponse {
  rules: Rule[];
}

export interface GetRuleResponse {
  rule: Rule;
}

export interface CreateRuleResponse {
  ruleId: string;
  rule: Rule;
}

export interface UpdateRuleResponse {
  rule: Rule;
}

export interface AttachRuleResponse {
  success: boolean;
}

export interface DetachRuleResponse {
  success: boolean;
}