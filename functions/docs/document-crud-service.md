# Document CRUD Service Documentation

## Overview

The `DocumentCrudService` is a comprehensive service class that manages all document CRUD (Create, Read, Update, Delete) operations in the Code Insights AI application. It serves as the primary interface between the Firebase Cloud Functions endpoints and the underlying data storage systems (Firestore for metadata and Firebase Storage for content).

## Architecture

The service operates on a dual-storage architecture:

- **Firestore**: Stores document metadata (title, description, tags, word count, etc.)
- **Firebase Storage**: Stores actual document content (markdown files)

This separation allows for efficient querying and listing of documents without loading large content files.

## Dependencies

- **Firebase Admin**: Firestore database operations
- **DocumentService**: Content storage operations in Firebase Storage
- **Shared Types**: Type definitions for documents, requests, and responses
- **Firebase Functions Logger**: Comprehensive logging throughout operations

## Core Methods

### Document Creation

#### `createDocument(userId: string, request: CreateDocumentRequest): Promise<Document>`

Creates a new document with both metadata and content storage.

**Process Flow:**
1. Validates content using `DocumentService.validateDocumentContent()`
2. Generates unique document ID via Firestore
3. Counts words in content for metadata
4. Uploads content to Firebase Storage via `DocumentService.uploadDocument()`
5. Creates metadata record in Firestore
6. Updates directory document count if document is assigned to a directory
7. Returns complete document object

**Parameters:**
- `userId`: Authenticated user's unique identifier
- `request`: Document creation request containing:
  - `title`: Document title (required)
  - `content`: Document content (required)
  - `sourceType`: Document source type (required)
  - `description`: Optional description
  - `sourceUrl`: Optional source URL
  - `status`: Document status (defaults to ACTIVE)
  - `tags`: Optional tags array
  - `directoryId`: Optional directory assignment

**Returns:** Complete `Document` object with all metadata

**Error Handling:**
- Content validation failures
- Storage upload errors
- Firestore write failures
- Directory update failures (non-blocking)

### Document Retrieval

#### `getDocument(userId: string, documentId: string): Promise<Document>`

Retrieves document metadata without content (efficient for listing operations).

**Security Features:**
- Validates document existence
- Enforces user ownership (documents are user-scoped)
- Ensures document ID is properly set from Firestore document ID

**Returns:** Document metadata object

#### `getDocumentWithContent(userId: string, documentId: string): Promise<Document & { content: string }>`

Retrieves complete document including content from Firebase Storage.

**Process:**
1. Gets document metadata via `getDocument()`
2. Fetches content from storage via `DocumentService.getDocumentContent()`
3. Merges metadata and content in response

**Returns:** Document object with `content` field included

### Document Updates

#### `updateDocument(userId: string, documentId: string, updates: UpdateDocumentRequest): Promise<Document>`

Updates document metadata and/or content with transactional consistency.

**Supported Updates:**
- `title`: Document title
- `description`: Document description
- `content`: Document content (triggers storage update)
- `tags`: Document tags
- `status`: Document status

**Process Flow:**
1. Validates user ownership via `getDocument()`
2. If content is updated:
   - Validates new content
   - Recalculates word count
   - Uploads new content to storage
3. Updates metadata in Firestore
4. Returns updated document

**Features:**
- Atomic updates (both storage and database updated together)
- Automatic word count recalculation
- Timestamp management
- Storage URL updates when content changes

### Document Deletion

#### `deleteDocument(userId: string, documentId: string): Promise<void>`

Permanently removes document and all associated data.

**Deletion Process:**
1. Retrieves document to check directory assignment
2. Deletes all associated quizzes via `FirestoreService`
3. Updates directory document count (if applicable)
4. Removes content from Firebase Storage
5. Deletes metadata from Firestore

**Associated Data Cleanup:**
- Quiz records linked to the document
- Directory document counts
- Storage files and metadata

