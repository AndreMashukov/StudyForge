# Document Storage Service Documentation

## Overview

The `DocumentService` is a specialized service class that handles all Firebase Storage operations for document content in the Code Insights AI application. It manages the storage, retrieval, and maintenance of markdown document files, providing a clean abstraction layer between the document CRUD operations and Firebase Storage.

## Architecture

### Storage Structure
```
/users/{userId}/documents/{documentId}/content.md
```

### File Organization
- **User Isolation**: Each user's documents are stored in isolated directories
- **Document Separation**: Each document gets its own subdirectory
- **Standardized Naming**: All content files use `content.md` naming convention
- **Metadata Integration**: Rich metadata stored alongside file content

## Core Responsibilities

1. **Content Storage**: Upload and manage markdown document files
2. **Content Retrieval**: Download and serve document content
3. **Metadata Management**: Handle file metadata and custom properties
4. **URL Generation**: Create secure, time-limited access URLs
5. **Content Validation**: Ensure document content meets requirements
6. **Cleanup Operations**: Remove orphaned files and maintain storage hygiene

## Dependencies

- **Firebase Admin Storage**: Core storage operations
- **Firebase Admin Firestore**: Metadata validation and cross-referencing
- **Shared Types**: Type definitions for documents and storage metadata
- **Firebase Functions Logger**: Comprehensive logging system

## Core Methods

### Document Upload

#### `uploadDocument(userId: string, documentId: string, content: string, metadata: DocumentMetadata): Promise<StorageFile>`

Uploads markdown content to Firebase Storage with comprehensive metadata.

**Process Flow:**
1. Constructs standardized file path
2. Converts content to UTF-8 Buffer
3. Uploads with metadata and caching headers
4. Generates appropriate download URL (emulator vs. production)
5. Returns storage file information

**Content Handling:**
- **Encoding**: UTF-8 encoding for international character support
- **Content Type**: `text/markdown; charset=utf-8`
- **Caching**: `public, max-age=3600` for efficient content delivery
- **Validation**: CRC32C validation for upload integrity

**Metadata Storage:**
```typescript
customMetadata: {
  documentId: string;
  title: string;
  sourceType: string;
  wordCount: string;
  createdAt: string;
  updatedAt: string;
}
```

**URL Generation:**
- **Production**: Signed URLs with 24-hour expiry for security
- **Development/Emulator**: Public URLs for local testing
- **Fallback**: Public URL if signed URL generation fails

**Returns:**
```typescript
{
  path: string;           // Storage file path
  downloadUrl: string;    // Access URL
  metadata: {
    contentType: string;
    size: number;
    timeCreated: string;
    updated: string;
    customMetadata: Record<string, string>;
  }
}
```

### Content Retrieval

#### `getDocumentContent(userId: string, documentId: string): Promise<string>`

Retrieves document content from Firebase Storage.

**Process:**
1. Constructs file path based on user and document IDs
2. Verifies file existence in storage
3. Downloads content as Buffer
4. Converts to UTF-8 string for return

**Error Handling:**
- File existence validation
- Download failure recovery
- Character encoding validation
- Comprehensive error logging

**Performance Features:**
- Streaming download for large files
- UTF-8 encoding preservation
- Efficient memory usage

#### `getDocumentMetadata(userId: string, documentId: string): Promise<StorageMetadata>`

Retrieves file metadata without downloading content (efficient for file info queries).

**Returns:**
```typescript
{
  contentType: string;
  size: number;
  timeCreated: string;
  updated: string;
  customMetadata: Record<string, string>;
}
```

### Content Updates

#### `updateDocument(userId: string, documentId: string, newContent: string, updateMetadata?: Partial<DocumentMetadata>): Promise<StorageFile>`

Updates existing document content with metadata preservation.

**Process Flow:**
1. Retrieves current document from Firestore for ownership validation
2. Merges provided metadata with existing metadata
3. Recalculates word count if not provided
4. Uploads updated content via `uploadDocument()`
5. Returns updated storage file information

**Metadata Merging:**
- Preserves original creation date and source type
- Updates modification timestamp
- Recalculates word count from new content
- Maintains custom metadata integrity

