# Code Insights AI - App Reorganization Requirements

## 📋 Project Overview

Transform the current URL-based quiz generator into a comprehensive document-centric application that supports both URL scraping and file uploads, with a focus on document management and viewing before quiz creation.

## 🎯 Current State vs. Target State

### Current Flow
```
URL Input → Web Scraping → AI Quiz Generation → Quiz Taking
```

### Target Flow
```
Source Selection (URL/Upload) → Document Processing → Document Library → Document Viewer → Quiz Generation → Quiz Taking
```

## 📚 Core Requirements

### 1. Document Storage & Management
- **Storage Backend**: Firebase Storage for markdown files
- **Document Library**: Users can browse all their saved documents
- **No Version Control**: Single version per document (overwrite on re-upload)
- **User Isolation**: Each user sees only their own documents

### 2. File Upload System
- **Supported Formats**: Markdown (.md) files only
- **File Size Limit**: 100KB maximum (consideration for Gemini processing limits)
- **Upload Mode**: Single file upload only
- **Validation**: File format and size validation before upload

### 3. Document Viewing Experience
- **Rendering**: Simple markdown-to-HTML rendering
- **Editing**: No editing capabilities (read-only)
- **Reading Mode**: Full-screen/preview mode for comfortable reading
- **Metadata Display**: Word count, reading time, source information

### 4. Content Conversion & Processing

#### URL Scraping to Markdown
- **Output Format**: Clean, structured markdown
- **Content Focus**: Text content only (no images, videos, or other media)
- **Formatting**: Use ASCII formatting for tables and special content
- **AI Enhancement**: Use Gemini AI for content structure optimization

#### File Upload Processing
- **Direct Storage**: Store uploaded markdown files directly in Firebase Storage
- **Metadata Extraction**: Calculate word count, reading time, file size
- **Content Validation**: Ensure content is suitable for quiz generation

### 5. User Workflow

#### Document Creation Workflow
1. **Navigation**: Access via sidebar "Content → Create Document" or Home page quick action
2. **Method Selection**: Choose between URL scraping or file upload using tabs
3. **Content Processing**: 
   - URL: Scrape → Convert to markdown → Store in Firebase Storage
   - Upload: Validate → Store in Firebase Storage
4. **Redirect to Library**: After successful creation, redirect to Documents Library
5. **Document Viewing**: Browse library and select document to view
6. **Quiz Generation**: Separate action from Document Viewer page

#### User Navigation Flow
```
Entry Points:
├── Sidebar: Content → Create Document
├── Home: Quick Action "Create Document"
└── Documents Library: "Add New" button

Create Document Page (/documents/create):
├── [🌐 From URL Tab]     [📤 Upload File Tab]
├── Tab Content Area (URL input OR file upload interface)
├── Processing/Validation
└── Redirect to Documents Library on success

Document Management:
├── Documents Library (/documents) - Browse, search, manage
├── Document Viewer (/document/:id) - Read with metadata
└── Quiz Creation from Document Viewer
```

#### Quiz Generation Workflow
- **Multiple Quizzes**: Users can create multiple quizzes from the same document
- **Document Linking**: Each quiz references its source document ID
- **Separate Action**: Clear "Create Quiz" button in Document Viewer
- **Quiz Management**: All quizzes accessible via "Quizzes → My Quizzes" in sidebar

#### Route Structure
```
/ - Home/Dashboard page
/documents/create - Create Document page (with tabs)
/documents - Documents Library page
/document/:id - Document Viewer page
/quizzes - My Quizzes page
/quizzes/results - Quiz Results page
/quiz/:id - Take Quiz page (existing)
/profile - User Profile page
/settings - Settings page
```

### 6. UI/UX Architecture

