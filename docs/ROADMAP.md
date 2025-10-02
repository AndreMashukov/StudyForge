# Text Prompt Document Generation - Implementation Roadmap

## Overview
Implement AI-powered document generation from text prompts using Gemini AI. Users can input a natural language prompt (e.g., "Explain DynamoDB provisioned capacity") and receive a comprehensive, well-structured markdown document.

## Feature Requirements Summary

### User Experience
- **Input**: Multi-line textarea with 1000 character limit
- **Output**: AI-generated markdown document with structured content
- **Loading**: Progress indication during generation (10-30 seconds)
- **Error Handling**: Clear error messages for failures

### Content Specifications
- **Minimum Word Count**: 1000 words
- **Tables**: 1-2 tables (Gemini decides based on context)
- **ASCII Diagrams**: 2-3 diagrams (Gemini chooses types based on topic)
- **Structure**:
  1. Glossary
  2. Core Concepts
  3. Examples (with code if relevant)
  4. Summary

### Document Metadata
- Original prompt text
- Word count
- Generation timestamp
- Standard document fields (title, createdAt, userId, etc.)

---

## Implementation Phases

### Phase 1: Backend - Firebase Functions

#### 1.1 Create Gemini Service Method for Document Generation
**File**: `functions/src/services/gemini/gemini.ts`

**Tasks**:
- [ ] Add `generateDocumentFromPrompt(prompt: string): Promise<string>` method
- [ ] Configure model: `gemini-2.0-flash` with higher `maxOutputTokens` (16384+)
- [ ] Set generation config:
  - `temperature: 0.7` (creative but focused)
  - `topK: 40`
  - `topP: 0.95`
  - `maxOutputTokens: 16384`

**Acceptance Criteria**:
- Method accepts text prompt as input
- Returns markdown content as string
- Handles API errors gracefully
- Logs generation time and token usage

---

#### 1.2 Create Prompt Builder for Document Generation
**File**: `functions/src/services/gemini/prompt-builder/document-prompt-builder.ts`

**Tasks**:
- [ ] Create `DocumentPromptBuilder` class
- [ ] Implement `buildDocumentPrompt(userPrompt: string): string` method
- [ ] Include instructions for:
  - Minimum 1000 words
  - 1-2 contextually relevant tables
  - 2-3 ASCII diagrams (various types)
  - Required sections: Glossary, Core Concepts, Examples, Summary
  - Markdown formatting guidelines
  - ASCII diagram style (similar to quiz followup format)
  - Code examples when relevant to topic

**Prompt Template Structure**:
```
You are a technical documentation expert. Generate a comprehensive document based on the following prompt:

"[USER_PROMPT]"

REQUIREMENTS:
1. Minimum 1000 words
2. Include 1-2 relevant tables
3. Include 2-3 ASCII diagrams in code blocks
4. Use proper markdown formatting

REQUIRED STRUCTURE:
1. # Glossary - Key terms and definitions
2. # Core Concepts - Detailed explanations
3. # Examples - Practical examples with code if relevant
4. # Summary - Key takeaways

ASCII DIAGRAM GUIDELINES:
- Use box drawing characters (╔╗╚╝║═┌┐└┘│─)
- Use arrows (→←↑↓)
- Use symbols (✅❌⚠️🔄⭐)
- Wrap diagrams in code blocks
- Keep diagrams clear and readable

OUTPUT FORMAT:
- Pure markdown (no code block wrappers)
- Clear section headers
- Well-structured content
```

**Acceptance Criteria**:
- Prompt template is clear and comprehensive
- Instructions ensure minimum requirements are met
- ASCII diagram style matches quiz followup format
- Output is markdown-ready

---

#### 1.3 Create New Firebase Function Endpoint
**File**: `functions/src/endpoints/documents.ts`

**Tasks**:
- [ ] Add new endpoint: `POST /documents/generate-from-prompt`
- [ ] Request validation:
  - Check user authentication
  - Validate prompt (non-empty, max 1000 chars)