### URL Management

#### `getDownloadUrl(userId: string, documentId: string, expiresInMinutes: number = 60): Promise<string>`

Generates secure, time-limited download URLs for document access.

**Features:**
- **Configurable Expiry**: Default 60 minutes, customizable
- **Security**: Signed URLs prevent unauthorized access
- **Validation**: File existence check before URL generation
- **Error Handling**: Graceful fallback for URL generation failures

**Use Cases:**
- Direct file downloads
- Temporary sharing
- Client-side content access
- API response URLs

### Content Validation

#### `validateDocumentContent(content: string): boolean`

Validates document content before storage operations.

**Validation Rules:**
- **Non-Empty**: Content must not be empty or whitespace-only
- **Size Limit**: Maximum 100KB per document
- **Character Validation**: Ensures valid UTF-8 encoding

**Extensibility:**
- Placeholder for additional content validation
- Markdown syntax validation (future)
- Malicious content detection (future)
- Content policy enforcement (future)

### Deletion Operations

#### `deleteDocument(userId: string, documentId: string): Promise<void>`

Removes document from Firebase Storage with safety checks.

**Process:**
1. Constructs file path
2. Checks file existence (prevents errors on missing files)
3. Deletes file if present
4. Logs operation results

**Safety Features:**
- Existence check before deletion
- Graceful handling of missing files
- Comprehensive logging for audit trails

## Maintenance Operations

### Orphaned File Cleanup

#### `cleanupOrphanedFiles(userId: string, validDocumentIds: string[]): Promise<void>`

Utility method for cleaning up storage files that no longer have corresponding database records.

**Process:**
1. Lists all files in user's document storage
2. Extracts document IDs from file paths
3. Identifies files not in valid document ID list
4. Deletes orphaned files with logging

**Use Cases:**
- Scheduled maintenance tasks
- Database recovery operations
- Storage cost optimization
- Data integrity maintenance

## Utility Methods

### Word Counting
```typescript
private static countWords(content: string): number
```
Accurately counts words in text content with proper whitespace handling.

### Metadata Sanitization
```typescript
private static sanitizeMetadata(metadata: Record<string, any>): Record<string, string>
```
Ensures Firebase Storage metadata contains only string values (Firebase requirement).

### Date Conversion
```typescript
private static toDate(dateValue: Date | { toDate(): Date }): Date
```
Handles conversion between JavaScript Date objects and Firestore Timestamps.

## Environment Handling

### Development vs. Production

**Development/Emulator:**
- Uses public URLs for local testing
- Simplified authentication for development workflow
- Enhanced logging for debugging

**Production:**
- Generates signed URLs with proper expiration
- Full security model implementation
- Optimized caching and delivery

**Environment Detection:**
- Checks `FUNCTIONS_EMULATOR` and `NODE_ENV` environment variables
- Automatic behavior adaptation
- Fallback mechanisms for edge cases

## Error Handling Strategy

### Comprehensive Error Coverage
- **Storage API Errors**: Firebase Storage operation failures
- **Authentication Errors**: Invalid or expired credentials
- **Validation Errors**: Content validation failures
- **Network Errors**: Connectivity issues and timeouts
- **Permission Errors**: Access denied scenarios

### Error Message Design
- **User-Safe Messages**: No sensitive information exposed
- **Detailed Logging**: Full error context for debugging
- **Error Categorization**: Different handling for different error types
- **Recovery Suggestions**: Actionable error information where possible

### Error Examples
```typescript
// Content validation
"Document content cannot be empty"
"Document content exceeds maximum size of 100KB"

// Storage operations
"Failed to upload document: network timeout"
"Document not found in storage"

// Authentication
"Failed to generate download URL: insufficient permissions"
```

## Security Features

### Access Control
- **User Isolation**: Complete separation of user data
- **Path Validation**: Prevents directory traversal attacks
- **Signed URLs**: Time-limited access for enhanced security
- **Content Validation**: Prevents malicious content storage