#### Navigation Structure
```
Left Sidebar Menu:
├── 🏠 Home
│   └── Overview (Dashboard)
├── 📚 Content
│   ├── Documents Library
│   └── Create Document (Single page with tabs)
├── 🧠 Quizzes
│   ├── My Quizzes
│   └── Results
└── 👤 Account
    ├── Profile
    └── Settings

Page Structure:
├── Home Page (Overview/Dashboard)
├── Create Document Page (Tabbed Interface)
│   ├── URL Scraping Tab
│   └── File Upload Tab
├── Documents Library Page
│   ├── Document List/Grid
│   ├── Search/Filter
│   └── Document Actions
└── Document Viewer Page
    ├── Markdown Renderer
    ├── Metadata Panel
    ├── Reading Mode Toggle
    └── Quiz Generation Button
```

#### Sidebar Menu Organization
- **Single Entry Point**: "Create Document" opens a page with URL/Upload tabs
- **No Navigation Conflicts**: Eliminates redundant sidebar items for URL/Upload
- **Clean Categorization**: Content management, Quiz management, Account settings
- **Intuitive Flow**: Content → Create/Browse → View → Generate Quiz

#### Home Page (Dashboard)
- **Quick Action Cards**: Direct links to Create Document, Documents Library, My Quizzes
- **Recent Activity**: Recently created documents and quizzes
- **Statistics Overview**: Document count, quiz count, activity metrics

#### Documents Library Page
- **Document Grid/List**: Thumbnail/preview view of documents
- **Metadata Display**: Title, source, word count, creation date
- **Actions**: View, Create Quiz, Delete
- **Search/Filter**: Basic search by title and content

#### Document Viewer Page
- **Clean Layout**: Focus on reading experience
- **Metadata Sidebar**: Document information and statistics
- **Reading Modes**: Normal and full-screen reading modes
- **Quiz Actions**: Prominent "Create Quiz" button
- **Navigation**: Back to library, previous/next document

### 7. Data Model Requirements

#### New Document Entity
```typescript
interface Document {
  id: string;
  title: string;
  content: string; // Markdown content
  sourceType: 'url' | 'upload';
  sourceUrl?: string; // For URL-sourced documents
  fileName?: string; // For uploaded documents
  fileSize: number; // In bytes
  wordCount: number;
  readingTime: number; // In minutes
  createdAt: Date;
  userId?: string;
  storageUrl: string; // Firebase Storage URL
}
```

#### Updated Quiz Entity
```typescript
interface Quiz {
  id: string;
  documentId: string; // Reference to source document
  title: string;
  questions: QuizQuestion[];
  createdAt: Date;
  userId?: string;
}
```

#### Document-Quiz Relationships
- **One-to-Many**: One document can have multiple quizzes
- **Reference Tracking**: Each quiz stores its source document ID
- **Cascade Display**: Show related quizzes when viewing documents

### 8. Technical Implementation Requirements

#### Firebase Storage Setup
- **Security Rules**: User-specific access controls
- **File Organization**: Organized by user ID and document ID
- **URL Generation**: Secure, time-limited download URLs for content access

#### API Endpoints (Firebase Functions)
```
// New Endpoints
POST /uploadDocument - Upload and process markdown file
GET /getDocument - Retrieve document by ID
GET /getUserDocuments - List user's documents
DELETE /deleteDocument - Remove document and associated quizzes

// Modified Endpoints
POST /generateQuiz - Now accepts documentId instead of URL
POST /scrapeToDocument - New endpoint for URL → Document creation
```

#### Backend Services Updates
- **Document Service**: Handle document CRUD operations
- **Scraper Service**: Modified to output clean markdown
- **Gemini Service**: Enhanced for markdown structure optimization
- **Storage Service**: Firebase Storage integration

