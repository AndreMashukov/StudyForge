# Document Library Selection Feature - Implementation Roadmap

## 📋 Feature Overview

Add document library selection capability to the Text Prompt form, allowing users to select existing documents from their library as context alongside uploaded files.

### Key Requirements
- **Tab Interface**: Upload Files | Library Documents (with icons)
- **Max Items**: 5 total (uploaded + library combined)
- **Max Context**: 200K tokens total
- **Auto-add**: Documents added immediately on checkbox selection
- **Visual**: Different icon and color for library documents
- **Content Fetching**: Frontend fetches content, backend validates ownership

---

## 🎯 Implementation Phases

### **Phase 1: Type Definitions & Interface Updates**
**Estimated Time**: 1-2 hours

#### Tasks:

1. **Update IAttachedFile interface** (`web/src/types/fileUpload.ts`)
   - [ ] Add `source: 'upload' | 'library'` field
   - [ ] Add `documentId?: string` field for library documents
   - [ ] Keep file optional (`file?: File`) for library docs
   
   ```typescript
   export interface IAttachedFile {
     id: string;
     file?: File; // Optional for library docs
     filename: string;
     size: number;
     content: string;
     characterCount: number;
     estimatedTokens: number;
     status: 'reading' | 'ready' | 'error';
     error?: string;
     source: 'upload' | 'library'; // NEW
     documentId?: string; // NEW - for library docs
   }
   ```

2. **Update API types** (`libs/shared-types/src/index.ts`)
   - [ ] Extend `IFileContent` with optional `documentId`
   - [ ] Add `source` field for backend logging/validation
   
   ```typescript
   export interface IFileContent {
     filename: string;
     content: string;
     size: number;
     type: 'text/plain' | 'text/markdown';
     source?: 'upload' | 'library'; // Optional for backend
     documentId?: string; // For ownership validation
   }
   ```

3. **Create document selector types** (`web/src/types/documentSelector.ts`)
   - [ ] Define `IDocumentSelectorItem` interface
   - [ ] Define selection state types
   
   ```typescript
   export interface IDocumentSelectorItem {
     id: string;
     title: string;
     wordCount: number;
     isSelected: boolean;
   }
   ```

**Files to Create/Modify:**
- `web/src/types/fileUpload.ts` (modify)
- `web/src/types/documentSelector.ts` (create)
- `libs/shared-types/src/index.ts` (modify)

---

### **Phase 2: Redux State Updates**
**Estimated Time**: 1 hour

#### Tasks:

1. **Update createDocumentPageSlice** (`web/src/store/slices/createDocumentPageSlice.ts`)
   - [ ] Add `selectedDocumentIds` array to track library selections
   - [ ] Add `documentSelectorLoading` state
   - [ ] Update `addFile` action to handle library documents
   - [ ] Create `toggleDocumentSelection` action
   - [ ] Create selectors:
     - `selectSelectedDocumentIds`
     - `selectDocumentSelectorLoading`
     - `selectCanSelectMoreDocuments`

**State Structure:**
```typescript
textPromptForm: {
  isLoading: boolean;
  progress: number;
  attachedFiles: IAttachedFile[]; // Mixed upload + library
  totalContextSize: number;
  contextSizeError: string | null;
  selectedDocumentIds: string[]; // Track checkbox state
  documentSelectorLoading: boolean;
}
```

**Files to Modify:**
- `web/src/store/slices/createDocumentPageSlice.ts`

---

### **Phase 3: Utility Functions**
**Estimated Time**: 1-2 hours

#### Tasks:

1. **Create document fetch utilities** (`web/src/utils/documentSelectorUtils.ts`)
   - [ ] `fetchDocumentContent(documentId): Promise<string>` - Get content via API
   - [ ] `convertDocumentToAttachedFile(doc, content): IAttachedFile` - Convert format
   - [ ] `validateDocumentSize(wordCount): boolean` - Check if too large
   - [ ] `estimateDocumentTokens(content): number` - Token calculation

2. **Update fileUploadUtils** (`web/src/utils/fileUploadUtils.ts`)
   - [ ] Update `convertToFileContent()` to handle library documents
   - [ ] Ensure token calculation works for both sources

