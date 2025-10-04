# Text Prompt File Attachment Feature - Implementation Roadmap

## 📋 Feature Overview

Add file attachment capability to the Text Prompt form, allowing users to upload reference documents (.txt, .md) that provide context for AI-generated educational content.

### Key Requirements
- **Max Files**: 5 files per request
- **File Types**: `.txt`, `.md` (text/markdown)
- **Max Size**: 5MB per file
- **Max Context**: 200K tokens (~800K characters) total
- **Upload Strategy**: Client-side file reading (Option B)
- **Prompt Structure**: Full prompt engineering (Option C)
- **Character Limit**: 10,000 chars for user prompt only (files counted separately)

---

## 🎯 Implementation Phases

### **Phase 1: Type Definitions & Shared Types** 
**Estimated Time**: 1 hour

#### Tasks:
1. **Update shared types** (`libs/shared-types/src/index.ts`)
   - [ ] Add `IFileContent` interface
     ```typescript
     export interface IFileContent {
       filename: string;
       content: string;
       size: number;
       type: 'text/plain' | 'text/markdown';
     }
     ```
   
   - [ ] Update `GenerateFromPromptRequest` interface
     ```typescript
     export interface GenerateFromPromptRequest {
       prompt: string;
       files?: IFileContent[]; // Optional for backward compatibility
     }
     ```

2. **Create frontend type definitions**
   - [ ] Create `web/src/types/fileUpload.ts`
   - [ ] Define validation constants
   - [ ] Define error types

**Files to Create/Modify:**
- `libs/shared-types/src/index.ts`
- `web/src/types/fileUpload.ts`

---

### **Phase 2: Backend Implementation**
**Estimated Time**: 3-4 hours

#### Tasks:

1. **Update Gemini Service** (`functions/src/services/gemini/`)
   - [ ] Modify `generateDocumentFromPrompt()` to accept optional files
   - [ ] Implement prompt engineering structure (Option C)
   - [ ] Add token counting for combined content
   - [ ] Add validation for total context size

2. **Update Document Endpoint** (`functions/src/endpoints/documents.ts`)
   - [ ] Modify `generateFromPrompt` function (line 532-646)
   - [ ] Validate incoming file data
   - [ ] Pass files to GeminiService
   - [ ] Add error handling for context size limits
   - [ ] Update logging to include file metadata

3. **Create Prompt Builder** (`functions/src/services/gemini/prompt-builder/`)
   - [ ] Create `withContextFiles.ts` for Option C structure
   - [ ] Implement structured prompt template
   - [ ] Add reference document formatting
   - [ ] Add generation guidelines section

**Prompt Template Structure:**
```markdown
You are an expert educational content creator specializing in comprehensive learning materials. Use the provided reference documents to create detailed, accurate educational content.

=== REFERENCE DOCUMENTS ===

### Document 1: {filename}
{content}

### Document 2: {filename}
{content}

=== TASK ===
{user's prompt}

=== GENERATION GUIDELINES ===
- Synthesize information from all reference documents above
- Create comprehensive content with proper structure
- Include tables, diagrams (using mermaid/ASCII), and examples where appropriate
- Ensure accuracy by referencing the provided context
- Maintain educational tone with clear explanations
- Organize content with proper headings and sections
```

**Files to Create/Modify:**
- `functions/src/services/gemini/gemini.ts`
- `functions/src/services/gemini/prompt-builder/withContextFiles.ts`
- `functions/src/endpoints/documents.ts`

---

### **Phase 3: Redux State Management**
**Estimated Time**: 2 hours

#### Tasks:

1. **Update Redux Slice** (`web/src/store/slices/createDocumentPageSlice.ts`)
   - [ ] Add `attachedFiles` state array
   - [ ] Add `totalContextSize` state
   - [ ] Create actions:
     - `addFile(file: IAttachedFile)`
     - `removeFile(index: number)`
     - `clearFiles()`
     - `setContextSizeError(error: string | null)`
   - [ ] Add selectors:
     - `selectAttachedFiles`
     - `selectTotalContextSize`
     - `selectCanAttachMore`
     - `selectContextSizeError`