### Document Listing & Querying

#### `listDocuments(userId: string, options: ListOptions): Promise<ListResult>`

Retrieves paginated, filtered list of user's documents.

**Filtering Options:**
- `limit`: Result count limit (max 100 per request)
- `offset`: Pagination offset
- `sourceType`: Filter by document source type
- `status`: Filter by document status
- `tags`: Filter by tag array (array-contains-any)
- `directoryId`: Filter by directory (null for root documents)
- `sortBy`: Sort field ('createdAt', 'updatedAt', 'title')
- `sortOrder`: Sort direction ('asc', 'desc')

**Returns:**
```typescript
{
  documents: Document[];
  total: number;        // Total count for pagination
  hasMore: boolean;     // Whether more results exist
}
```

**Performance Features:**
- Efficient Firestore queries with compound indexes
- Pagination support with hasMore indicator
- Total count for UI pagination controls

#### `searchDocuments(userId: string, searchTerm: string, options: SearchOptions): Promise<Document[]>`

Searches documents by title, description, and tags.

**Search Implementation:**
- Client-side filtering after Firestore query (suitable for moderate datasets)
- Case-insensitive text matching
- Searches across title, description, and tags
- Supports additional filtering by sourceType and status

**Note:** For large datasets, consider implementing server-side search with Algolia, Elasticsearch, or Firebase's full-text search extensions.

### Statistics & Analytics

#### `getDocumentStats(userId: string): Promise<DocumentStats>`

Generates comprehensive statistics about user's document collection.

**Statistics Included:**
- Total document count
- Breakdown by source type (URL, UPLOAD, GENERATED, etc.)
- Breakdown by status (ACTIVE, DRAFT, ARCHIVED, etc.)
- Total word count across all documents
- Most recent activity timestamp

**Returns:**
```typescript
{
  total: number;
  bySourceType: Record<DocumentSourceType, number>;
  byStatus: Record<DocumentStatus, number>;
  totalWordCount: number;
  recentActivity: Date | null;
}
```

### Document Organization

#### `moveDocument(userId: string, documentId: string, request: MoveDocumentRequest): Promise<Document>`

Moves a document between directories with automatic count updates.

**Process:**
1. Validates document ownership
2. Decrements count in source directory (if applicable)
3. Updates document's directoryId in Firestore
4. Increments count in target directory (if applicable)
5. Returns updated document

**Directory Management:**
- Automatically maintains accurate document counts in directories
- Supports moving to root (directoryId: null)
- Atomic updates with error recovery

## Utility Methods

### Word Counting
```typescript
private static countWords(content: string): number
```
Accurately counts words in document content with whitespace normalization.

### Date Conversion
```typescript
private static toDate(dateValue: Date | { toDate(): Date }): Date
```
Handles conversion between JavaScript Date objects and Firestore Timestamps.

### Ownership Validation
```typescript
private static validateOwnership(userId: string, documentId: string): Promise<boolean>
```
Ensures document access is limited to the owner.

### Directory Count Management
```typescript
private static updateDirectoryDocumentCount(directoryId: string, delta: number): Promise<void>
```
Maintains accurate document counts in directory records.

## Error Handling Strategy

### Consistent Error Pattern
All methods follow a standardized error handling approach:

1. **Input Validation**: Immediate validation of parameters
2. **Business Logic Errors**: Caught and wrapped with context
3. **External Service Errors**: Handled gracefully with fallbacks where appropriate
4. **Logging**: Comprehensive error logging with sanitized user data
5. **User-Safe Messages**: Error messages safe for client consumption

### Common Error Types
- **Validation Errors**: "Document content cannot be empty"
- **Not Found**: "Document not found"
- **Authorization**: "Unauthorized: Document belongs to different user"
- **Storage Errors**: "Failed to upload document content"
- **Database Errors**: "Failed to save document metadata"

## Security Features