**New Utility Functions:**
```typescript
export async function fetchDocumentContent(documentId: string): Promise<string> {
  // Call getDocumentContent API
  // Return markdown content
}

export function convertDocumentToAttachedFile(
  document: DocumentEnhanced,
  content: string
): Omit<IAttachedFile, 'id'> {
  return {
    filename: `${document.title}.md`,
    size: content.length,
    content,
    characterCount: content.length,
    estimatedTokens: calculateTokenCount(content),
    status: 'ready',
    source: 'library',
    documentId: document.id,
  };
}

export function validateDocumentSize(wordCount: number): {
  isValid: boolean;
  warning?: string;
} {
  // Warn if document > 50K words
  // Error if would exceed token limit
}
```

**Files to Create/Modify:**
- `web/src/utils/documentSelectorUtils.ts` (create)
- `web/src/utils/fileUploadUtils.ts` (modify)

---

### **Phase 4: Components - Tab Interface**
**Estimated Time**: 2-3 hours

#### Tasks:

1. **Create SourceTabs Component** 
   - Location: `web/src/pages/CreateDocumentPage/CreateDocumentPageContainer/TextPromptForm/SourceTabs/`
   - [ ] Create tab navigation (Upload | Library)
   - [ ] Icons: Upload icon + "Upload Files", BookOpen icon + "Library"
   - [ ] Active tab indicator
   - [ ] Preserve selections across tab switches
   - [ ] Files:
     - `SourceTabs.tsx` - Main component
     - `ISourceTabs.ts` - Props interface
     - `SourceTabs.styles.ts` - Styles
     - `index.ts` - Exports

**Component Structure:**
```typescript
interface ISourceTabsProps {
  activeTab: 'upload' | 'library';
  onTabChange: (tab: 'upload' | 'library') => void;
  uploadCount: number;
  libraryCount: number;
}

export const SourceTabs = ({ 
  activeTab, 
  onTabChange,
  uploadCount,
  libraryCount 
}: ISourceTabsProps) => {
  return (
    <div className="flex gap-1 border-b">
      <button 
        className={activeTab === 'upload' ? 'active' : ''}
        onClick={() => onTabChange('upload')}
      >
        <Upload size={16} />
        Upload Files
        {uploadCount > 0 && <span>({uploadCount})</span>}
      </button>
      <button 
        className={activeTab === 'library' ? 'active' : ''}
        onClick={() => onTabChange('library')}
      >
        <BookOpen size={16} />
        Library
        {libraryCount > 0 && <span>({libraryCount})</span>}
      </button>
    </div>
  );
};
```

**Files to Create:**
- `SourceTabs/SourceTabs.tsx`
- `SourceTabs/ISourceTabs.ts`
- `SourceTabs/SourceTabs.styles.ts`
- `SourceTabs/index.ts`

---

### **Phase 5: Components - Document Selector**
**Estimated Time**: 3-4 hours

#### Tasks:

1. **Create DocumentSelector Component**
   - Location: `web/src/pages/CreateDocumentPage/CreateDocumentPageContainer/TextPromptForm/DocumentSelector/`
   - [ ] Fetch user documents from Redux
   - [ ] Scrollable list with checkboxes
   - [ ] Auto-add on checkbox change
   - [ ] Show word count for each document
   - [ ] Empty state ("No documents in your library yet. Create some first!")
   - [ ] Loading state while fetching
   - [ ] Disable checkboxes if limit reached
   - [ ] Files:
     - `DocumentSelector.tsx` - Main component
     - `IDocumentSelector.ts` - Props interface
     - `DocumentSelector.styles.ts` - Styles
     - `index.ts` - Exports

**Component Structure:**
```typescript
interface IDocumentSelectorProps {
  documents: DocumentEnhanced[];
  selectedDocumentIds: string[];
  onDocumentToggle: (documentId: string) => void;
  canSelectMore: boolean;
  isLoading: boolean;
}

export const DocumentSelector = ({
  documents,
  selectedDocumentIds,
  onDocumentToggle,
  canSelectMore,
  isLoading
}: IDocumentSelectorProps) => {
  if (isLoading) {
    return <LoadingState />;
  }

  if (documents.length === 0) {
    return (
      <EmptyState message="No documents in your library yet. Create some first!" />
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto space-y-2">
      {documents.map(doc => (
        <label key={doc.id} className="flex items-center gap-3 p-3 border rounded hover:bg-muted cursor-pointer">
          <input
            type="checkbox"
            checked={selectedDocumentIds.includes(doc.id)}
            onChange={() => onDocumentToggle(doc.id)}
            disabled={!canSelectMore && !selectedDocumentIds.includes(doc.id)}
          />
          <div className="flex-1">
            <p className="font-medium">{doc.title}</p>
            <p className="text-sm text-muted-foreground">
              {doc.wordCount.toLocaleString()} words
            </p>
          </div>
        </label>
      ))}
    </div>
  );
};
```