2. **Create Attached File Type**
   ```typescript
   interface IAttachedFile {
     id: string; // unique identifier
     file: File;
     filename: string;
     size: number;
     content: string; // read file content
     characterCount: number;
     status: 'reading' | 'ready' | 'error';
     error?: string;
   }
   ```

**Files to Modify:**
- `web/src/store/slices/createDocumentPageSlice.ts`

---

### **Phase 4: API Integration**
**Estimated Time**: 1-2 hours

#### Tasks:

1. **Update RTK Query Mutation** (`web/src/store/api/Documents.ts`)
   - [ ] Modify `generateFromPromptMutation` to accept files
   - [ ] Update request body structure
   - [ ] Add proper TypeScript types

**Files to Modify:**
- `web/src/store/api/Documents.ts`

---

### **Phase 5: Utility Functions**
**Estimated Time**: 2-3 hours

#### Tasks:

1. **Create File Upload Utils** (`web/src/utils/fileUploadUtils.ts`)
   - [ ] `validateFileType(file: File): boolean`
   - [ ] `validateFileSize(file: File, maxSize: number): boolean`
   - [ ] `readFileAsText(file: File): Promise<string>`
   - [ ] `calculateTokenCount(text: string): number` (rough estimate)
   - [ ] `formatFileSize(bytes: number): string`
   - [ ] `generateFileId(): string`

2. **Create Validation Constants**
   ```typescript
   export const FILE_UPLOAD_CONSTRAINTS = {
     MAX_FILES: 5,
     MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
     MAX_TOTAL_TOKENS: 200000, // ~800K characters
     ALLOWED_TYPES: ['.txt', '.md'],
     ALLOWED_MIME_TYPES: ['text/plain', 'text/markdown'],
   } as const;
   ```

**Files to Create:**
- `web/src/utils/fileUploadUtils.ts`
- `web/src/utils/fileUploadConstants.ts`

---

### **Phase 6: UI Components**
**Estimated Time**: 4-5 hours

#### Tasks:

1. **Create FileUploadZone Component**
   - [ ] Create `web/src/pages/CreateDocumentPage/CreateDocumentPageContainer/TextPromptForm/FileUploadZone/`
   - [ ] Implement drag & drop functionality
   - [ ] Add file input button
   - [ ] Show upload status
   - [ ] Create component files:
     - `FileUploadZone.tsx`
     - `IFileUploadZone.ts`
     - `FileUploadZone.styles.ts`
     - `index.ts`

2. **Create AttachedFilesList Component**
   - [ ] Create `web/src/pages/CreateDocumentPage/CreateDocumentPageContainer/TextPromptForm/AttachedFilesList/`
   - [ ] Display list of attached files
   - [ ] Show filename, size, status
   - [ ] Add remove button per file
   - [ ] Show total context size
   - [ ] Create component files:
     - `AttachedFilesList.tsx`
     - `IAttachedFilesList.ts`
     - `AttachedFilesList.styles.ts`
     - `index.ts`

3. **Create AttachedFileItem Component** (child of AttachedFilesList)
   - [ ] Create `web/src/pages/CreateDocumentPage/CreateDocumentPageContainer/TextPromptForm/AttachedFilesList/AttachedFileItem/`
   - [ ] Display individual file info
   - [ ] Remove button with icon
   - [ ] Status indicator (loading, ready, error)
   - [ ] Create component files:
     - `AttachedFileItem.tsx`
     - `IAttachedFileItem.ts`
     - `AttachedFileItem.styles.ts`
     - `index.ts`

**Component Structure:**
```
TextPromptForm/
├── FileUploadZone/
│   ├── index.ts
│   ├── FileUploadZone.tsx
│   ├── IFileUploadZone.ts
│   └── FileUploadZone.styles.ts
├── AttachedFilesList/
│   ├── index.ts
│   ├── AttachedFilesList.tsx
│   ├── IAttachedFilesList.ts
│   ├── AttachedFilesList.styles.ts
│   └── AttachedFileItem/
│       ├── index.ts
│       ├── AttachedFileItem.tsx
│       ├── IAttachedFileItem.ts
│       └── AttachedFileItem.styles.ts
├── TextPromptForm.tsx (modify)
├── ITextPromptForm.ts (modify)
└── TextPromptForm.styles.ts (modify)
```