- [ ] Call `GeminiService.generateDocumentFromPrompt()`
- [ ] Validate generated content:
  - Check word count (minimum 1000)
  - Verify markdown format
  - Check for required sections
- [ ] Extract title from generated content (first H1)
- [ ] Create document in Firestore with metadata:
  - `originalPrompt`: string
  - `wordCount`: number
  - `generatedAt`: timestamp
  - `source`: "prompt"
- [ ] Return document ID and data

**Request Interface**:
```typescript
interface GenerateFromPromptRequest {
  prompt: string; // Max 1000 characters
}
```

**Response Interface**:
```typescript
interface GenerateFromPromptResponse {
  documentId: string;
  title: string;
  content: string;
  wordCount: number;
  metadata: {
    originalPrompt: string;
    generatedAt: string;
  };
}
```

**Error Handling**:
- Invalid prompt → 400 Bad Request
- Gemini API failure → 500 Internal Server Error
- Content validation failure → 500 with specific error
- Authentication failure → 401 Unauthorized

**Acceptance Criteria**:
- Endpoint accepts prompt and generates document
- Document is saved to Firestore
- Response includes document ID and metadata
- All validations work correctly
- Errors are handled with appropriate messages

---

### Phase 2: Frontend - Redux & API Integration

#### 2.1 Update Shared Types
**File**: `libs/shared-types/src/index.ts`

**Tasks**:
- [ ] Add `GenerateFromPromptRequest` interface
- [ ] Add `GenerateFromPromptResponse` interface
- [ ] Update `DocumentEnhanced` type to include new metadata fields

**Acceptance Criteria**:
- Types are exported and available in both frontend and backend
- Type definitions match backend implementation

---

#### 2.2 Create RTK Query API Endpoint
**File**: `web/src/store/api/Documents/documentsApi.ts`

**Tasks**:
- [ ] Add `generateFromPrompt` mutation endpoint
- [ ] Configure endpoint:
  - Method: POST
  - URL: `/documents/generate-from-prompt`
  - Body: `{ prompt: string }`
- [ ] Invalidate `Documents` tag on success
- [ ] Handle loading and error states

**Implementation**:
```typescript
generateFromPrompt: builder.mutation<GenerateFromPromptResponse, { prompt: string }>({
  query: ({ prompt }) => ({
    url: '/documents/generate-from-prompt',
    method: 'POST',
    data: { prompt },
  }),
  invalidatesTags: [{ type: 'Documents', id: 'LIST' }],
}),
```

**Export Hook**:
```typescript
export const { useGenerateFromPromptMutation } = documentsApi;
```

**Acceptance Criteria**:
- Mutation hook is available for use in components
- API call is properly configured
- Tags are invalidated on success
- Loading and error states are accessible

---

#### 2.3 Update Redux Slice
**File**: `web/src/store/slices/createDocumentPageSlice.ts`

**Tasks**:
- [ ] Add `textPromptForm` state object:
  ```typescript
  textPromptForm: {
    isLoading: boolean;
    progress: number; // 0-100 for progress indication
  }
  ```
- [ ] Add actions:
  - `setTextPromptFormLoading(boolean)`
  - `setTextPromptFormProgress(number)`
- [ ] Add selectors:
  - `selectTextPromptFormLoading`
  - `selectTextPromptFormProgress`

**Acceptance Criteria**:
- State is properly typed
- Actions update state correctly
- Selectors return correct values

---

### Phase 3: Frontend - UI Components

#### 3.1 Create Text Prompt Form Component
**File**: `web/src/pages/CreateDocumentPage/CreateDocumentPageContainer/TextPromptForm/TextPromptForm.tsx`

**Tasks**:
- [ ] Create form component with:
  - Multi-line textarea (4-6 rows)
  - Character counter (e.g., "450 / 1000")
  - Submit button
  - Loading state with progress indicator
  - Error display
