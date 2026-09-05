import { Timestamp } from 'firebase/firestore';

// ─── Document color provenance ───────────────────────────────────────────────
/** Vivid palette used for document accent colors; neutral grays are excluded so
 *  the absence of a stored color can use a distinct visual fallback. */
export const DOCUMENT_COLOR_PALETTE = [
  '#3b82f6', // Blue
  '#2563eb', // Indigo
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
  '#8b5cf6', // Purple
  '#a855f7', // Violet
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
] as const;

/** Returns a deterministic palette color for a document that has no stored
 *  color, derived from the document ID. Safe to call on the client side. */
export function getDocumentFallbackColor(documentId: string): string {
  let hash = 0;
  for (let i = 0; i < documentId.length; i++) {
    hash = (hash * 31 + documentId.charCodeAt(i)) >>> 0;
  }
  return DOCUMENT_COLOR_PALETTE[hash % DOCUMENT_COLOR_PALETTE.length];
}

export type RuleResolutionMode =
  | 'inherit'
  | 'inherit-plus-explicit'
  | 'explicit-only';

export {
  canonicalizeBcp47LanguageCode,
  isBcp47LanguageCode,
} from './language-code';

export * from './document-contract';
export * from './agent';

export type DocumentContentFormat = 'html' | 'markdown';

export function resolveDocumentContentFormat(
  contentFormat: DocumentContentFormat | undefined,
): DocumentContentFormat {
  return contentFormat ?? 'markdown';
}

// Flashcard Types
export interface Flashcard {
  id: string; // Unique ID for each card
  front: string; // Presentation text (may include emoji / romanization)
  back: string; // The definition or answer (plain text fallback)
  /**
   * Target-language word or phrase for language-learning sets.
   * Presentation-free (no emoji / romanization). Used for learned vocabulary.
   */
  term?: string;
  explanation?: string; // Optional longer explanation
  description?: string; // Optional plain-text or markdown usage example (legacy fallback)
  frontHtml?: string; // Optional HTML fragment for front display
  backHtml?: string; // Optional HTML fragment for back display
  descriptionHtml?: string; // Optional HTML fragment for below-card description display
}

/** AI classification of whether a flashcard set is for vocabulary study. */
export interface FlashcardLanguageClassification {
  isLanguageLearning: boolean;
  /** Model confidence in [0, 1]. Learned-vocabulary behavior requires a high value. */
  confidence: number;
  /** BCP-47 language code when language-learning (e.g. `es`). */
  targetLanguageCode?: string;
  /** Display name for the target language (e.g. `Spanish`). */
  targetLanguageName?: string;
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
  appliedRuleIds?: string[];
  appliedDescriptionRuleIds?: string[];
  generationStatus?: GenerationStatus;
  generationError?: string;
  completedAt?: Timestamp;
  /** Color of the primary source document, for left-rail rendering. */
  documentColor?: string;
  /** Colors of all source documents in documentIds order, for segmented rail. */
  documentColors?: string[];
  /** True when AI classified this set as vocabulary study with sufficient confidence. */
  isLanguageLearning?: boolean;
  /** Classification confidence in [0, 1]. */
  languageLearningConfidence?: number;
  /** BCP-47 code for the target language when language-learning. */
  targetLanguageCode?: string;
  /** Display name for the target language when language-learning. */
  targetLanguageName?: string;
  generationDiagnostics?: IArtifactAgentDiagnostics;
  generationModel?: string;
  generationModelUsage?: IGenerationModelUsage[];
  agentModel?: string;
}

/** User-level normalized vocabulary term learned from language-learning flashcard sets. */
export interface LearnedVocabularyItem {
  id: string;
  userId: string;
  /** BCP-47 language code. */
  languageCode: string;
  languageName: string;
  /** Normalized term used for matching/deprioritization. */
  normalizedTerm: string;
  /** Display form of the term (typically the card front). */
  term: string;
  sourceFlashcardSetId?: string;
  sourceFlashcardId?: string;
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
  descriptionRuleIds?: string[];
  additionalRuleIds?: string[];
  ruleResolutionMode?: RuleResolutionMode;
}

export interface GenerateFlashcardsResponse extends StartGenerationResponse {
  flashcardSetId: string;
  flashcardSet?: FlashcardSet;
}

export interface UpdateFlashcardSetRequest {
  flashcardSetId: string;
  title?: string;
  flashcards?: Flashcard[];
}

export interface RecordLearnedVocabularyRequest {
  flashcardSetId: string;
  flashcardId: string;
  /** Optional override; defaults to the card `term` field. */
  term?: string;
}

export interface RecordLearnedVocabularyResponse {
  learnedVocabularyId: string;
  created: boolean;
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
  appliedRuleIds?: string[];
  generationStatus?: GenerationStatus;
  generationError?: string;
  completedAt?: Timestamp;
  /** Color of the primary source document, for left-rail rendering. */
  documentColor?: string;
  /** Colors of all source documents in documentIds order, for segmented rail. */
  documentColors?: string[];
}

export interface GenerateSlideDeckRequest {
  documentIds: string[];
  directoryId?: string;
  title?: string;
  additionalPrompt?: string;
  /** @deprecated Auto-resolved from directory hierarchy when omitted */
  ruleIds?: string[];
  additionalRuleIds?: string[];
  ruleResolutionMode?: RuleResolutionMode;
}

export interface GenerateSlideDeckResponse extends StartGenerationResponse {
  slideDeckId: string;
  slideDeck?: SlideDeck;
}

export interface UpdateSlideDeckRequest {
  slideDeckId: string;
  title?: string;
  slides?: Slide[];
}

export interface QuestionKnowledgeMetadata {
  subjectId?: string;
  subjectName?: string;
  knowledgeDomainId?: string;
  knowledgeDomainName?: string;
  topicTags?: string[];
  sourceDocumentIds?: string[];
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
  appliedRuleIds?: string[]; // Rules applied during initial generation
  generationStatus?: GenerationStatus;
  generationError?: string;
  completedAt?: Date;
  /** Color of the primary source document, for left-rail rendering. */
  documentColor?: string;
  /** Colors of all source documents in documentIds order, for segmented rail. */
  documentColors?: string[];
}

export interface QuizQuestion {
  question: string;
  options: string[]; // 4 options
  correctAnswer: number; // index of correct option
  explanation: string; // Mandatory explanation for the correct answer
  hint?: string; // Optional hint shown via tooltip on lightbulb icon
  knowledge?: QuestionKnowledgeMetadata;
}

// Sequence Quiz — ordering quiz where items must be arranged in the correct sequence
export interface SequenceQuizQuestion {
  question: string;
  items: string[]; // Items in CORRECT order (shuffled at display time on the client)
  explanation: string;
  hint?: string; // Optional hint shown via tooltip on lightbulb icon
  knowledge?: QuestionKnowledgeMetadata;
}

export interface SequenceQuiz {
  id: string;
  userId: string;
  documentId: string;
  documentIds?: string[];
  documentTitle: string;
  title: string;
  questions: SequenceQuizQuestion[];
  directoryId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  generationAttempt?: number;
  followupRuleIds?: string[];
  appliedRuleIds?: string[];
  generationStatus?: GenerationStatus;
  generationError?: string;
  completedAt?: Timestamp;
  /** Color of the primary source document, for left-rail rendering. */
  documentColor?: string;
  /** Colors of all source documents in documentIds order, for segmented rail. */
  documentColors?: string[];
}

