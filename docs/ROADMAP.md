# Code Insights AI - Development Roadmap

## Documents Library Enhancement & Quiz Management Redesign

### Overview
This roadmap outlines the enhancement of the Documents Library page to make quiz creation more flexible and introduce a centralized quiz management system.

---

## Phase 1: Core Infrastructure & UI Components

### 1.1 New UI Components
- **Priority**: High
- **Estimated Time**: 1-2 days

#### Tasks:
- [x] Create `Textarea` component in `web/src/components/ui/Textarea/`
  - Follow existing shadcn/ui pattern with proper styling
  - Include validation and character counting capabilities
  - Support for placeholder text and error states
- [x] Create `ActionsDropdown` component in `web/src/components/ui/ActionsDropdown/`
  - Reusable dropdown menu for document actions
  - Support for icons and disabled states
  - Extensible for future actions (flashcards, etc.)

### 1.2 New Page Structure
- **Priority**: High
- **Estimated Time**: 1 day

#### Tasks:
- [x] Create `/quiz/create` page structure
  - `web/src/pages/CreateQuizPage/`
  - Follow existing page architecture pattern (Provider → Container → Context)
  - Include proper TypeScript interfaces

---

## Phase 2: Quiz Creation Enhancement

### 2.1 Quiz Creation Form Page
- **Priority**: High
- **Estimated Time**: 2-3 days

#### Tasks:
- [ ] Implement `/quiz/create` page with form containing:
  - Document selection dropdown (pre-populated based on source)
  - Optional quiz name field (default: "Quiz from [Document Title]")
  - Optional additional prompt textarea
  - Form validation with Zod schema
- [ ] Create form handling logic:
  - Validate required fields
  - Character limits for quiz name (e.g., 100 characters)
  - Handle form submission with new API structure
- [ ] Update `useGenerateQuizMutation` API
  - Replace current API to accept quiz name and additional prompt parameters
  - Update backend endpoints to new structure

### 2.2 Navigation Updates
- **Priority**: Medium
- **Estimated Time**: 0.5 day

#### Tasks:
- [ ] Update Documents page routing:
  - Change "Create Quiz" button to navigate to `/quiz/create?documentId={id}`
  - Pass document context through URL parameters
- [ ] Handle navigation after quiz creation:
  - Redirect to `/quizzes` page instead of directly to quiz
  - Show success message/notification

---

## Phase 3: Document Actions Restructuring

### 3.1 Actions Menu Implementation
- **Priority**: High
- **Estimated Time**: 1-2 days

#### Tasks:
- [x] Replace single "Create Quiz" button with "Actions" dropdown:
  - Primary actions: "Create Quiz"
  - Future-ready for "Create Flashcards" and other actions
  - Maintain existing "View" and "Delete" as separate buttons
- [x] Update `DocumentsPageContainer`:
  - Implement new actions menu structure
  - Update handlers to work with new routing
- [x] Ensure consistent styling with existing design system

---

## Phase 4: Quiz History Removal & My Quizzes Page

### 4.1 Remove Quiz History from Documents
- **Priority**: Medium
- **Estimated Time**: 0.5 day

#### Tasks:
- [ ] Remove `DocumentQuizHistory` component from document cards
- [ ] Clean up related imports and dependencies
- [ ] Update document card layout without quiz history section

### 4.2 Enhanced My Quizzes Page
- **Priority**: High
- **Estimated Time**: 2-3 days

#### Tasks:
- [ ] Enhance existing `/quizzes` page (if exists) or create new one:
  - Display ALL quizzes from ALL documents
  - Group by source document
  - Sort by creation date (most recent first)
  - Show quiz metadata (name, creation date, question count, source document)
- [ ] Update quiz API endpoints:
  - Fetch all user quizzes with document information
  - Ensure proper data structure for grouping
- [ ] Implement quiz management features:
  - Navigate to quiz on click
  - Delete quiz functionality
  - Show quiz statistics

---

## Phase 5: API & Backend Updates

### 5.1 Quiz Generation API Redesign (Breaking Changes)
- **Priority**: High
- **Estimated Time**: 1-2 days