2. **Create DocumentSelectorItem Component** (Optional sub-component)
   - Location: `DocumentSelector/DocumentSelectorItem/`
   - [ ] Individual checkbox item
   - [ ] Document metadata display
   - [ ] Disabled state styling

**Files to Create:**
- `DocumentSelector/DocumentSelector.tsx`
- `DocumentSelector/IDocumentSelector.ts`
- `DocumentSelector/DocumentSelector.styles.ts`
- `DocumentSelector/index.ts`

---

### **Phase 6: Visual Differentiation**
**Estimated Time**: 1 hour

#### Tasks:

1. **Update AttachedFileItem** (`AttachedFilesList/AttachedFileItem/`)
   - [ ] Add icon selection logic based on `source`
     - Upload: `FileText` icon (green when ready)
     - Library: `BookOpen` icon (purple/violet when ready)
   - [ ] Update color coding:
     - Upload ready: `text-green-500`
     - Library ready: `text-purple-500`
   - [ ] Ensure remove button works for both types

**Icon & Color Decisions:**
- **Library Icon**: `BookOpen` from lucide-react
- **Library Color**: Purple/Violet (`text-purple-500`, `text-purple-600`)
- **Upload Icon**: `FileText` (existing)
- **Upload Color**: Green (existing)

**Updated Icon Logic:**
```typescript
const getStatusIcon = () => {
  const iconClass = cn(attachedFileItemStyles.icon);
  
  if (file.source === 'library') {
    switch (file.status) {
      case 'ready':
        return <BookOpen className={cn(iconClass, 'text-purple-500')} />;
      case 'reading':
        return <Loader2 className={cn(iconClass, 'text-purple-500 animate-spin')} />;
      case 'error':
        return <AlertCircle className={cn(iconClass, 'text-destructive')} />;
    }
  } else {
    // Existing upload file logic
    switch (file.status) {
      case 'ready':
        return <FileText className={cn(iconClass, 'text-green-500')} />;
      // ... rest
    }
  }
};
```

**Files to Modify:**
- `AttachedFilesList/AttachedFileItem/AttachedFileItem.tsx`

---

### **Phase 7: Hook Updates**
**Estimated Time**: 3-4 hours

#### Tasks:

1. **Update useFileUpload Hook** (`web/src/pages/CreateDocumentPage/context/hooks/useFileUpload.ts`)
   - [ ] Add `handleDocumentToggle(documentId)` function
   - [ ] Fetch document content when selected
   - [ ] Add to attachedFiles with `source: 'library'`
   - [ ] Remove from attachedFiles when deselected
   - [ ] Update token calculation for library docs
   - [ ] Handle loading state during content fetch
   - [ ] Error handling for fetch failures

**New Function:**
```typescript
const handleDocumentToggle = useCallback(async (documentId: string) => {
  const isSelected = attachedFiles.some(f => f.documentId === documentId);
  
  if (isSelected) {
    // Remove document
    const fileToRemove = attachedFiles.find(f => f.documentId === documentId);
    if (fileToRemove) {
      dispatch(removeFile(fileToRemove.id));
    }
    return;
  }
  
  // Add document
  const fileId = generateFileId();
  
  // Add with loading state
  dispatch(addFile({
    id: fileId,
    filename: 'Loading...',
    size: 0,
    content: '',
    characterCount: 0,
    estimatedTokens: 0,
    status: 'reading',
    source: 'library',
    documentId,
  }));
  
  try {
    // Fetch document details
    const document = documents.find(d => d.id === documentId);
    if (!document) throw new Error('Document not found');
    
    // Fetch content
    const content = await fetchDocumentContent(documentId);
    
    // Convert to attached file
    const attachedFile = convertDocumentToAttachedFile(document, content);
    
    // Update with full data
    dispatch(removeFile(fileId));
    dispatch(addFile({
      id: fileId,
      ...attachedFile,
    }));
    
    // Validate context size
    // ... existing validation logic
    
  } catch (error) {
    dispatch(updateFileStatus({
      id: fileId,
      status: 'error',
      error: 'Failed to load document',
    }));
  }
}, [attachedFiles, documents, dispatch]);
```