export interface GenerateSequenceQuizRequest {
  documentIds: string[];
  directoryId?: string;
  sequenceQuizName?: string;
  additionalPrompt?: string;
  ruleIds?: string[];
  followupRuleIds?: string[];
  additionalRuleIds?: string[];
  ruleResolutionMode?: RuleResolutionMode;
}

export interface GenerateSequenceQuizResponse extends StartGenerationResponse {
  sequenceQuizId: string;
  sequenceQuiz?: SequenceQuiz;
}

export interface GetSequenceQuizResponse {
  sequenceQuiz: SequenceQuiz;
}

export interface GetUserSequenceQuizzesResponse {
  sequenceQuizzes: SequenceQuiz[];
}

// Match Quiz — match-the-pairs quiz where option chips are assigned to prompt rows
export interface MatchQuizPrompt {
  id: string;
  text: string;
}

export interface MatchQuizOption {
  id: string;
  text: string;
  /** ID of the prompt this option matches; null means distractor (matches nothing). */
  correctPromptId: string | null;
}

export interface MatchQuizQuestion {
  /** Stem shown above the match table, e.g. "Match each description to the correct agent." */
  question?: string;
  prompts: MatchQuizPrompt[]; // Fixed left-side rows in display order
  options: MatchQuizOption[]; // Chip bank (shuffled at display time on the client)
  explanation: string;
  hint?: string; // Optional hint shown via tooltip on lightbulb icon
  knowledge?: QuestionKnowledgeMetadata;
}

export interface MatchQuiz {
  id: string;
  userId: string;
  documentId: string;
  documentIds?: string[];
  documentTitle: string;
  title: string;
  questions: MatchQuizQuestion[];
  directoryId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  generationAttempt?: number;
  followupRuleIds?: string[];
  appliedRuleIds?: string[];
  generationStatus?: GenerationStatus;
  generationError?: string;
  completedAt?: Timestamp;
  /** Color of the primary source document, for left-rail rendering. */
  documentColor?: string;
  /** Colors of all source documents in documentIds order, for segmented rail. */
  documentColors?: string[];
  /** Model used for the primary generator pass */
  generationModel?: string;
  /** Structured audit trail for routed generation calls. */
  generationModelUsage?: IGenerationModelUsage[];
}

export interface GenerateMatchQuizRequest {
  documentIds: string[];
  directoryId?: string;
  matchQuizName?: string;
  additionalPrompt?: string;
  ruleIds?: string[];
  followupRuleIds?: string[];
  additionalRuleIds?: string[];
  ruleResolutionMode?: RuleResolutionMode;
}

export interface GenerateMatchQuizResponse extends StartGenerationResponse {
  matchQuizId: string;
  matchQuiz?: MatchQuiz;
}

export interface GetMatchQuizResponse {
  matchQuiz: MatchQuiz;
}

export interface GetUserMatchQuizzesResponse {
  matchQuizzes: MatchQuiz[];
}

// Diagram Quiz — multiple choice where each option is a Mermaid diagram
export interface DiagramQuizQuestion {
  question: string;
  diagrams: string[]; // exactly 4 Mermaid diagram sources
  diagramLabels?: string[];
  correctAnswer: number; // 0–3
  explanation: string;
  hint?: string; // Optional hint shown via tooltip on lightbulb icon
  knowledge?: QuestionKnowledgeMetadata;
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
  appliedRuleIds?: string[];
  generationStatus?: GenerationStatus;
  generationError?: string;
  completedAt?: Timestamp;
  /** Color of the primary source document, for left-rail rendering. */
  documentColor?: string;
  /** Colors of all source documents in documentIds order, for segmented rail. */
  documentColors?: string[];
  /** Agent pipeline summary for GenerationInfoTooltip / admin debug */
  generationDiagnostics?: IArtifactAgentDiagnostics;
  /** Model used for the primary generator pass */
  generationModel?: string;
  /** Structured audit trail for routed generation calls. */
  generationModelUsage?: IGenerationModelUsage[];
  /** Model used for agent helper passes (repair/critic/refiner) */
  agentModel?: string;
}

export interface GenerateDiagramQuizRequest {
  documentIds: string[];
  directoryId?: string;
  diagramQuizName?: string;
  additionalPrompt?: string;
  ruleIds?: string[];
  quizRuleIds?: string[];
  followupRuleIds?: string[];
  additionalRuleIds?: string[];
  ruleResolutionMode?: RuleResolutionMode;
}

export interface GenerateDiagramQuizResponse extends StartGenerationResponse {
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
  /** Persistent accent color assigned at document creation. */
  color?: string;
}

// Document Enums
export enum DocumentSourceType {
  URL = 'url',
  UPLOAD = 'upload',
  GENERATED = 'generated',
}

export enum DocumentStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

// Generation lifecycle status (orthogonal to DocumentStatus)
export type GenerationStatus = 'pending' | 'completed' | 'failed';

/** Artifact kinds processed by the shared artifact-agent pipeline. */
export type ArtifactKind =
  | 'diagramQuiz'
  | 'slideDeck'
  | 'sequenceQuiz'
  | 'matchQuiz'
  | 'flashcards'
  | 'documentFromPrompt'
  | 'documentFromScreenshot';

export interface IArtifactCriticResult {
  overallVerdict: 'pass' | 'revise' | 'fail';
  items: Array<{
    itemIndex: number;
    severity: 'ok' | 'warning' | 'blocker';
    issues: string[];
  }>;
}

export type ArtifactAgentOrchestrationMode =
  | 'adk-runner'
  | 'imperative'
  | 'langgraph-runner';

export interface IArtifactAgentDiagnostics {
  artifactKind: ArtifactKind;
  agentDefinitionVersion: string;
  adkSessionId?: string;
  orchestrationMode?: ArtifactAgentOrchestrationMode;
  generatorAttempts: number;
  repairCount: number;
  criticCycles: number;
  modelUsage: Array<{
    role: 'generator' | 'repair' | 'critic' | 'refiner';
    capability: LlmCapabilityKey;
    model?: string;
    durationMs?: number;
  }>;
  residuals: Array<{
    gateId: string;
    severity: 'warning' | 'blocker';
    message: string;
    path?: string;
  }>;
  criticIssues?: IArtifactCriticResult;
  artifactDetails?: Record<string, unknown>;
}

export type GenerationRecordType =
  | 'document'
  | 'quiz'
  | 'flashcardSet'
  | 'slideDeck'
  | 'diagramQuiz'
  | 'sequenceQuiz'
  | 'matchQuiz';

