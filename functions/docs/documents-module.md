# Documents Module Documentation

## Overview

The `documents.ts` module provides Firebase Cloud Functions endpoints for managing document CRUD operations in the Code Insights AI application. This module handles document creation, retrieval, updates, deletion, and AI-powered document generation from prompts.

## Module Structure

### Dependencies

- **Firebase Functions**: `onCall` for callable functions, `logger` for logging, `defineSecret` for secret management
- **Services**: 
  - `DocumentCrudService`: Core document operations
  - `WebScraperService`: URL content extraction
  - `GeminiService`: AI document generation
  - `promptBuilder`: Rule injection for prompts
- **Shared Types**: Type definitions from `@shared-types` package

### Configuration

- **Region**: `asia-east1` for all functions
- **CORS**: Enabled for cross-origin requests
- **Secrets**: `GEMINI_API_KEY` for AI functionality
- **Timeouts**: Extended to 540 seconds (9 minutes) for document generation

## Authentication

All functions use a centralized authentication middleware:

```typescript
async function validateAuth(context: { auth?: { uid?: string } }): Promise<string>
```

- Validates user authentication via Firebase Auth
- Returns the authenticated user's UID
- Throws error if user is not authenticated

## Function Endpoints

### 1. `createDocument`

Creates a new document from uploaded content.

**Parameters:**
- `sourceType`: Document source type (required)
- `title`: Document title (required)
- `content`: Document content (required)
- `description`: Optional description
- `directoryId`: Optional directory assignment
- `tags`: Optional tags array

**Returns:**
- `success`: Boolean status
- `document`: Created document object

**Validation:**
- Validates source type against `DocumentSourceType` enum
- Ensures title and content are non-empty
- Logs creation details for monitoring

### 2. `createDocumentFromUrl`

Scrapes web content and creates a document with markdown conversion.

**Parameters:**
- `url`: Target URL to scrape (required)
- `title`: Optional custom title (uses scraped title if not provided)
- `directoryId`: Optional directory assignment
- `ruleIds`: Optional rule injection for content processing

**Process:**
1. Validates URL format using `WebScraperService.isValidUrl()`
2. Scrapes content with `WebScraperService.extractContentAsMarkdown()`
3. Validates markdown formatting quality
4. Creates document with scraped content
5. Returns document with scraping metadata

**Returns:**
- `success`: Boolean status
- `document`: Created document object
- `scrapedContent`: Metadata about scraped content (title, author, publish date, word count)

**Error Handling:**
- URL validation
- Empty markdown content detection
- Plain text vs. formatted markdown warnings

### 3. `getDocument`

Retrieves document metadata by ID.

**Parameters:**
- `documentId`: Document identifier (required)

**Validation:**
- Checks for valid, non-empty document ID
- Handles "undefined" string edge case

**Returns:**
- `success`: Boolean status
- `document`: Document metadata object

### 4. `getDocumentWithContent`

Retrieves complete document including content from storage.

**Parameters:**
- `documentId`: Document identifier (required)

**Returns:**
- `success`: Boolean status
- `document`: Complete document object with content

### 5. `updateDocument`

Updates existing document properties.

**Parameters:**
- `documentId`: Document identifier (required)
- `updates`: Update object with fields to modify

**Supported Updates:**
- `title`: Document title
- `description`: Document description
- `content`: Document content
- `tags`: Document tags
- `status`: Document status

**Returns:**
- `success`: Boolean status
- `document`: Updated document object

### 6. `deleteDocument`

Permanently removes a document.

**Parameters:**
- `documentId`: Document identifier (required)

**Returns:**
- `success`: Boolean status
- `message`: Confirmation message

### 7. `getUserDocuments` / `listDocuments`

Lists documents for the authenticated user with optional filtering.

**Parameters (optional):**
- `limit`: Maximum number of documents to return
- `sourceType`: Filter by document source type
- `status`: Filter by document status

**Returns:**
- `success`: Boolean status
- `documents`: Array of document objects
- Additional pagination metadata

### 8. `searchDocuments`

Searches documents by text content.

**Parameters:**
- `searchTerm`: Search query string (required)
- `limit`: Optional result limit
- `sourceType`: Optional source type filter
- `status`: Optional status filter

**Validation:**
- Ensures search term is non-empty
- Trims whitespace

**Returns:**
- `success`: Boolean status
- `documents`: Array of matching documents
- `searchTerm`: Echo of search query

### 9. `getDocumentStats`

Retrieves document statistics for the user.

**Returns:**
- `success`: Boolean status
- `stats`: Statistics object with counts and metrics

### 10. `getDocumentContent`

Retrieves only the content portion of a document (for rendering).

**Parameters:**
- `documentId`: Document identifier (required)

**Returns:**
- `success`: Boolean status
- `content`: Document content string