- [ ] Implement form validation:
  - Required field
  - Max 1000 characters
  - Minimum 10 characters
- [ ] Add helpful placeholder text:
  ```
  Example: "Explain DynamoDB provisioned capacity"
  
  Describe what you want to learn about. Be specific for better results.
  ```
- [ ] Show loading state during generation with message:
  - "Generating your document..."
  - "This may take 10-30 seconds"
  - Progress indicator or spinner

**Styling**:
- Match existing form styles
- Use shadcn/ui components
- Responsive design
- Clear visual hierarchy

**Acceptance Criteria**:
- Form is visually consistent with other forms
- Character counter updates in real-time
- Validation messages are clear
- Loading state is visible and informative

---

#### 3.2 Create Text Prompt Form Interface
**File**: `web/src/pages/CreateDocumentPage/CreateDocumentPageContainer/TextPromptForm/ITextPromptForm.ts`

**Tasks**:
- [ ] Define component props interface:
  ```typescript
  export interface ITextPromptForm {
    onSubmit: (prompt: string) => Promise<void>;
    isLoading: boolean;
    progress?: number;
    onBack?: () => void;
  }
  ```

**Acceptance Criteria**:
- Interface is properly typed
- Props match component needs

---

#### 3.3 Update Form Renderer
**File**: `web/src/pages/CreateDocumentPage/CreateDocumentPageContainer/FormRenderer/FormRenderer.tsx`

**Tasks**:
- [ ] Import `TextPromptForm` component
- [ ] Add case for `textPrompt` source type
- [ ] Pass appropriate props:
  - `onSubmit={onSubmitTextPrompt}`
  - `isLoading={isTextPromptLoading}`
  - `progress={textPromptProgress}`
  - `onBack={onBack}`

**Acceptance Criteria**:
- Text prompt form renders when source is selected
- Props are correctly passed
- Form integrates seamlessly with existing forms

---

#### 3.4 Update Source Selector
**File**: `web/src/pages/CreateDocumentPage/CreateDocumentPageContainer/SourceSelector/SourceSelector.tsx`

**Tasks**:
- [ ] Update `textPrompt` card status from `'coming-soon'` to `'active'`
- [ ] Verify card is clickable and selectable

**Acceptance Criteria**:
- Text Prompt card is active and clickable
- Selecting the card shows the form
- Visual states work correctly (hover, selected, etc.)

---

### Phase 4: Frontend - Business Logic

#### 4.1 Create Text Prompt Handler
**File**: `web/src/pages/CreateDocumentPage/context/hooks/useCreateDocumentPageHandlers.ts`

**Tasks**:
- [ ] Import `useGenerateFromPromptMutation` hook
- [ ] Add `handleCreateFromTextPrompt` method:
  ```typescript
  const handleCreateFromTextPrompt = async (prompt: string) => {
    dispatch(setTextPromptFormLoading(true));
    dispatch(clearError());
    
    try {
      // Optional: Simulate progress updates
      const progressInterval = setInterval(() => {
        dispatch(setTextPromptFormProgress(prev => 
          Math.min(prev + 10, 90)
        ));
      }, 2000);
      
      const result = await generateFromPrompt({ prompt }).unwrap();
      
      clearInterval(progressInterval);
      dispatch(setTextPromptFormProgress(100));
      
      enqueueSnackbar('Document generated successfully!', { 
        variant: 'success' 
      });
      
      // Navigate to the new document
      navigate(`/documents/${result.documentId}`);
      
    } catch (error) {
      dispatch(setError(
        error?.data?.message || 'Failed to generate document'
      ));
      enqueueSnackbar('Failed to generate document', { 
        variant: 'error' 
      });
    } finally {
      dispatch(setTextPromptFormLoading(false));
      dispatch(setTextPromptFormProgress(0));
    }
  };
  ```
- [ ] Add to returned handlers object