export interface StartGenerationResponse {
  success: boolean;
  id: string;
  recordType: GenerationRecordType;
  directoryId: string;
  generationStatus: 'pending';
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
  // Generation lifecycle (missing means completed for backward compat)
  generationStatus?: GenerationStatus;
  generationError?: string;
  completedAt?: Date | { toDate(): Date };
  /** Rules applied during document generation. */
  appliedRuleIds?: string[];
  /** Primary LLM model used during generation. */
  generationModel?: string;
  /** Structured audit trail for routed generation calls. */
  generationModelUsage?: IGenerationModelUsage[];
  /** Agentic pipeline diagnostics for screenshot document generation. */
  generationDiagnostics?: IArtifactAgentDiagnostics;
  /** Persistent accent color assigned at document creation. */
  color?: string;
  /** Body storage format. Missing means legacy markdown (`content.md`). */
  contentFormat?: DocumentContentFormat;
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
  /** Present for directories created after sequence quizzes; treat missing as 0 */
  sequenceQuizCount?: number;
  /** Present for directories created after match quizzes; treat missing as 0 */
  matchQuizCount?: number;
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

export interface CursorPaginationRequest {
  limit?: number;
  cursor?: string;
}

export interface CursorPaginatedResult {
  hasMore: boolean;
  nextCursor?: string;
}

export interface ListDocumentsResult extends CursorPaginatedResult {
  documents: DocumentEnhanced[];
  total: number;
}

export interface ArtifactCursorPaginationResult {
  artifactHasMore: boolean;
  artifactNextCursor?: string;
}

export interface GetDirectoryContentsWithArtifactsResponse
  extends GetDirectoryContentsResponse {
  quizzes: Quiz[];
  flashcardSets: FlashcardSet[];
  slideDecks: SlideDeck[];
  diagramQuizzes: DiagramQuiz[];
  sequenceQuizzes: SequenceQuiz[];
  matchQuizzes: MatchQuiz[];
  resolvedRules: {
    rules: Rule[];
    inheritanceMap: { [directoryId: string]: Rule[] };
  };
}

export type ArtifactSummaryType =
  | 'quiz'
  | 'flashcard'
  | 'slideDeck'
  | 'diagramQuiz'
  | 'sequenceQuiz'
  | 'matchQuiz';

/** Materialized directory listing row stored under directories/{id}/items/{itemId}. */
export type DirectoryItemType =
  | 'subdirectory'
  | 'document'
  | 'quiz'
  | 'flashcard'
  | 'slideDeck'
  | 'diagramQuiz'
  | 'sequenceQuiz'
  | 'matchQuiz';

export function buildDirectoryItemId(
  itemType: DirectoryItemType,
  sourceId: string,
): string {
  return `${itemType}_${sourceId}`;
}

export function directoryItemTypeToArtifactSummaryType(
  itemType: DirectoryItemType,
): ArtifactSummaryType | null {
  switch (itemType) {
    case 'quiz':
    case 'flashcard':
    case 'slideDeck':
    case 'diagramQuiz':
    case 'sequenceQuiz':
    case 'matchQuiz':
      return itemType;
    default:
      return null;
  }
}

export interface DirectoryItemSummary {
  id: string;
  sourceId: string;
  directoryId: string;
  itemType: DirectoryItemType;
  title: string;
  createdAt: Date | Timestamp | string;
  updatedAt?: Date | Timestamp | string;
  generationStatus?: GenerationStatus;
  generationError?: string;
  completedAt?: Date | Timestamp | string;
  appliedRuleIds?: string[];
  generationModel?: string;
  documentColor?: string;
  documentColors?: string[];
  /** Subdirectory accent; document color for sources. */
  color?: string;
  icon?: string;
  wordCount?: number;
  /** Lowercase name for client-side subdirectory sorting. */
  sortName?: string;
  /** Manual display order within a directory for this itemType (lower = higher in list). */
  sortOrder?: number;
}

/** Directory item types that support manual list reorder (excludes subdirectories). */
export type ReorderableDirectoryItemType = Exclude<
  DirectoryItemType,
  'subdirectory'
>;

export interface ReorderDirectoryItemsRequest {
  directoryId: string;
  itemType: ReorderableDirectoryItemType;
  orderedSourceIds: string[];
}

export interface ReorderDirectoryItemsResponse {
  success: boolean;
}

export interface ArtifactSummary {
  id: string;
  title: string;
  createdAt: Date | Timestamp | string;
  type: ArtifactSummaryType;
  appliedRuleIds?: string[];
  // Generation lifecycle (missing means completed for backward compat)
  generationStatus?: GenerationStatus;
  generationError?: string;
  completedAt?: Date | Timestamp | string;
  /** Primary LLM model used during generation. */
  generationModel?: string;
  /** Structured audit trail for routed generation calls. */
  generationModelUsage?: IGenerationModelUsage[];
  /** Color of the primary source document, for left-rail rendering. */
  documentColor?: string;
  /** Colors of all source documents in documentIds order, for segmented rail. */
  documentColors?: string[];
}

export interface GetDirectoryContentsWithArtifactSummariesResponse
  extends GetDirectoryContentsResponse {
  artifactSummaries: ArtifactSummary[];
  artifactHasMore?: boolean;
  artifactNextCursor?: string;
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
  deletedSequenceQuizCount?: number;
  deletedMatchQuizCount?: number;
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
  ruleIds?: string[];
  /** @deprecated Auto-resolved from directory when omitted */
  quizRuleIds?: string[];
  /** @deprecated Auto-resolved from directory when omitted */
  followupRuleIds?: string[];
  additionalRuleIds?: string[];
  ruleResolutionMode?: RuleResolutionMode;
}

export interface GenerateQuizResponse extends StartGenerationResponse {
  quizId: string;
  quiz?: Quiz;
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
  ruleResolutionMode?: RuleResolutionMode;
  contentFormat?: DocumentContentFormat;
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
  ruleResolutionMode?: RuleResolutionMode;
}

export interface CreateDocumentFromUrlsRequest {
  urls: string[];
  title?: string;
  directoryId: string;
  ruleIds?: string[];
  ruleResolutionMode?: RuleResolutionMode;
}

export interface CreateDocumentFromPastedTextRequest {
  content: string;
  directoryId: string;
}

export type SupportedFileExtension =
  | 'pdf'
  | 'docx'
  | 'txt'
  | 'md'
  | 'csv'
  | 'pptx'
  | 'epub';

export interface FileExtractionResult {
  filename: string;
  originalType: string;
  markdownContent: string;
  wordCount: number;
  title: string | null;
  extension: SupportedFileExtension;
  originalSize: number;
  warnings?: string[];
  metadata?: {
    pageCount?: number;
    slideCount?: number;
    sheetCount?: number;
    chapterCount?: number;
  };
}

export interface UploadDocumentRequest {
  fileName: string;
  content: string; // Base64 encoded original file bytes
  mimeType?: string; // Browser-provided MIME type; advisory only
  size?: number; // Browser-reported original file size in bytes
  title?: string; // Optional override for document title
  directoryId: string;
  ruleIds?: string[]; // Optional rules for content processing (Section 6)
  ruleResolutionMode?: RuleResolutionMode;
}

// File Content Type for Text Prompt Context
export interface IFileContent {
  filename: string;
  content: string;
  size: number;
  type: string;
  source?: 'upload' | 'library'; // Optional: track source for logging
  documentId?: string; // Optional: document ID for library documents (ownership validation)
}

export interface GenerateFromPromptRequest {
  prompt: string; // User's text prompt (max 10000 characters)
  files?: IFileContent[]; // Optional reference documents (max 5 files)
  directoryId: string; // Directory to place the generated document
  ruleIds?: string[]; // Optional rules for content generation
  ruleResolutionMode?: RuleResolutionMode;
}

export interface GenerateFromPromptResponse extends StartGenerationResponse {
  documentId: string;
  title?: string;
  content?: string;
  wordCount?: number;
  metadata?: {
    originalPrompt: string;
    generatedAt: string;
    filesUsed?: number; // Number of context files used
  };
}

export interface GenerateFromScreenshotRequest {
  imageBase64: string;
  directoryId: string;
  title?: string;
  prompt?: string;
  ruleIds?: string[];
  ruleResolutionMode?: RuleResolutionMode;
}

export interface GenerateFromScreenshotResponse
  extends StartGenerationResponse {
  documentId: string;
  title?: string;
  content?: string;
  wordCount?: number;
  metadata?: {
    generatedAt?: string;
    sourceType?: 'screenshot';
    directoryId?: string;
    prompt?: string;
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
  hint?: string;
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
  processMarkdownFile(
    content: string,
    fileName: string,
  ): Promise<ProcessedContent>;
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
  maxSize: number;
  allowedTypes: string[];
  allowedExtensions: string[];
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
  questionType?: 'multiple-choice' | 'diagram' | 'sequence';
  sequenceItems?: string[];
  userSequence?: string[];
  correctSequence?: string[];
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
    questionType?: 'multiple-choice' | 'diagram' | 'sequence';
    sequenceItems?: string[];
    userSequence?: string[];
    correctSequence?: string[];
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

/** Shared limits for AI revision flows (rules improve + document edit). */
export const AI_REVISION_INSTRUCTION_MAX = 15_000;
export const AI_REVISION_EXISTING_CONTENT_MAX = 100_000;

export interface ReviseDocumentWithAIRequest {
  documentId: string;
  instruction: string;
}

export interface ReviseDocumentWithAIResponse {
  content: string;
}

export interface DocumentReviseContext {
  document: {
    title: string;
    content: string;
  };
  instruction: string;
  contentFormat?: DocumentContentFormat;
}

// Directory Chat API Types
export type DirectoryChatRole = 'user' | 'assistant';

export interface DirectoryChatMessage {
  id: string;
  role: DirectoryChatRole;
  content: string;
  createdAt: string;
  seedKey?: string;
}

export interface DirectoryChatArtifactContext {
  type:
    | 'quiz'
    | 'diagramQuiz'
    | 'sequenceQuiz'
    | 'matchQuiz'
    | 'slideDeck'
    | 'flashcardSet'
    | 'document';
  title?: string;
  question?: string;
  options?: string[];
  userAnswer?: string;
  correctAnswer?: string;
  explanation?: string;
  sequenceItems?: string[];
  userSequence?: string[];
  correctSequence?: string[];
  /** Prompt texts for match-quiz context, in row order. */
  matchPrompts?: string[];
  /** User placements as prompt text to option text, in row order. */
  userMatches?: string[];
  /** Correct placements as prompt text to option text, in row order. */
  correctMatches?: string[];
  slideTitle?: string;
  slideContent?: string;
  speakerNotes?: string;
  followupRuleIds?: string[];
}

export interface RetrievedDirectoryChatChunk {
  documentId: string;
  documentTitle: string;
  text: string;
}

export interface DirectoryChatPromptContext {
  directoryName: string;
  userMessage: string;
  chatRules?: string;
  conversationSummary?: string;
  recentMessages: DirectoryChatMessage[];
  retrievedChunks: RetrievedDirectoryChatChunk[];
  artifactContext?: DirectoryChatArtifactContext;
}

export interface DirectoryChatSourceSummary {
  id: string;
  title: string;
}

export interface GetDirectoryChatRequest {
  directoryId: string;
}

export interface GetDirectoryChatResponse {
  directoryId: string;
  documentCount: number;
  selectedDocumentIds: string[];
  sources: DirectoryChatSourceSummary[];
  messages: DirectoryChatMessage[];
  summary?: string;
}

export interface SendDirectoryChatMessageRequest {
  directoryId: string;
  message: string;
  seedKey?: string;
  artifactContext?: DirectoryChatArtifactContext;
}

export interface SendDirectoryChatMessageResponse {
  directoryId: string;
  documentCount: number;
  selectedDocumentIds: string[];
  sources: DirectoryChatSourceSummary[];
  userMessage: DirectoryChatMessage;
  assistantMessage?: DirectoryChatMessage;
  messages: DirectoryChatMessage[];
  summary?: string;
}

export interface UpdateDirectoryChatSourcesRequest {
  directoryId: string;
  selectedDocumentIds: string[];
}

export interface UpdateDirectoryChatSourcesResponse {
  directoryId: string;
  documentCount: number;
  selectedDocumentIds: string[];
  sources: DirectoryChatSourceSummary[];
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
  CHAT = 'chat',
  FLASHCARD = 'flashcard',
  FLASHCARD_DESC = 'flashcard_desc',
  SLIDE_DECK = 'slide_deck',
  DIAGRAM_QUIZ = 'diagram_quiz',
  SEQUENCE_QUIZ = 'sequence_quiz',
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
  isDefault: boolean; // Always apply — auto-selected for applicable operations
  directoryIds: string[]; // Directories this rule is attached to
  sourceBlueprintId?: string;
  sourceBlueprintVersion?: number;
  sourceBlueprintName?: string;
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
  sourceBlueprintId?: string;
  sourceBlueprintVersion?: number;
  sourceBlueprintName?: string;
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
  includeAncestors?: boolean; // Defaults to true; set false for direct-only rules
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

// ─── Interaction Tracking Types ───────────────────────────────────────────────

export type ArtifactType =
  | 'document'
  | 'quiz'
  | 'flashcardSet'
  | 'slideDeck'
  | 'diagramQuiz'
  | 'sequenceQuiz'
  | 'matchQuiz';

export interface InteractionSession {
  id: string;
  userId: string;
  artifactId: string;
  artifactType: ArtifactType;
  directoryId: string;
  startedAt: Date | { toDate(): Date };
  lastActiveAt: Date | { toDate(): Date };
  activeSeconds: number;
  date: string; // "YYYY-MM-DD" partition key
}

export interface InteractionStat {
  id: string; // "{directoryId}_{date}"
  userId: string;
  directoryId: string;
  date: string; // "YYYY-MM-DD"
  totalSeconds: number;
  ownSeconds: number;
  byArtifactType: Record<ArtifactType, number>;
  sessionCount: number;
}

export interface FlushInteractionSessionRequest {
  artifactId: string;
  artifactType: ArtifactType;
  directoryId: string;
  activeSeconds: number;
  startedAt: string; // ISO string
}

export interface FlushInteractionSessionResponse {
  sessionId: string;
}

export interface GetInteractionStatsRequest {
  directoryId?: string; // omit for all directories
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
}

export interface GetInteractionStatsResponse {
  stats: InteractionStat[];
}

// ─── Learning Telemetry Types ───────────────────────────────────────────────

export type QuizTelemetryType =
  | 'quiz'
  | 'diagramQuiz'
  | 'sequenceQuiz'
  | 'matchQuiz';

export type QuizAnswerValue = string | string[] | number | number[] | null;

export type LearningTelemetryEventType =
  | 'quiz_attempt_completed'
  | 'question_answered'
  | 'detailed_explanation_requested';

export interface RecordQuizAttemptAnswerInput {
  questionIndex: number;
  selectedAnswer: QuizAnswerValue;
  timeSpentMs?: number;
  detailedExplanationRequested?: boolean;
  detailedExplanationRequestedAt?: string;
}

export interface RecordQuizAttemptRequest {
  quizId: string;
  quizType: QuizTelemetryType;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  answers: RecordQuizAttemptAnswerInput[];
}

export interface RecordQuizAttemptResponse {
  attemptId: string;
}

export interface RecordQuizExplanationRequest {
  quizId: string;
  quizType: QuizTelemetryType;
  questionIndex: number;
  requestedAt?: string;
}

export interface RecordQuizExplanationResponse {
  eventId: string;
}

export interface QuizAttemptAnswer {
  questionIndex: number;
  questionText: string;
  selectedAnswer: QuizAnswerValue;
  correctAnswer: QuizAnswerValue;
  isCorrect: boolean;
  timeSpentMs?: number;
  knowledge: QuestionKnowledgeMetadata;
  detailedExplanationRequested: boolean;
  detailedExplanationRequestedAt?: Date | { toDate(): Date };
}

export interface QuizAttempt {
  id: string;
  userId: string;
  quizId: string;
  quizType: QuizTelemetryType;
  documentIds: string[];
  directoryId: string;
  startedAt: Date | { toDate(): Date };
  completedAt: Date | { toDate(): Date };
  durationMs: number;
  score: number;
  totalQuestions: number;
  percentage: number;
  answers: QuizAttemptAnswer[];
  date: string;
}

export interface QuizStatsSummary {
  id: string;
  userId: string;
  quizId: string;
  quizType: QuizTelemetryType;
  directoryId: string;
  documentIds: string[];
  attemptCount: number;
  totalQuestions: number;
  totalScore: number;
  totalPercentage: number;
  totalDurationMs: number;
  bestScore: number;
  bestPercentage: number;
  latestScore: number;
  latestPercentage: number;
  incorrectAnswerCount: number;
  explanationRequestCount: number;
  lastAttemptAt?: Date | { toDate(): Date };
  updatedAt: Date | { toDate(): Date };
}

export interface QuestionStatsSummary {
  id: string;
  userId: string;
  quizId: string;
  quizType: QuizTelemetryType;
  questionIndex: number;
  questionText: string;
  knowledge: QuestionKnowledgeMetadata;
  answerCount: number;
  correctCount: number;
  incorrectCount: number;
  explanationRequestCount: number;
  updatedAt: Date | { toDate(): Date };
}

export interface KnowledgeStatsSummary {
  id: string;
  userId: string;
  date: string;
  subjectId?: string;
  subjectName?: string;
  knowledgeDomainId?: string;
  knowledgeDomainName?: string;
  topicTags: string[];
  answerCount: number;
  correctCount: number;
  incorrectCount: number;
  explanationRequestCount: number;
  updatedAt: Date | { toDate(): Date };
}

export interface LearningTelemetryEvent {
  id: string;
  userId: string;
  eventType: LearningTelemetryEventType;
  quizId: string;
  quizType: QuizTelemetryType;
  questionIndex?: number;
  isCorrect?: boolean;
  knowledge?: QuestionKnowledgeMetadata;
  occurredAt: Date | { toDate(): Date };
}

export interface GetQuizStatsRequest {
  quizId: string;
  quizType: QuizTelemetryType;
}

export interface GetQuizStatsResponse {
  stats: QuizStatsSummary | null;
}

// ─── Statistics Page Types ──────────────────────────────────────────────────

export type StatisticsTimeRangeKey = '7d' | '30d' | '90d' | 'all';

export type StatisticsQuizTypeFilter = QuizTelemetryType | 'all';

export interface StatisticsDateRangeRequest {
  startDate?: string; // "YYYY-MM-DD"; omitted for all time
  endDate?: string; // "YYYY-MM-DD"; omitted for all time
  quizType?: StatisticsQuizTypeFilter;
}

export interface StatisticsDocumentSummary {
  id: string;
  title: string;
}

export interface StatisticsOverviewMetrics {
  attemptCount: number;
  quizCount: number;
  answeredQuestionCount: number;
  correctAnswerCount: number;
  incorrectAnswerCount: number;
  explanationRequestCount: number;
  accuracyPercentage: number;
}

export interface StatisticsRecentFailure {
  id: string;
  attemptId: string;
  quizId: string;
  quizType: QuizTelemetryType;
  quizTitle?: string;
  questionIndex: number;
  questionText: string;
  selectedAnswer: QuizAnswerValue;
  selectedAnswerLabel: string;
  correctAnswer: QuizAnswerValue;
  correctAnswerLabel: string;
  /** Mermaid source for diagram-quiz failures (selected option index). */
  selectedDiagramCode?: string;
  /** Mermaid source for diagram-quiz failures (correct option index). */
  correctDiagramCode?: string;
  knowledge: QuestionKnowledgeMetadata;
  sourceDocuments: StatisticsDocumentSummary[];
  occurredAt: string;
  repeatedFailureCount: number;
}

export interface GetStatisticsOverviewResponse {
  metrics: StatisticsOverviewMetrics;
  recentFailures: StatisticsRecentFailure[];
}

export interface StatisticsQuizPerformanceItem {
  id: string;
  quizId: string;
  quizType: QuizTelemetryType;
  quizTitle?: string;
  sourceDocuments: StatisticsDocumentSummary[];
  attemptCount: number;
  answeredQuestionCount: number;
  correctAnswerCount: number;
  incorrectAnswerCount: number;
  explanationRequestCount: number;
  accuracyPercentage: number;
  bestPercentage: number;
  latestPercentage: number;
  totalDurationMs: number;
  lastAttemptAt?: string;
}

export interface GetStatisticsQuizPerformanceResponse {
  quizzes: StatisticsQuizPerformanceItem[];
  recentFailures: StatisticsRecentFailure[];
}

export interface StatisticsLearningTimeArtifact {
  id: string;
  artifactId: string;
  artifactType: ArtifactType;
  title: string;
  totalSeconds: number;
  sessionCount: number;
  lastActiveAt?: string;
}

export interface StatisticsLearningTimeByType {
  artifactType: ArtifactType;
  totalSeconds: number;
  sessionCount: number;
}

export interface GetStatisticsLearningTimeResponse {
  totalSeconds: number;
  sessionCount: number;
  byArtifactType: StatisticsLearningTimeByType[];
  topArtifacts: StatisticsLearningTimeArtifact[];
}

export interface StatisticsQuizDetailAttempt {
  attemptId: string;
  completedAt: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  durationMs: number;
  incorrectAnswerCount: number;
}

export interface GetStatisticsQuizDetailRequest
  extends StatisticsDateRangeRequest {
  quizId: string;
  quizType: QuizTelemetryType;
}

export interface StatisticsQuestionBreakdownItem {
  questionIndex: number;
  questionText: string;
  answerCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracyPercentage: number;
}

export interface GetStatisticsQuizDetailResponse {
  quiz: StatisticsQuizPerformanceItem | null;
  attempts: StatisticsQuizDetailAttempt[];
  questionBreakdown: StatisticsQuestionBreakdownItem[];
  failedQuestions: StatisticsRecentFailure[];
}

/** Provider family for a configured provider connection. */
export type LlmProviderKind = 'gemini' | 'openrouter' | 'minimax' | 'together';

/** @deprecated Use LlmProviderKind */
export type LlmProviderType = LlmProviderKind;

export const PRIMARY_GEMINI_CONNECTION_ID = 'gemini-primary';
export const PRIMARY_OPENROUTER_CONNECTION_ID = 'openrouter-primary';
export const PRIMARY_MINIMAX_CONNECTION_ID = 'minimax-primary';
export const PRIMARY_TOGETHER_CONNECTION_ID = 'together-primary';

export const ALL_LLM_MODALITIES = [
  'text',
  'vision',
  'image',
  'embedding',
] as const;

export type LlmModality = 'text' | 'vision' | 'image' | 'embedding';

export type LlmCredentialMode = 'encrypted-firestore';

export type LlmConnectionValidationStatus = 'unknown' | 'healthy' | 'unhealthy';

export interface ILlmConnectionAuditFields {
  updatedAt?: string;
  updatedBy?: string;
  lastValidatedAt?: string;
  lastValidationError?: string | null;
  lastValidationStatus?: LlmConnectionValidationStatus;
}

/** Normalized model entry uploaded from a provider list-models response. */
export interface IProviderAvailableModel {
  id: string;
  label: string;
  supportedModalities: LlmModality[];
}

export type ProviderModelSyncSource = 'provider-test' | 'provider-save';

export interface IProviderModelCatalogFields {
  availableModels?: IProviderAvailableModel[];
  modelsSyncedAt?: string;
  modelsSyncSource?: ProviderModelSyncSource;
}

export interface IGeminiProviderConnection
  extends ILlmConnectionAuditFields,
    IProviderModelCatalogFields {
  providerKind: 'gemini';
  label: string;
  credentialMode: 'encrypted-firestore';
  apiKeyConfigured: boolean;
  supportedModalities: LlmModality[];
  defaultModel: string;
  defaultVisionModel?: string;
  defaultImageModel?: string;
}

export interface IUpdateGeminiSettingsRequest {
  defaultModel: string;
  defaultVisionModel?: string;
  defaultImageModel?: string;
  apiKey?: string;
}

export interface IGeminiConnectionTestResult {
  success: boolean;
  message: string;
  validatedAt?: string;
  model?: string;
}

export interface IOpenRouterProviderPreferences {
  order?: string[];
  allowFallbacks?: boolean;
  sort?: 'latency' | 'throughput' | 'price';
  zdr?: boolean;
}

export interface IOpenRouterProviderHeaders {
  httpReferer?: string;
  title?: string;
}

export interface IOpenRouterProviderConnection
  extends ILlmConnectionAuditFields,
    IProviderModelCatalogFields {
  providerKind: 'openrouter';
  label: string;
  credentialMode: 'encrypted-firestore';
  apiKeyConfigured: boolean;
  supportedModalities: LlmModality[];
  baseUrl: string;
  defaultModel: string;
  /** Screenshot / image-understanding model (image-in → text-out) */
  defaultVisionModel?: string;
  /** Slide deck image generation model (text-in → image-out) */
  defaultImageModel?: string;
  headers?: IOpenRouterProviderHeaders;
  providerPreferences?: IOpenRouterProviderPreferences;
}

export interface IEncryptedSecretRecord {
  version: 1;
  algorithm: 'aes-256-gcm';
  iv: string;
  authTag: string;
  ciphertext: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface IUpdateOpenRouterSettingsRequest {
  enabled?: boolean;
  baseUrl: string;
  defaultModel: string;
  defaultVisionModel?: string;
  defaultImageModel?: string;
  apiKey?: string;
  headers?: IOpenRouterProviderHeaders;
}

export interface IMiniMaxProviderConnection
  extends ILlmConnectionAuditFields,
    IProviderModelCatalogFields {
  providerKind: 'minimax';
  label: string;
  credentialMode: 'encrypted-firestore';
  apiKeyConfigured: boolean;
  supportedModalities: LlmModality[];
  /** OpenAI-compatible chat base URL (text + vision) */
  baseUrl: string;
  defaultModel: string;
  /** Screenshot / image-understanding model (image-in → text-out) */
  defaultVisionModel?: string;
  /** Slide deck image generation model (text-in → image-out) */
  defaultImageModel?: string;
  /** Dedicated image generation endpoint URL */
  imageGenerationUrl: string;
}

export interface IUpdateMiniMaxSettingsRequest {
  enabled?: boolean;
  baseUrl: string;
  defaultModel: string;
  defaultVisionModel?: string;
  defaultImageModel?: string;
  imageGenerationUrl: string;
  apiKey?: string;
}

export interface IMiniMaxConnectionTestResult {
  success: boolean;
  message: string;
  validatedAt?: string;
  model?: string;
}

export interface ITogetherProviderConnection
  extends ILlmConnectionAuditFields,
    IProviderModelCatalogFields {
  providerKind: 'together';
  label: string;
  credentialMode: 'encrypted-firestore';
  apiKeyConfigured: boolean;
  supportedModalities: LlmModality[];
  baseUrl: string;
  defaultModel: string;
  /** Screenshot / image-understanding model (image-in → text-out) */
  defaultVisionModel?: string;
  /** Slide deck image generation model (text-in → image-out) */
  defaultImageModel?: string;
  /** Agent knowledge embedding model (text-in → vector-out) */
  defaultEmbeddingModel?: string;
}

export interface IUpdateTogetherSettingsRequest {
  enabled?: boolean;
  baseUrl: string;
  defaultModel: string;
  defaultVisionModel?: string;
  defaultImageModel?: string;
  defaultEmbeddingModel?: string;
  apiKey?: string;
}

export interface ITogetherConnectionTestResult {
  success: boolean;
  message: string;
  validatedAt?: string;
  model?: string;
}

export interface IOpenRouterConnectionTestResult {
  success: boolean;
  message: string;
  validatedAt?: string;
  model?: string;
}

export type LlmCapabilityKey =
  | 'quiz'
  | 'flashcards'
  | 'documentFromPrompt'
  | 'documentFromScreenshot'
  | 'quizFollowup'
  | 'documentQuestion'
  | 'documentRevise'
  | 'directoryChat'
  | 'diagramQuiz'
  | 'diagramQuizAgent'
  | 'sequenceQuiz'
  | 'matchQuiz'
  | 'slideDeckText'
  | 'slideDeckImage'
  | 'sourceDocumentEnhancement'
  | 'ruleGeneration'
  | 'directoryAgent'
  | 'agentExecutor'
  | 'agentKnowledgeEmbedding';

// --- LLM setup & user group routing ---

import type {
  GenerationKind,
  GenerationWorkflow,
} from './generation-kind-metadata';

export type {
  GenerationKind,
  GenerationWorkflow,
  IGenerationKindMetadata,
} from './generation-kind-metadata';
export {
  ADMIN_CONFIGURABLE_GENERATION_KINDS,
  ALL_GENERATION_KINDS,
  GENERATION_KIND_ALIASES,
  GENERATION_KIND_METADATA,
  isGenerationKind,
  isGenerationWorkflow,
  resolveGenerationKind,
} from './generation-kind-metadata';

import {
  applyLlmGenerationFlowOverrides,
  type ILlmGenerationFlows,
  type LlmGenerationFlowId,
} from './llm-generation-flows';

export type {
  ILlmGenerationFlowBaseSettings,
  ILlmGenerationFlowMetadata,
  ILlmGenerationFlowOverrides,
  ILlmGenerationFlows,
  LlmGenerationFlowId,
} from './llm-generation-flows';
export {
  applyLlmGenerationFlowOverrides,
  DEFAULT_LLM_GENERATION_FLOWS,
  isLlmGenerationFlowId,
  LLM_GENERATION_FLOW_IDS,
  LLM_GENERATION_FLOW_METADATA,
} from './llm-generation-flows';

export interface ILlmModalityRoute {
  connectionId: string;
  model: string;
}

export interface IGenerationRoute extends ILlmModalityRoute {
  modality: LlmModality;
  workflow: GenerationWorkflow;
}

export type IGenerationRoutes = Record<GenerationKind, IGenerationRoute>;

export interface IGenerationModelUsage {
  kind: GenerationKind;
  role: 'generation' | 'agent';
  workflow: GenerationWorkflow;
  modality: LlmModality;
  providerKind: LlmProviderKind;
  connectionId: string;
  model: string;
  llmSetupId: string;
  userGroupId: string;
  durationMs?: number;
}

export interface ILlmGenerationRuntimeSettings {
  requestTimeoutMs: number;
  maxOutputTokens: number;
  temperature: number;
  topK: number;
  topP: number;
  disableReasoning: boolean;
  thinkingBudget?: number;
}

export type LlmGenerationProfileId =
  | 'structuredArtifact'
  | 'explanatoryChat'
  | 'longformContent'
  | 'faithfulEdit'
  | 'deterministicUtility';

export const LLM_GENERATION_PROFILE_IDS: LlmGenerationProfileId[] = [
  'structuredArtifact',
  'explanatoryChat',
  'longformContent',
  'faithfulEdit',
  'deterministicUtility',
];

export type ILlmGenerationProfileOverrides = Partial<
  Omit<ILlmGenerationRuntimeSettings, 'requestTimeoutMs'>
>;

export type ILlmGenerationProfiles = Partial<
  Record<LlmGenerationProfileId, ILlmGenerationProfileOverrides>
>;

export interface ILlmGenerationProfileMetadata {
  id: LlmGenerationProfileId;
  label: string;
  description: string;
  flows: string[];
}

export const LLM_GENERATION_PROFILE_METADATA: ILlmGenerationProfileMetadata[] =
  [
    {
      id: 'structuredArtifact',
      label: 'Structured artifact',
      description:
        'JSON and structured outputs for quizzes, flashcards, and document generation.',
      flows: [
        'quiz',
        'sequenceQuiz',
        'diagramQuiz plan',
        'flashcards',
        'document agent/direct/repair',
      ],
    },
    {
      id: 'explanatoryChat',
      label: 'Explanatory chat',
      description: 'Follow-ups, document Q&A, and directory chat answers.',
      flows: ['quizFollowup', 'documentQuestion', 'directoryChat'],
    },
    {
      id: 'longformContent',
      label: 'Longform content',
      description:
        'One-shot documents, slide outlines, and vision screenshot generation.',
      flows: ['documentFromPrompt', 'documentFromScreenshot', 'slideDeckText'],
    },
    {
      id: 'faithfulEdit',
      label: 'Faithful edit',
      description: 'Document revisions and rule generation.',
      flows: ['documentRevise', 'ruleGeneration'],
    },
    {
      id: 'deterministicUtility',
      label: 'Deterministic utility',
      description:
        'Extraction cleanup, critics, refinements, and diagram repair.',
      flows: [
        'sourceDocumentEnhancement',
        'diagramQuizAgent',
        'screenshot compliance/refine',
      ],
    },
  ];

export const DEFAULT_LLM_GENERATION_PROFILES: Record<
  LlmGenerationProfileId,
  ILlmGenerationProfileOverrides
> = {
  structuredArtifact: {
    temperature: 0.4,
    maxOutputTokens: 16_384,
    disableReasoning: true,
  },
  explanatoryChat: {
    temperature: 0.7,
    maxOutputTokens: 8192,
    disableReasoning: false,
  },
  longformContent: {
    temperature: 0.7,
    maxOutputTokens: 16_384,
    disableReasoning: true,
  },
  faithfulEdit: {
    temperature: 0.5,
    maxOutputTokens: 16_384,
  },
  deterministicUtility: {
    temperature: 0.2,
    maxOutputTokens: 8192,
  },
};

export interface ILlmGenerationSettings extends ILlmGenerationRuntimeSettings {
  profiles?: ILlmGenerationProfiles;
  flows?: ILlmGenerationFlows;
  updatedAt?: string;
  updatedBy?: string;
}

export interface IUpdateLlmGenerationSettingsRequest
  extends Partial<Omit<ILlmGenerationRuntimeSettings, 'thinkingBudget'>> {
  thinkingBudget?: number | null;
  profiles?: ILlmGenerationProfiles;
  flows?: ILlmGenerationFlows;
}

export const DEFAULT_LLM_GENERATION_SETTINGS: ILlmGenerationRuntimeSettings = {
  requestTimeoutMs: 120_000,
  maxOutputTokens: 16_384,
  temperature: 0.4,
  topK: 40,
  topP: 0.95,
  disableReasoning: false,
};

export function resolveLlmGenerationProfileSettings(
  globalSettings: ILlmGenerationRuntimeSettings,
  profileId: LlmGenerationProfileId,
  storedProfiles?: ILlmGenerationProfiles,
): ILlmGenerationRuntimeSettings {
  const seedProfile = DEFAULT_LLM_GENERATION_PROFILES[profileId];
  const storedProfile = storedProfiles?.[profileId];

  const merged: ILlmGenerationRuntimeSettings = {
    requestTimeoutMs: globalSettings.requestTimeoutMs,
    maxOutputTokens:
      storedProfile?.maxOutputTokens ??
      seedProfile.maxOutputTokens ??
      globalSettings.maxOutputTokens,
    temperature:
      storedProfile?.temperature ??
      seedProfile.temperature ??
      globalSettings.temperature,
    topK: storedProfile?.topK ?? seedProfile.topK ?? globalSettings.topK,
    topP: storedProfile?.topP ?? seedProfile.topP ?? globalSettings.topP,
    disableReasoning:
      storedProfile?.disableReasoning ??
      seedProfile.disableReasoning ??
      globalSettings.disableReasoning,
  };

  const thinkingBudget =
    storedProfile?.thinkingBudget ??
    seedProfile.thinkingBudget ??
    globalSettings.thinkingBudget;
  if (thinkingBudget !== undefined) {
    merged.thinkingBudget = thinkingBudget;
  }

  return merged;
}

export function resolveLlmGenerationFlowRuntimeSettings(
  globalSettings: ILlmGenerationRuntimeSettings,
  options: {
    /** @deprecated Profiles are code-only; ignored when flowId is set. */
    profileId?: LlmGenerationProfileId;
    flowId?: LlmGenerationFlowId;
    /** @deprecated Profiles are no longer edited in admin. */
    storedProfiles?: ILlmGenerationProfiles;
    storedFlows?: ILlmGenerationFlows;
  },
): ILlmGenerationRuntimeSettings {
  if (options.flowId) {
    return applyLlmGenerationFlowOverrides(
      globalSettings,
      options.flowId,
      options.storedFlows,
    );
  }

  if (options.profileId) {
    return resolveLlmGenerationProfileSettings(
      globalSettings,
      options.profileId,
      options.storedProfiles,
    );
  }

  return { ...globalSettings };
}

export const LLM_GENERATION_SETTINGS_LIMITS = {
  requestTimeoutMs: { min: 5_000, max: 540_000 },
  maxOutputTokens: { min: 1, max: 65_536 },
  temperature: { min: 0, max: 2 },
  topK: { min: 1, max: 100 },
  topP: { min: 0, max: 1 },
  thinkingBudget: { min: 0, max: 65_536 },
} as const;

/** Admin picker entry for LLM setup route configuration. */
export interface IProviderConnectionCatalogEntry {
  id: string;
  providerKind: LlmProviderKind;
  label: string;
  apiKeyConfigured: boolean;
  supportedModalities: LlmModality[];
  availableModels: IProviderAvailableModel[];
  modelsSyncedAt?: string;
}

export interface ILlmSetup {
  id: string;
  name: string;
  description?: string;
  generationRoutes: IGenerationRoutes;
  updatedAt?: string;
  updatedBy?: string;
}

export interface IUserGroup {
  id: string;
  name: string;
  llmSetupId: string;
  usageLimitsSetupId: string;
  isDefaultRegistrationGroup?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

/** Firestore users/{uid} profile fields used for LLM routing. */
export interface IUserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  createdAt?: string;
  updatedAt?: string;
  userGroupId?: string;
  emailVerificationExempt?: boolean;
}

export interface ICreateLlmSetupRequest {
  name: string;
  description?: string;
  generationRoutes: IGenerationRoutes;
}

export interface IUpdateLlmSetupRequest {
  name?: string;
  description?: string;
  generationRoutes?: IGenerationRoutes;
}

export interface ICreateUserGroupRequest {
  name: string;
  llmSetupId: string;
  usageLimitsSetupId: string;
  isDefaultRegistrationGroup?: boolean;
}

export interface IUpdateUserGroupRequest {
  name?: string;
  llmSetupId?: string;
  usageLimitsSetupId?: string;
  isDefaultRegistrationGroup?: boolean;
}

export interface IAssignUserGroupRequest {
  userGroupId: string;
}

export interface IUpdateUserVerificationExemptionRequest {
  emailVerificationExempt: boolean;
}

export interface IBootstrapUserProfileResponse {
  profile: IUserProfile;
}

export type {
  ICreateUsageLimitsSetupRequest,
  IUpdateUsageLimitsSetupRequest,
  IUsageFeatureAvailability,
  IUsageFeaturePolicies,
  IUsageFeaturePolicy,
  IUsageLimitEvent,
  IUsageLimitsProfilePreset,
  IUsageLimitsSetup,
  IUsagePeriodSummary,
  ISubscriptionPlanSummary,
  IUsageDailySlideDeckSummary,
  IUsageStorageSummary,
  IUserUsageSummary,
  ICalculateAgentLoopCreditsParams,
  UsageLimitErrorCode,
  UsageLimitEventType,
} from './usage-limits';
export {
  buildUsageDayKey,
  buildUsageDayResetAt,
  buildUsagePeriodKey,
  buildUsagePeriodResetAt,
  calculateDailySlideDecksUsed,
  calculateRemainingCredits,
  calculateRemainingDailySlideDecks,
  calculateRemainingStorageBytes,
  calculateUsageCreditCharge,
  calculateAgentLoopCredits,
  createDefaultFeaturePolicies,
  DEFAULT_USAGE_CREDIT_COSTS,
  AGENT_LOOP_CREDIT_CAP,
  AGENT_LOOP_USD_MARKUP,
  AGENT_LOOP_UNKNOWN_CALL_CREDITS,
  FREE_TIER_DISABLED_KINDS,
  FREE_TIER_STORAGE_LIMIT_BYTES,
  POWER_TIER_STORAGE_LIMIT_BYTES,
  PRO_TIER_STORAGE_LIMIT_BYTES,
  resolveLegacySetupQuotaDefaults,
  resolveLivePeriodAllowance,
  resolvePresetQuotaDefaults,
  STANDARD_TIER_STORAGE_LIMIT_BYTES,
  USAGE_LIMITS_PROFILE_PRESETS,
} from './usage-limits';

export type {
  BillingStatus,
  IBillingConfig,
  ICreateBillingCheckoutSessionRequest,
  ICreateBillingCheckoutSessionResponse,
  ICreateBillingPortalSessionRequest,
  ICreateBillingPortalSessionResponse,
  IUpdatePayAsYouGoSettingsRequest,
  IUsageCreditSplit,
  IUsagePayAsYouGoSummary,
  IUserBillingState,
  SubscriptionStatus,
} from './billing';
export {
  calculateOverageAmountCents,
  calculateRemainingOverageCapCents,
  DEFAULT_BILLING_REDIRECT_ORIGINS,
  DEFAULT_PAYG_MONTHLY_CAP_CENTS,
  DEFAULT_PRICE_PER_CREDIT_CENTS,
  formatCreditUnitPriceFromCents,
  formatCurrencyFromCents,
  roundInvoiceAmountCents,
} from './billing';
export type {
  IAdminProviderCostPeriod,
  ILlmUsageEvent,
  IProviderCostBucket,
  IProviderCostContext,
  IProviderRateCatalogEntry,
  IProviderRateSnapshot,
  IProviderUsageUnits,
  IRecordProviderCallParams,
  IUserProviderCostPeriod,
  ProviderCostCallRole,
  ProviderCostCallStatus,
  ProviderCostMeter,
  ProviderCostSource,
} from './provider-cost';
export { isAgentLoopBillableCallRole } from './provider-cost';
export {
  calculateProviderCostUsd,
  inferProviderCostMeter,
} from './provider-cost-logic';
export type { ICalculateProviderCostUsdParams } from './provider-cost-logic';
export {
  buildRateCatalogDocId,
  FALLBACK_PROVIDER_RATE_CATALOG,
  lookupFallbackRate,
} from './provider-rate-fallbacks';
export {
  buildProviderRateCatalogForSync,
  extractRateCatalogEntriesFromProviderPayload,
  parseProviderPricingFromOpenRouterModel,
  parseProviderPricingFromTogetherModel,
} from './provider-rate-catalog-parse';

/** Stable error codes surfaced to clients when LLM routing cannot proceed. */
export type LlmRoutingErrorCode =
  | 'USER_GROUP_NOT_ASSIGNED'
  | 'USER_GROUP_NOT_FOUND'
  | 'LLM_SETUP_NOT_FOUND'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'GENERATION_ROUTE_NOT_CONFIGURED';

export interface ILlmRoutingErrorDetails {
  code: LlmRoutingErrorCode;
  userId?: string;
  userGroupId?: string;
  llmSetupId?: string;
  modality?: LlmModality;
  kind?: GenerationKind;
}

export interface IDocumentFromScreenshotJobPayload {
  imageBase64: string;
  directoryId: string;
  title?: string;
  prompt?: string;
  ruleIds?: string[];
  additionalRuleIds?: string[];
  ruleResolutionMode?: RuleResolutionMode;
}

export type DocumentAgentSourceKind =
  | 'prompt'
  | 'upload'
  | 'url'
  | 'screenshot'
  | 'content'
  | 'paste';

export interface IDocumentAgentJobPayload {
  sourceKind: DocumentAgentSourceKind;
  title?: string;
  description?: string;
  tags?: string[];
  prompt?: string;
  files?: IFileContent[];
  /** Pre-extracted source text (upload/url/content paths). */
  sourceText?: string;
  sourceFilename?: string;
  imageBase64?: string;
  ruleIds?: string[];
  additionalRuleIds?: string[];
  ruleResolutionMode?: RuleResolutionMode;
  /** URL import metadata for description/tags. */
  sourceUrls?: string[];
  sourceUrl?: string;
}

export interface IDocumentContentResult {
  content: string;
  contentFormat: DocumentContentFormat;
  storagePath: string;
}

// ─── Bulk operations ──────────────────────────────────────────────────────────

/** Default max items accepted by bulk callables. */
export const BULK_OPERATION_MAX_ITEMS = 50;

export interface IBulkOperationItemResult {
  id: string;
  success: boolean;
  error?: string;
}

export interface IBulkOperationResponse {
  results: IBulkOperationItemResult[];
  succeeded: number;
  failed: number;
}

export interface IBulkDeleteByIdsRequest {
  ids: string[];
}

export interface IBulkDeleteDocumentsRequest {
  documentIds: string[];
}

export interface IBulkDeleteDirectoriesRequest {
  directoryIds: string[];
}

export interface IBulkDeleteRulesRequest {
  ruleIds: string[];
}

export interface IBulkDetachRulesFromDirectoryRequest {
  directoryId: string;
  ruleIds: string[];
}

export interface IApiKey {
  keyId: string;
  name: string;
  keyPrefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  active: boolean;
}

export interface IBulkRevokeApiKeysRequest {
  keyIds: string[];
}

/** Artifact types that can be bulk-deleted from directory detail panels. */
export type BulkDeletableArtifactType = ArtifactSummaryType;

export interface IBulkDeleteArtifactItem {
  id: string;
  type: BulkDeletableArtifactType;
}

export interface IBulkDeleteArtifactsRequest {
  artifacts: IBulkDeleteArtifactItem[];
}

export * from './rule-blueprints';