2. **Return new handlers**
   - [ ] Add `handleDocumentToggle` to return value
   - [ ] Add `selectedDocumentIds` to return value

**Files to Modify:**
- `web/src/pages/CreateDocumentPage/context/hooks/useFileUpload.ts`

---

### **Phase 8: Form Integration**
**Estimated Time**: 2-3 hours

#### Tasks:

1. **Update TextPromptForm Component** (`TextPromptForm/TextPromptForm.tsx`)
   - [ ] Add tab state: `useState<'upload' | 'library'>('upload')`
   - [ ] Integrate SourceTabs component
   - [ ] Conditional rendering based on active tab:
     - Upload tab: Show FileUploadZone
     - Library tab: Show DocumentSelector
   - [ ] Keep AttachedFilesList always visible (below tabs)
   - [ ] Pass document toggle handler to DocumentSelector

**Component Structure:**
```typescript
export const TextPromptForm = ({ ... }: ITextPromptFormProps) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'library'>('upload');
  
  const uploadCount = attachedFiles.filter(f => f.source === 'upload').length;
  const libraryCount = attachedFiles.filter(f => f.source === 'library').length;
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Tab Interface */}
      <SourceTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        uploadCount={uploadCount}
        libraryCount={libraryCount}
      />
      
      {/* Tab Content */}
      {activeTab === 'upload' ? (
        <FileUploadZone
          onFilesSelected={onFilesSelected}
          canAttachMore={canAttachMore}
          maxFiles={FILE_UPLOAD_CONSTRAINTS.MAX_FILES}
          disabled={isLoading}
        />
      ) : (
        <DocumentSelector
          documents={userDocuments}
          selectedDocumentIds={selectedDocumentIds}
          onDocumentToggle={onDocumentToggle}
          canSelectMore={canAttachMore}
          isLoading={isLoadingDocuments}
        />
      )}
      
      {/* Attached Files List - Always Visible */}
      <AttachedFilesList
        files={attachedFiles}
        onRemoveFile={onFileRemove}
        totalTokens={totalTokens}
        maxTokens={FILE_UPLOAD_CONSTRAINTS.MAX_TOTAL_TOKENS}
        contextSizeError={contextSizeError}
      />
      
      {/* Rest of form ... */}
    </form>
  );
};
```

2. **Update ITextPromptForm interface**
   - [ ] Add document-related props
   
   ```typescript
   interface ITextPromptFormProps {
     // ... existing props
     // Document selector props
     userDocuments: DocumentEnhanced[];
     selectedDocumentIds: string[];
     onDocumentToggle: (documentId: string) => void;
     isLoadingDocuments: boolean;
   }
   ```

**Files to Modify:**
- `TextPromptForm/TextPromptForm.tsx`
- `TextPromptForm/ITextPromptForm.ts`

---

### **Phase 9: Container Integration**
**Estimated Time**: 1-2 hours

#### Tasks:

1. **Update FormRenderer** (`FormRenderer/FormRenderer.tsx`)
   - [ ] Fetch user documents using `useGetUserDocumentsQuery`
   - [ ] Get selected document IDs from Redux
   - [ ] Pass to TextPromptForm
   
   ```typescript
   const { data: documentsData, isLoading: isLoadingDocuments } = 
     useGetUserDocumentsQuery();
   const selectedDocumentIds = useSelector(selectSelectedDocumentIds);
   
   <TextPromptForm
     // ... existing props
     userDocuments={documentsData?.documents || []}
     selectedDocumentIds={selectedDocumentIds}
     onDocumentToggle={fileUpload.handleDocumentToggle}
     isLoadingDocuments={isLoadingDocuments}
   />
   ```

**Files to Modify:**
- `FormRenderer/FormRenderer.tsx`

---