**Files to Create:**
- `FileUploadZone/` - 4 files
- `AttachedFilesList/` - 4 files
- `AttachedFilesList/AttachedFileItem/` - 4 files

**Files to Modify:**
- `TextPromptForm.tsx`
- `ITextPromptForm.ts`
- `TextPromptForm.styles.ts`

---

### **Phase 7: Hook Updates**
**Estimated Time**: 2-3 hours

#### Tasks:

1. **Update Handlers Hook** (`web/src/pages/CreateDocumentPage/context/hooks/useCreateDocumentPageHandlers.ts`)
   - [ ] Add `handleFileSelect` - Process selected files
   - [ ] Add `handleFileRemove` - Remove file by index
   - [ ] Add `handleFileDrop` - Handle drag & drop
   - [ ] Update `handleCreateFromTextPrompt` to include files
   - [ ] Add validation logic for:
     - File type
     - File size
     - Total context size
     - Max files limit

2. **Create File Upload Hook** (`web/src/pages/CreateDocumentPage/context/hooks/useFileUpload.ts`)
   - [ ] Encapsulate file reading logic
   - [ ] Handle file validation
   - [ ] Track upload progress
   - [ ] Calculate token counts
   - [ ] Return file operations

**New Hook Structure:**
```typescript
export const useFileUpload = () => {
  const dispatch = useDispatch();
  const attachedFiles = useSelector(selectAttachedFiles);
  
  const handleFileAdd = async (files: FileList) => {
    // Read files, validate, dispatch to Redux
  };
  
  const handleFileRemove = (fileId: string) => {
    // Remove from Redux state
  };
  
  const calculateTotalTokens = () => {
    // Estimate total token count
  };
  
  return {
    attachedFiles,
    handleFileAdd,
    handleFileRemove,
    totalTokens: calculateTotalTokens(),
    canAttachMore: attachedFiles.length < MAX_FILES,
  };
};
```

**Files to Create:**
- `web/src/pages/CreateDocumentPage/context/hooks/useFileUpload.ts`

**Files to Modify:**
- `web/src/pages/CreateDocumentPage/context/hooks/useCreateDocumentPageHandlers.ts`

---

### **Phase 8: Form Integration**
**Estimated Time**: 2 hours

#### Tasks:

1. **Update TextPromptForm Component**
   - [ ] Import FileUploadZone and AttachedFilesList
   - [ ] Position FileUploadZone above textarea
   - [ ] Display AttachedFilesList when files present
   - [ ] Update form submission to include files
   - [ ] Add context size warning/error display
   - [ ] Update validation to check total context
   - [ ] Disable submit if context exceeds limit

2. **Update Form Props Interface**
   ```typescript
   interface ITextPromptFormProps {
     isLoading: boolean;
     progress?: number;
     onSubmit: (data: ITextPromptFormData) => void;
     attachedFiles: IAttachedFile[];
     onFileAdd: (files: FileList) => void;
     onFileRemove: (fileId: string) => void;
     totalContextSize: number;
     contextSizeError: string | null;
   }
   ```

**Layout Structure:**
```
TextPromptForm
├── FileUploadZone (if can attach more)
├── AttachedFilesList (if files present)
├── Textarea (prompt input)
├── Character counter
├── Progress bar (if loading)
└── Submit button
```

**Files to Modify:**
- `web/src/pages/CreateDocumentPage/CreateDocumentPageContainer/TextPromptForm/TextPromptForm.tsx`
- `web/src/pages/CreateDocumentPage/CreateDocumentPageContainer/TextPromptForm/ITextPromptForm.ts`

---

### **Phase 9: Error Handling & Validation**
**Estimated Time**: 2 hours

#### Tasks:

1. **Client-Side Validation**
   - [ ] File type validation (only .txt, .md)
   - [ ] File size validation (max 5MB per file)
   - [ ] Max files validation (max 5 files)
   - [ ] Total context size validation (max 200K tokens)
   - [ ] File read error handling

2. **Error Messages**
   - [ ] Create error message constants
   - [ ] Display inline errors in UI
   - [ ] Show toast notifications for critical errors
   - [ ] Add helpful error recovery suggestions