### Data Protection
- **Encryption**: Firebase Storage encryption at rest and in transit
- **Access Logging**: Comprehensive audit trails
- **URL Expiration**: Automatic invalidation of access URLs
- **Content Sanitization**: Input validation and cleaning

## Performance Optimization

### Upload Optimization
- **Buffer Management**: Efficient memory usage for content conversion
- **Resumable Uploads**: Disabled for small files (<100KB) for speed
- **Validation**: CRC32C checksums for integrity verification
- **Compression**: Automatic compression for text content

### Download Optimization
- **Streaming**: Efficient handling of large documents
- **Caching**: HTTP caching headers for content delivery
- **CDN Integration**: Firebase Storage CDN for global distribution

### Storage Management
- **Path Optimization**: Hierarchical structure for efficient querying
- **Metadata Efficiency**: Minimal but complete metadata storage
- **Cleanup Automation**: Orphaned file detection and removal

## Integration Points

### Firestore Integration
- Cross-references document metadata for validation
- Ensures consistency between storage and database
- Supports transactional operations across systems

### Cloud Functions Integration
- Seamless integration with Firebase Functions runtime
- Proper error propagation to calling functions
- Consistent logging and monitoring

### Client SDK Compatibility
- Generated URLs work with Firebase Client SDKs
- Proper CORS configuration for web applications
- Mobile SDK compatibility for native applications

## Monitoring & Observability

### Logging Strategy
- **Operation Tracking**: Start, progress, and completion logging
- **Performance Metrics**: Upload/download speeds and file sizes
- **Error Analysis**: Detailed error context and stack traces
- **Usage Patterns**: Access frequency and user behavior

### Key Metrics
- Storage usage per user and overall
- Upload/download success rates
- Average file sizes and content lengths
- URL generation and access patterns
- Error rates by operation type

### Performance Monitoring
- Upload and download latencies
- Storage quota utilization
- CDN cache hit rates
- Bandwidth usage patterns

## Usage Examples

### Basic Document Upload
```typescript
const storageFile = await DocumentService.uploadDocument(
  "user-123",
  "doc-456",
  "# My Document\n\nThis is the content...",
  {
    title: "My Document",
    sourceType: DocumentSourceType.UPLOAD,
    wordCount: 156,
    createdAt: new Date(),
    updatedAt: new Date()
  }
);

console.log(`Document uploaded to: ${storageFile.path}`);
console.log(`Download URL: ${storageFile.downloadUrl}`);
```

### Content Retrieval
```typescript
const content = await DocumentService.getDocumentContent("user-123", "doc-456");
console.log(`Retrieved ${content.length} characters`);
```

### Secure URL Generation
```typescript
const downloadUrl = await DocumentService.getDownloadUrl("user-123", "doc-456", 120); // 2 hours
console.log(`Secure URL (expires in 2 hours): ${downloadUrl}`);
```

### Content Updates
```typescript
const updatedFile = await DocumentService.updateDocument(
  "user-123",
  "doc-456",
  "# Updated Document\n\nThis is the updated content...",
  { 
    title: "Updated Document Title",
    wordCount: 234 
  }
);
```

### Maintenance Operations
```typescript
// Cleanup orphaned files
const validDocIds = ["doc-456", "doc-789", "doc-101"];
await DocumentService.cleanupOrphanedFiles("user-123", validDocIds);
```

## Best Practices

### For Developers
- Always validate content before storage operations
- Use appropriate URL expiration times based on use case
- Implement proper error handling for all storage operations
- Monitor storage usage to prevent quota exceeded errors

### For Content Management
- Keep document content under 100KB for optimal performance
- Use meaningful metadata for better organization
- Implement regular cleanup routines for orphaned files
- Monitor and optimize storage costs

### For Security
- Never expose signed URLs in logs or client-side code
- Validate user permissions before generating URLs
- Implement proper content sanitization
- Monitor access patterns for unusual activity

### For Performance
- Cache frequently accessed content appropriately
- Use streaming for large file operations
- Implement proper retry logic for network operations
- Monitor and optimize upload/download performance

This service provides a robust, secure, and performant foundation for document content storage in the Code Insights AI platform, ensuring reliable document management while maintaining optimal performance and security standards.