### User Data Isolation
- All operations are user-scoped via `userId` parameter
- Document ownership validated on every access
- No cross-user data visibility possible

### Input Validation
- Content size limits (100KB per document)
- Title and description length validation
- Tag array size limits
- SQL injection prevention via parameterized queries

### Access Controls
- Firebase Authentication required for all operations
- User ID extracted from authenticated context
- Document IDs validated for proper format

## Performance Considerations

### Database Optimization
- Compound indexes for efficient filtering and sorting
- Pagination to limit query result sizes
- Selective field retrieval where appropriate

### Storage Optimization
- Content stored separately from metadata for efficient listing
- Cached download URLs for repeated access
- Automatic cleanup of orphaned storage files

### Memory Management
- Streaming operations for large content
- Proper disposal of file handles and connections
- Limited batch sizes for bulk operations

## Integration Points

### External Services
- **DocumentService**: Firebase Storage operations
- **FirestoreService**: Quiz management and cleanup
- **Firebase Functions**: Logging and error reporting

### Data Flow
1. **Inbound**: Cloud Functions endpoints → DocumentCrudService
2. **Storage**: DocumentCrudService → DocumentService → Firebase Storage
3. **Database**: DocumentCrudService → Firestore
4. **Cleanup**: DocumentCrudService → FirestoreService (for associated data)

## Monitoring & Observability

### Logging Strategy
- **Operation Start**: User ID, document ID, operation type
- **Progress Logging**: Key checkpoints in complex operations
- **Success Logging**: Result summaries and performance metrics
- **Error Logging**: Full error context with sanitized sensitive data

### Key Metrics
- Document creation/update/deletion rates
- Average document sizes and word counts
- Query performance and result set sizes
- Error rates by operation type
- Storage usage patterns

### Performance Monitoring
- Method execution times
- Database query performance
- Storage operation latencies
- Memory usage patterns

## Usage Examples

### Creating a Document
```typescript
const document = await DocumentCrudService.createDocument(userId, {
  title: "Technical Analysis Report",
  description: "Quarterly technical analysis for Q4",
  content: "# Technical Analysis\n\nDetailed analysis...",
  sourceType: DocumentSourceType.UPLOAD,
  tags: ["analysis", "technical", "quarterly"],
  directoryId: "reports-folder-id",
  status: DocumentStatus.ACTIVE
});
```

### Listing Documents with Filtering
```typescript
const result = await DocumentCrudService.listDocuments(userId, {
  limit: 20,
  sourceType: DocumentSourceType.URL,
  status: DocumentStatus.ACTIVE,
  directoryId: null, // Root directory only
  sortBy: 'updatedAt',
  sortOrder: 'desc'
});

console.log(`Found ${result.documents.length} of ${result.total} total documents`);
```

### Searching Documents
```typescript
const documents = await DocumentCrudService.searchDocuments(
  userId, 
  "machine learning",
  { 
    limit: 10,
    status: DocumentStatus.ACTIVE 
  }
);
```

### Moving Documents
```typescript
const movedDocument = await DocumentCrudService.moveDocument(userId, documentId, {
  targetDirectoryId: "new-folder-id"
});
```

## Best Practices

### For Consumers
- Always handle errors gracefully with user-friendly messages
- Use pagination for document lists to avoid large result sets
- Implement caching for frequently accessed document metadata
- Validate user input before passing to service methods

### For Maintenance
- Monitor storage usage and implement cleanup routines
- Review and optimize Firestore query patterns regularly
- Implement proper backup strategies for both metadata and content
- Monitor error rates and investigate anomalies

### For Performance
- Use `getDocument()` for metadata-only operations
- Batch operations when possible to reduce round trips
- Implement client-side caching for static data
- Use appropriate pagination sizes based on UI requirements

This service forms the backbone of document management in the Code Insights AI platform, providing robust, secure, and performant document operations while maintaining data integrity across multiple storage systems.