3. **Server-Side Validation**
   - [ ] Validate request structure
   - [ ] Validate file content is present
   - [ ] Validate total context size
   - [ ] Return meaningful error messages

**Error Message Examples:**
```typescript
const ERROR_MESSAGES = {
  INVALID_FILE_TYPE: 'Only .txt and .md files are supported',
  FILE_TOO_LARGE: 'File size cannot exceed 5MB',
  MAX_FILES_REACHED: 'You can attach up to 5 files',
  CONTEXT_TOO_LARGE: 'Total context size exceeds 200K tokens. Please remove some files.',
  FILE_READ_ERROR: 'Failed to read file. Please try again.',
};
```

**Files to Create:**
- `web/src/utils/fileUploadErrors.ts`

---

### **Phase 10: Styling & UI Polish**
**Estimated Time**: 2-3 hours

#### Tasks:

1. **FileUploadZone Styling**
   - [ ] Drag & drop visual feedback
   - [ ] Hover states
   - [ ] Active/dragging states
   - [ ] Disabled state (when max files reached)
   - [ ] Upload icon and instructions

2. **AttachedFilesList Styling**
   - [ ] File list container
   - [ ] File item card styling
   - [ ] Remove button hover effects
   - [ ] Status indicators (loading spinner, checkmark, error)
   - [ ] Context size meter/progress bar

3. **Responsive Design**
   - [ ] Mobile layout adjustments
   - [ ] Tablet optimizations
   - [ ] Desktop enhancements

4. **Accessibility**
   - [ ] ARIA labels for file upload
   - [ ] Keyboard navigation
   - [ ] Screen reader support
   - [ ] Focus management

**Style Classes to Create:**
```typescript
export const fileUploadZoneStyles = {
  container: "border-2 border-dashed border-input rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors",
  dragging: "border-primary bg-primary/5",
  disabled: "opacity-50 cursor-not-allowed",
  icon: "w-12 h-12 mx-auto mb-4 text-muted-foreground",
  text: "text-sm text-muted-foreground",
};

export const attachedFilesListStyles = {
  container: "space-y-3 mb-4",
  fileItem: "flex items-center justify-between p-3 border rounded-lg bg-card",
  fileInfo: "flex-1 flex items-center gap-3",
  fileName: "text-sm font-medium",
  fileSize: "text-xs text-muted-foreground",
  removeButton: "text-destructive hover:bg-destructive/10 rounded p-1",
  contextMeter: "mt-2 p-2 border rounded bg-muted/20",
};
```

---

### **Phase 11: Testing**
**Estimated Time**: 3-4 hours

#### Tasks:

1. **Unit Tests**
   - [ ] Test file validation functions
   - [ ] Test token counting logic
   - [ ] Test Redux actions and selectors
   - [ ] Test utility functions

2. **Component Tests**
   - [ ] Test FileUploadZone interactions
   - [ ] Test AttachedFilesList rendering
   - [ ] Test file removal
   - [ ] Test drag & drop functionality

3. **Integration Tests**
   - [ ] Test complete file upload flow
   - [ ] Test form submission with files
   - [ ] Test error scenarios
   - [ ] Test backend integration

4. **Manual Testing Scenarios**
   - [ ] Upload 1 file, generate document
   - [ ] Upload 5 files (max), generate document
   - [ ] Try uploading 6th file (should fail)
   - [ ] Upload file > 5MB (should fail)
   - [ ] Upload invalid file type (should fail)
   - [ ] Remove files and re-add
   - [ ] Drag & drop multiple files
   - [ ] Test with large files (approaching context limit)
   - [ ] Test with empty files
   - [ ] Test with special characters in filenames
   - [ ] Test form submission failure (files retained)
   - [ ] Test mobile responsiveness

**Test Files to Create:**
- `web/src/utils/fileUploadUtils.test.ts`
- `web/src/pages/CreateDocumentPage/CreateDocumentPageContainer/TextPromptForm/FileUploadZone/FileUploadZone.test.tsx`

---

### **Phase 12: Documentation & Deployment**
**Estimated Time**: 1-2 hours

#### Tasks:

1. **Code Documentation**
   - [ ] Add JSDoc comments to utility functions
   - [ ] Document complex logic
   - [ ] Add inline comments for prompt structure