**Acceptance Criteria**:
- Handler calls mutation correctly
- Progress updates during generation
- Success navigates to document viewer
- Errors are handled and displayed
- Loading state is managed correctly

---

#### 4.2 Update Container Props
**File**: `web/src/pages/CreateDocumentPage/CreateDocumentPageContainer/CreateDocumentPageContainer.tsx`

**Tasks**:
- [ ] Add selectors for text prompt state:
  ```typescript
  const isTextPromptLoading = useSelector(selectTextPromptFormLoading);
  const textPromptProgress = useSelector(selectTextPromptFormProgress);
  ```
- [ ] Pass new handler to FormRenderer:
  ```typescript
  <FormRenderer
    // ... existing props
    onSubmitTextPrompt={handlers.handleCreateFromTextPrompt}
    isTextPromptLoading={isTextPromptLoading}
    textPromptProgress={textPromptProgress}
  />
  ```

**Acceptance Criteria**:
- State values are correctly selected
- Props are passed to FormRenderer
- Component re-renders appropriately

---

### Phase 5: Testing & Validation

#### 5.1 Backend Testing
**Tasks**:
- [ ] Test Gemini service method:
  - Valid prompts generate proper documents
  - Content meets minimum requirements (1000 words, tables, diagrams)
  - ASCII diagrams are properly formatted
  - Required sections are present
- [ ] Test endpoint validation:
  - Empty prompt → 400 error
  - Prompt > 1000 chars → 400 error
  - Unauthenticated request → 401 error
- [ ] Test document creation:
  - Document saved to Firestore
  - All metadata fields are set
  - Word count is calculated correctly
- [ ] Test error scenarios:
  - Gemini API failure
  - Network timeout
  - Invalid content validation

**Acceptance Criteria**:
- All backend tests pass
- Error handling works correctly
- Generated documents meet requirements

---

#### 5.2 Frontend Testing
**Tasks**:
- [ ] Test form component:
  - Character counter works
  - Validation messages display
  - Submit button disabled when invalid
  - Loading state shows progress
- [ ] Test form submission:
  - Valid prompt generates document
  - Success navigates to document viewer
  - Error messages display correctly
- [ ] Test integration:
  - Source selection flow works
  - Back button returns to source selector
  - Form resets after submission
- [ ] Test Redux state:
  - Loading state updates correctly
  - Progress updates during generation
  - Error state is set on failure

**Acceptance Criteria**:
- All frontend tests pass
- User flow is smooth and intuitive
- Loading states are clear
- Error handling provides good UX

---

#### 5.3 End-to-End Testing
**Tasks**:
- [ ] Test complete user flow:
  1. Navigate to Create Document page
  2. Select "Text Prompt" source
  3. Enter prompt and submit
  4. Wait for generation (with progress)
  5. View generated document
  6. Verify document content and metadata
- [ ] Test various prompts:
  - Technical topics (e.g., "Explain Kubernetes pods")
  - General topics (e.g., "What is machine learning?")
  - Complex topics (e.g., "Compare SQL vs NoSQL databases")
- [ ] Test edge cases:
  - Very short prompts
  - Maximum length prompts
  - Prompts with special characters
  - Network failures during generation

**Acceptance Criteria**:
- Complete flow works end-to-end
- Various prompt types generate good documents
- Edge cases are handled gracefully

---

### Phase 6: Documentation & Deployment

#### 6.1 Code Documentation
**Tasks**:
- [ ] Add JSDoc comments to:
  - Gemini service method
  - Prompt builder
  - Backend endpoint
  - Frontend handlers
- [ ] Update README with new feature
- [ ] Add inline comments for complex logic

**Acceptance Criteria**:
- Code is well-documented
- README reflects new feature
- Complex sections have explanatory comments

---

#### 6.2 User Documentation
**Tasks**:
- [ ] Add feature description to user-facing docs
- [ ] Include usage examples:
  - Good prompts vs bad prompts
  - Example generated documents