### **Phase 10: Backend Validation**
**Estimated Time**: 1-2 hours

#### Tasks:

1. **Update documents endpoint** (`functions/src/endpoints/documents.ts`)
   - [ ] Update `generateFromPrompt` function
   - [ ] Validate ownership for library documents
   - [ ] Add logging to distinguish sources
   
   ```typescript
   // Validate files if provided
   if (data.files) {
     data.files.forEach((file, index) => {
       // ... existing validation
       
       // Validate library document ownership
       if (file.source === 'library' && file.documentId) {
         logger.info('Validating library document ownership', {
           userId,
           documentId: file.documentId,
         });
         
         // Note: Content already validated on frontend fetch
         // Backend receives content, not just ID
         // Additional validation could check document exists
       }
     });
   }
   ```

2. **Update logging**
   - [ ] Log source type for analytics
   - [ ] Track library vs upload usage

**Files to Modify:**
- `functions/src/endpoints/documents.ts`

---

### **Phase 11: Error Handling & Edge Cases**
**Estimated Time**: 2 hours

#### Tasks:

1. **Handle edge cases in useFileUpload**
   - [ ] Document content fetch failure
   - [ ] Document deleted during selection
   - [ ] Network errors
   - [ ] Concurrent selections

2. **Add user feedback**
   - [ ] Loading state during document fetch
   - [ ] Error messages for fetch failures
   - [ ] Disable checkboxes when limit reached
   - [ ] Warning for large documents (> 50K words)

3. **Validation checks**
   - [ ] Ensure combined limit (5 items total)
   - [ ] Ensure combined token limit (200K)
   - [ ] Warn before exceeding limits

**Warning Logic:**
```typescript
const getDocumentWarning = (wordCount: number): string | null => {
  if (wordCount > 50000) {
    return 'This document is very large and may exceed context limits';
  }
  if (wordCount > 25000) {
    return 'This document is large, monitor your context size';
  }
  return null;
};
```

---

### **Phase 12: Testing & Polish**
**Estimated Time**: 2-3 hours

#### Tasks:

1. **Manual Testing Scenarios**
   - [ ] Select document from library, verify it appears in list
   - [ ] Upload file, then select document (mixed sources)
   - [ ] Reach limit with uploads, verify library disabled
   - [ ] Reach limit with library, verify upload disabled
   - [ ] Remove library document, verify checkbox unchecked
   - [ ] Switch tabs, verify selections persist
   - [ ] Submit form with mixed sources
   - [ ] Submit form with only library documents
   - [ ] Submit form with only uploaded files
   - [ ] Test empty library state
   - [ ] Test document fetch failure
   - [ ] Test large document warning
   - [ ] Test context size limit
   - [ ] Mobile responsive testing

2. **UI Polish**
   - [ ] Tab transitions smooth
   - [ ] Loading states clear
   - [ ] Empty states helpful
   - [ ] Error states informative
   - [ ] Colors consistent with design system

3. **Accessibility**
   - [ ] Keyboard navigation through tabs
   - [ ] Checkbox keyboard control
   - [ ] Screen reader labels
   - [ ] Focus management

---

## 📊 Implementation Summary

### Total Estimated Time: **20-25 hours**

### Phase Breakdown:
| Phase | Description | Time | Priority |
|-------|-------------|------|----------|
| 1 | Type Definitions | 1-2h | Critical |
| 2 | Redux State | 1h | Critical |
| 3 | Utility Functions | 1-2h | Critical |
| 4 | Tab Interface | 2-3h | Critical |
| 5 | Document Selector | 3-4h | Critical |
| 6 | Visual Differentiation | 1h | High |
| 7 | Hook Updates | 3-4h | Critical |
| 8 | Form Integration | 2-3h | Critical |
| 9 | Container Integration | 1-2h | Critical |
| 10 | Backend Validation | 1-2h | High |
| 11 | Error Handling | 2h | High |
| 12 | Testing & Polish | 2-3h | High |

---

## 🚀 Development Order (Recommended)

### Sprint 1: Foundation (Days 1-2)
1. Phase 1: Type Definitions
2. Phase 2: Redux State
3. Phase 3: Utility Functions

### Sprint 2: UI Components (Days 2-3)
4. Phase 4: Tab Interface
5. Phase 5: Document Selector
6. Phase 6: Visual Differentiation