2. **User Documentation**
   - [ ] Add tooltips/help text in UI
   - [ ] Create usage guide (if needed)
   - [ ] Update README with new feature

3. **Backend Deployment**
   - [ ] Deploy updated Firebase Functions
   - [ ] Test in production environment
   - [ ] Monitor logs for errors

4. **Frontend Deployment**
   - [ ] Build production bundle
   - [ ] Deploy to hosting
   - [ ] Verify feature works in production

---

## 📊 Implementation Summary

### Total Estimated Time: **28-35 hours**

### Phase Breakdown:
| Phase | Description | Time | Priority |
|-------|-------------|------|----------|
| 1 | Type Definitions | 1h | Critical |
| 2 | Backend Implementation | 3-4h | Critical |
| 3 | Redux State | 2h | Critical |
| 4 | API Integration | 1-2h | Critical |
| 5 | Utility Functions | 2-3h | Critical |
| 6 | UI Components | 4-5h | Critical |
| 7 | Hook Updates | 2-3h | Critical |
| 8 | Form Integration | 2h | Critical |
| 9 | Error Handling | 2h | High |
| 10 | Styling & Polish | 2-3h | High |
| 11 | Testing | 3-4h | High |
| 12 | Documentation | 1-2h | Medium |

---

## 🚀 Development Order (Recommended)

### Sprint 1: Core Functionality (Days 1-2)
1. Phase 1: Type Definitions
2. Phase 5: Utility Functions
3. Phase 3: Redux State
4. Phase 2: Backend Implementation
5. Phase 4: API Integration

### Sprint 2: UI Implementation (Days 3-4)
6. Phase 6: UI Components
7. Phase 7: Hook Updates
8. Phase 8: Form Integration
9. Phase 9: Error Handling

### Sprint 3: Polish & Testing (Day 5)
10. Phase 10: Styling & UI Polish
11. Phase 11: Testing
12. Phase 12: Documentation & Deployment

---

## 🎯 Success Criteria

### Functional Requirements
- ✅ Users can attach up to 5 text/markdown files
- ✅ Files are validated for type and size
- ✅ Total context size is monitored and enforced
- ✅ Drag & drop works smoothly
- ✅ Files are retained on submission failure
- ✅ Generated documents use file context intelligently

### Non-Functional Requirements
- ✅ File reading is fast (<1s for typical files)
- ✅ UI is responsive and intuitive
- ✅ Error messages are clear and actionable
- ✅ Feature works on mobile devices
- ✅ Backward compatible (works without files)

---

## 🔧 Technical Debt & Future Enhancements

### Known Limitations
- Token counting is estimated (not exact Gemini tokenization)
- Files are read client-side (memory constraints for very large files)
- No file content preview

### Future Improvements (Post-MVP)
- [ ] Add support for PDF files
- [ ] Implement exact token counting via API
- [ ] Add file content search/preview
- [ ] Support for images as context
- [ ] Batch file processing for very large contexts
- [ ] File compression for network optimization
- [ ] Save file attachments with document metadata
- [ ] Template system for common document types

---

## 📝 Notes

### Important Considerations
1. **Token Counting**: We use rough estimation (1 token ≈ 4 characters). This may not be 100% accurate but provides good UX feedback.

2. **File Reading**: All files are read into memory on client side. For very large files (approaching 5MB), this may cause brief UI lag.

3. **Context Size**: 200K token limit leaves plenty of room for Gemini's response (we have 1M total input + 8K output).

4. **Backward Compatibility**: The `files` parameter is optional in backend, so existing functionality continues to work.

5. **Error Recovery**: If file reading fails partially, we allow retry or removal of problematic files rather than blocking entire form.

### Prompt Engineering Notes
- The Option C prompt structure is optimized for educational content generation
- Guidelines section can be customized per use case in future
- Reference document formatting helps model distinguish between multiple sources
- Clear task separation improves output quality

---

## 📚 References

- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Gemini Token Limits](https://ai.google.dev/gemini-api/docs/tokens)
- [React File Upload Best Practices](https://web.dev/file-handling/)
- [shadcn/ui Components](https://ui.shadcn.com/)

---

**Last Updated**: 2025-10-04
**Status**: 📋 Planning
**Owner**: Development Team
**Priority**: High