#### Tasks:
- [ ] Redesign quiz generation endpoint to accept:
  - `quizName` (optional, with default generation logic)
  - `additionalPrompt` (optional)
  - Remove old API structure
- [ ] Update `QuizApi.ts` interfaces:
  - Replace `IGenerateQuizRequest` interface with new structure
  - Update mutation hooks to new API
- [ ] Update existing quiz generation calls to use new API structure

### 5.2 Quiz Listing API Enhancement
- **Priority**: Medium
- **Estimated Time**: 1 day

#### Tasks:
- [ ] Ensure quiz listing API returns document information
- [ ] Update `IQuiz` interface to include source document details
- [ ] Replace existing quiz listing API with new optimized structure

---

## Phase 6: Testing & Polish

### 6.1 Component Testing
- **Priority**: Medium
- **Estimated Time**: 1-2 days

#### Tasks:
- [ ] Write unit tests for new components:
  - `Textarea` component
  - `ActionsDropdown` component
  - `CreateQuizPage` form validation
- [ ] Integration tests for quiz creation flow
- [ ] Test navigation and routing changes

### 6.2 User Experience Polish
- **Priority**: Low
- **Estimated Time**: 1 day

#### Tasks:
- [ ] Add loading states and progress indicators
- [ ] Implement proper error handling and user feedback
- [ ] Ensure responsive design for mobile devices
- [ ] Add keyboard navigation support
- [ ] Verify accessibility compliance

---

## Future Enhancements (Phase 7+)

### 7.1 Flashcards Feature
- **Priority**: Future
- **Estimated Time**: TBD

#### Placeholder Tasks:
- [ ] Implement flashcard creation following quiz creation pattern
- [ ] Create `/flashcards/create` page
- [ ] Add flashcard management to actions dropdown
- [ ] Create "My Flashcards" page

### 7.2 Additional Document Actions
- **Priority**: Future
- **Estimated Time**: TBD

#### Ideas:
- [ ] Summary generation
- [ ] Key points extraction
- [ ] Document translation
- [ ] Export functionality

---

## Implementation Timeline

### Week 1: Foundation
- Phase 1: New UI Components
- Phase 2: Quiz Creation Form Page

### Week 2: Integration
- Phase 3: Document Actions Restructuring  
- Phase 4: Quiz History Removal & My Quizzes Page

### Week 3: Backend Redesign & Testing
- Phase 5: API & Backend Updates (Breaking Changes)
- Phase 6: Testing & Polish

---

## Success Criteria

### Must Have:
- [ ] Users can create quizzes with custom names and additional prompts
- [ ] Document actions use dropdown menu instead of single button
- [ ] Quiz history removed from document cards
- [ ] Centralized "My Quizzes" page shows all quizzes organized by document
- [ ] After quiz creation, users navigate to "My Quizzes" page

### Nice to Have:
- [ ] Smooth animations and transitions
- [ ] Comprehensive error handling
- [ ] Mobile-responsive design
- [ ] Keyboard navigation support

### Technical Requirements:
- [ ] Maintain existing code architecture patterns
- [ ] Follow TypeScript strict typing
- [ ] Use existing design system (shadcn/ui)
- [ ] Improve performance with new API structure
- [ ] Clean up deprecated API endpoints

---

## Risk Assessment

### High Risk:
- **API Breaking Changes**: Complete API redesign will require updating all quiz-related functionality
- **Data Migration**: Existing quizzes may need data structure updates for new system

### Medium Risk:
- **User Experience**: Major navigation changes might require user adaptation
- **Performance**: Additional API calls for enhanced quiz listing

### Low Risk:
- **Component Development**: Following established patterns reduces implementation risk
- **Testing**: Comprehensive testing plan mitigates integration issues

---

## Notes

- All new components should follow the established shadcn/ui patterns
- Maintain consistency with existing Redux/RTK Query architecture
- **Breaking Changes**: This is a major refactor with API redesign
- Document all API changes and migration requirements
- Clean up deprecated code after implementation
- Keep accessibility in mind throughout implementation

---

*Last Updated: September 24, 2025*