### Sprint 3: Integration (Days 3-4)
7. Phase 7: Hook Updates
8. Phase 8: Form Integration
9. Phase 9: Container Integration

### Sprint 4: Validation & Polish (Day 5)
10. Phase 10: Backend Validation
11. Phase 11: Error Handling
12. Phase 12: Testing & Polish

---

## 🎯 Success Criteria

### Functional Requirements
- ✅ Users can switch between Upload and Library tabs
- ✅ Selections persist across tab switches
- ✅ Documents auto-add on checkbox selection
- ✅ Combined limit of 5 items enforced
- ✅ Combined token limit of 200K enforced
- ✅ Library documents visually differentiated (icon + color)
- ✅ Empty state shown for empty library
- ✅ Loading state during document fetch
- ✅ Error handling for fetch failures
- ✅ Backend validates document ownership
- ✅ Works with mixed sources (upload + library)

### Non-Functional Requirements
- ✅ Fast document content fetch (<2s)
- ✅ Smooth tab switching
- ✅ Responsive on all devices
- ✅ Accessible (keyboard + screen reader)
- ✅ Consistent with existing design
- ✅ No performance degradation

---

## 🔧 Technical Debt & Future Enhancements

### Known Limitations
- No document search/filter in library selector
- No document preview before selection
- No "recently used" documents
- Large document warning is static threshold
- Cannot select excerpts from large documents

### Future Improvements
- [ ] Add search/filter in document selector
- [ ] Add document preview modal
- [ ] Add "recently used" section
- [ ] Smart truncation for large documents
- [ ] Allow selecting specific sections
- [ ] Save frequently used document sets
- [ ] Drag & drop documents from library
- [ ] Bulk select/deselect options

---

## 📝 Component Architecture

```
TextPromptForm
├── SourceTabs (NEW)
│   ├── Upload Tab (icon + label)
│   └── Library Tab (icon + label)
├── Tab Content (conditional)
│   ├── FileUploadZone (existing - tab 1)
│   └── DocumentSelector (NEW - tab 2)
│       ├── Loading State
│       ├── Empty State
│       └── Document List
│           └── Checkbox Items (auto-add)
├── AttachedFilesList (existing - always visible)
│   └── AttachedFileItem (updated)
│       ├── Upload files (FileText, green)
│       └── Library docs (BookOpen, purple)
├── Textarea (existing)
└── Submit Button (existing)
```

---

## 🎨 Visual Design

### Color Scheme:
- **Upload Files**: 
  - Icon: `FileText`
  - Color: `text-green-500` (ready), `text-blue-500` (reading)
  
- **Library Documents**:
  - Icon: `BookOpen`
  - Color: `text-purple-500` (ready), `text-purple-500` (reading)

### Tab Design:
```
┌─────────────────┬──────────────────┐
│ 📤 Upload Files │ 📖 Library      │
│      (2)        │      (1)         │
└─────────────────┴──────────────────┘
    ▲ Active tab with underline/bg
```

### Document Selector:
```
┌──────────────────────────────────────┐
│ ☐ My First Document (1,234 words)   │
│ ☑ AWS DynamoDB Guide (5,678 words)  │ ← Selected
│ ☐ React Patterns (3,456 words)      │
│ ...                                  │
└──────────────────────────────────────┘
     ▲ Scrollable if many documents
```

---

## 📚 API Flow

### Document Selection Flow:
```
1. User checks checkbox in DocumentSelector
   ↓
2. handleDocumentToggle(documentId) called
   ↓
3. Add file with 'reading' status to Redux
   ↓
4. Fetch document content via getDocumentContent API
   ↓
5. Convert to IAttachedFile with source: 'library'
   ↓
6. Update Redux with full content and 'ready' status
   ↓
7. AttachedFilesList shows library doc (purple BookOpen icon)
   ↓
8. User submits form
   ↓
9. Both upload + library files sent to backend
   ↓
10. Backend validates ownership (implicit via content fetch)
   ↓
11. Gemini generates document with all context
```

---

**Last Updated**: 2025-10-04  
**Status**: 📋 Planning  
**Owner**: Development Team  
**Priority**: High  
**Estimated Completion**: 5 working days