#### Frontend Components
```
// New Components
DocumentCreatePage/ - Main page with tabbed interface
  ├── DocumentCreateTabs/ - URL vs Upload tab switcher
  ├── UrlScrapingForm/ - URL input and scraping interface
  └── FileUploadForm/ - File upload and validation interface

DocumentLibrary/ - Browse and manage documents
  ├── DocumentGrid/ - Grid/list view of documents
  ├── DocumentCard/ - Individual document preview
  └── DocumentActions/ - View, Create Quiz, Delete actions

DocumentViewer/ - Read document and create quizzes
  ├── MarkdownRenderer/ - Display markdown content
  ├── DocumentMetadata/ - Show document stats and info
  ├── ReadingModeToggle/ - Full-screen reading mode
  └── QuizCreationButton/ - Generate quiz from document

// Modified Components
HomePage/ - Dashboard with quick actions and overview
QuizPage/ - Updated to work with document references
Sidebar/ - Updated menu structure with Content section
```

### 9. Content Processing Specifications

#### Markdown Conversion Standards
- **Headers**: Preserve H1-H6 structure
- **Lists**: Convert to markdown lists (ordered/unordered)
- **Tables**: ASCII table format or simple markdown tables
- **Code**: Preserve code blocks with language specification
- **Links**: Convert to markdown link format `[text](url)`
- **Emphasis**: Bold (**) and italic (*) formatting

#### Content Quality Standards
- **Minimum Length**: 20 words (error threshold)
- **Optimal Length**: 50+ words for quality quiz generation
- **Structure**: Clear paragraphs and logical content flow
- **Readability**: Clean formatting without HTML artifacts

### 10. Security & Privacy Requirements

#### Data Access Controls
- **User Isolation**: Users can only access their own documents and quizzes
- **Firebase Rules**: Strict security rules for Storage and Firestore
- **Authentication**: All document operations require authentication

#### Content Security
- **File Validation**: Strict markdown file type and size validation
- **Content Sanitization**: Remove any potentially harmful content
- **Storage Security**: Encrypted storage with secure access patterns

### 11. Performance Requirements

#### File Processing
- **Upload Speed**: Efficient file processing and storage
- **Markdown Rendering**: Fast client-side markdown-to-HTML conversion
- **Storage Access**: Optimized Firebase Storage access patterns

#### UI Performance
- **Library Loading**: Paginated/virtualized document lists
- **Viewer Performance**: Smooth scrolling and responsive rendering
- **Navigation**: Fast transitions between documents and quizzes

### 12. Future Considerations

#### Potential Enhancements (Not in Scope)
- Multiple file format support (PDF, DOCX, TXT)
- Document sharing and collaboration
- Version control for documents
- Advanced search with full-text indexing
- Document categories and tagging
- Bulk operations for documents

#### Scalability Considerations
- **Storage Limits**: Monitor Firebase Storage usage
- **Content Size**: Consider pagination for large documents
- **User Growth**: Scalable architecture for multiple users

## 🚀 Implementation Priority

### Phase 1: Core Document Management
1. Document data models and Firebase Storage setup
2. Create Document page with tabbed interface (URL/Upload)
3. Basic document library and viewer components
4. Modified scraper service for markdown output
5. Updated sidebar navigation structure

### Phase 2: Enhanced UI/UX
1. Enhanced Documents Library with search and filtering
2. Improved Document Viewer with reading modes and metadata
3. Integrated quiz generation workflow from documents
4. Home page dashboard with quick actions

### Phase 3: Polish & Optimization
1. Performance optimizations for document loading and rendering
2. Comprehensive error handling and user feedback
3. Security hardening for file uploads and storage
4. End-to-end testing of complete document-to-quiz workflow

## 📝 Success Criteria

- Users can upload markdown files and scrape URLs to create documents
- All documents are stored as clean markdown in Firebase Storage
- Users can browse their document library efficiently
- Document viewing provides a comfortable reading experience
- Quiz generation from documents works seamlessly
- Multiple quizzes can be created from the same document
- All user data is properly isolated and secured

This reorganization will transform the app from a simple URL-to-quiz tool into a comprehensive document management and quiz generation platform, providing users with better content organization and a more intuitive workflow.