### 11. `generateFromPrompt`

AI-powered document generation using Gemini AI.

**Parameters:**
- `prompt`: Text prompt for generation (required, 10-10,000 characters)
- `files`: Optional context files (max 5 files, 5MB each)
  - Supports `text/plain` and `text/markdown` types
  - Can include uploaded files or library documents
- `ruleIds`: Optional rule injection for prompt enhancement
- `directoryId`: Optional directory assignment

**File Validation:**
- Maximum 5 files
- 5MB size limit per file
- Supported types: `text/plain`, `text/markdown`
- Non-empty content validation
- Source tracking (upload vs. library)

**Process:**
1. Validates prompt length and content
2. Validates attached files (if provided)
3. Injects rules into prompt (if specified)
4. Calls Gemini AI for content generation
5. Extracts title from generated H1 heading
6. Creates document with generated content
7. Calculates word count and metadata

**Returns:**
- `success`: Boolean status
- `documentId`: Created document ID
- `title`: Extracted/generated title
- `content`: Generated markdown content
- `wordCount`: Content word count
- `metadata`: Generation metadata (prompt, timestamp, files used)

**Quality Checks:**
- Minimum 1000 word recommendation (warning, not error)
- Title extraction from H1 headings
- Fallback title generation from prompt

## Error Handling

### Consistent Error Pattern
All functions follow a consistent error handling pattern:

1. **Validation Errors**: Thrown immediately with descriptive messages
2. **Service Errors**: Caught and re-thrown with context
3. **Logging**: All errors logged with relevant context
4. **User-Friendly Messages**: Error messages safe for client consumption

### Common Error Types
- **Authentication**: "Unauthenticated: User must be logged in"
- **Validation**: Field-specific validation messages
- **Not Found**: Document or resource not found
- **Permission**: Insufficient permissions for operation
- **External Service**: Scraping or AI service failures

## Logging Strategy

### Log Levels
- **Info**: Successful operations, key metrics
- **Warn**: Non-critical issues (e.g., plain text markdown)
- **Error**: Operation failures with full context

### Logged Information
- User ID for all operations
- Document IDs and titles
- Content lengths and word counts
- Processing times for complex operations
- External service call details
- Error context and stack traces

## Performance Considerations

### Timeouts
- Standard functions: Default Firebase timeout
- `generateFromPrompt`: Extended to 540 seconds (9 minutes)

### Content Limits
- Prompt: 10,000 character maximum
- Files: 5MB per file, 5 files maximum
- Generated content: Minimum 1000 words recommended

### Caching
- Document metadata cached at service level
- Content stored separately for efficient retrieval

## Security Features

### Authentication
- All endpoints require Firebase authentication
- User-scoped data access (documents belong to users)

### Input Validation
- Strict type checking on all parameters
- Content size limits to prevent abuse
- URL validation for scraping endpoints
- File type restrictions for uploads

### Data Isolation
- User data is completely isolated
- No cross-user data access possible
- Document ownership validated on all operations

## Integration Points

### External Services
- **Web Scraper**: Content extraction and markdown conversion
- **Gemini AI**: Document generation from prompts
- **Firebase Storage**: Large content storage
- **Firestore**: Document metadata and relationships

### Internal Services
- **DocumentCrudService**: Core CRUD operations
- **promptBuilder**: Rule injection and enhancement
- **Authentication**: User validation and authorization

## Usage Examples

### Creating a Document
```typescript
// Direct content upload
const result = await createDocument({
  title: "My Article",
  content: "# Article Content\n\nThis is my article...",
  sourceType: "UPLOAD",
  tags: ["personal", "draft"]
});
```

### Scraping from URL
```typescript
// URL scraping with custom title
const result = await createDocumentFromUrl({
  url: "https://example.com/article",
  title: "Custom Title",
  directoryId: "folder-123",
  ruleIds: ["rule-1", "rule-2"]
});
```

### AI Generation
```typescript
// Generate document with context files
const result = await generateFromPrompt({
  prompt: "Write a comprehensive guide about TypeScript best practices",
  files: [
    {
      filename: "context.md",
      content: "TypeScript context...",
      type: "text/markdown",
      size: 2048,
      source: "upload"
    }
  ],
  ruleIds: ["writing-style", "technical-depth"],
  directoryId: "ai-generated"
});
```

## Monitoring and Analytics

### Key Metrics
- Document creation rate by source type
- Scraping success/failure rates
- AI generation performance and word counts
- User engagement with different document types
- Error rates and common failure patterns

### Performance Monitoring
- Function execution times
- Memory usage for large documents
- External service response times
- Storage usage patterns

This module serves as the primary interface for all document-related operations in the Code Insights AI platform, providing robust CRUD functionality, web content integration, and AI-powered document generation capabilities.