- [ ] Document limitations:
  - 1000 character prompt limit
  - Generation time (10-30 seconds)
  - Gemini API availability

**Acceptance Criteria**:
- Users understand how to use the feature
- Examples are helpful and clear
- Limitations are clearly stated

---

#### 6.3 Deployment
**Tasks**:
- [ ] Deploy Firebase Functions:
  ```bash
  firebase deploy --only functions
  ```
- [ ] Deploy Frontend:
  ```bash
  nx build web --prod
  firebase deploy --only hosting
  ```
- [ ] Verify deployment:
  - Test in production environment
  - Check Gemini API usage and limits
  - Monitor error rates

**Acceptance Criteria**:
- Feature is live in production
- No deployment errors
- Feature works as expected in production

---

## Success Metrics

### Functional Metrics
- ✅ Users can generate documents from text prompts
- ✅ Generated documents meet minimum requirements (1000 words, 1-2 tables, 2-3 diagrams)
- ✅ Documents have proper structure (Glossary, Core Concepts, Examples, Summary)
- ✅ Documents are saved with correct metadata
- ✅ Error handling provides clear feedback

### Quality Metrics
- 📊 Document generation success rate > 95%
- 📊 Average generation time < 30 seconds
- 📊 User satisfaction with generated content > 80%
- 📊 Error rate < 5%

### User Experience Metrics
- 🎯 Loading state is clear and informative
- 🎯 Error messages are actionable
- 🎯 Generated documents are well-formatted
- 🎯 ASCII diagrams are readable and relevant
- 🎯 Navigation flow is smooth

---

## Timeline Estimate

| Phase | Estimated Time | Priority |
|-------|----------------|----------|
| Phase 1: Backend | 4-6 hours | High |
| Phase 2: Redux & API | 2-3 hours | High |
| Phase 3: UI Components | 3-4 hours | High |
| Phase 4: Business Logic | 2-3 hours | High |
| Phase 5: Testing | 3-4 hours | Medium |
| Phase 6: Documentation | 2-3 hours | Medium |
| **Total** | **16-23 hours** | - |

---

## Dependencies

### External APIs
- **Gemini API**: `gemini-2.0-flash` model
  - Rate limits: Check Firebase plan limits
  - Cost: Monitor token usage
  - Availability: Handle regional restrictions

### Internal Dependencies
- Firebase Functions (Node.js 20+)
- Firestore database
- Redux Toolkit & RTK Query
- React Router v7
- shadcn/ui components

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gemini API rate limits | High | Implement rate limiting, queue system |
| Generation quality varies | Medium | Refine prompts, validate output |
| Long generation times | Medium | Show progress, set timeout (60s) |
| API costs | Medium | Monitor usage, set budgets |
| Regional availability | Low | Fallback error messages |

---

## Future Enhancements

### Phase 7 (Optional)
- [ ] Add document length preferences (short, medium, long)
- [ ] Add topic complexity selection (beginner, intermediate, advanced)
- [ ] Add language selection for generated content
- [ ] Add ability to regenerate sections
- [ ] Add prompt templates for common topics
- [ ] Add preview before saving
- [ ] Add edit mode for generated content

### Phase 8 (Optional)
- [ ] Analytics dashboard for generated documents
- [ ] User feedback collection on generated content
- [ ] A/B testing different prompt strategies
- [ ] Cache frequently requested topics
- [ ] Collaborative prompt building

---

## Notes

- The feature leverages existing Gemini integration
- ASCII diagram format matches quiz followup style for consistency
- Document structure is flexible but has required sections
- Users can edit generated documents after creation
- Generated documents are treated like any other document in the system

---

## Checklist for Completion

- [ ] All phases completed
- [ ] Tests passing (backend + frontend)
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Deployed to production
- [ ] Feature verified in production
- [ ] User feedback collected
- [ ] Success metrics tracked

---

**Last Updated**: 2025-10-02
**Status**: Ready for Implementation
**Estimated Completion**: 2-3 days of focused development

