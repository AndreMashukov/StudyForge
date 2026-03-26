# Plan: Add Rule Selection to Quiz/Flashcard/SlideDeck Creation

## Context
Users want to select/deselect which rules to apply when creating quizzes, flashcards, and slide decks. Currently, these pages only display auto-resolved rules via `ResolvedRulesInfo` component (read-only).

**Problem:** No UI control to customize rule selection before generation.

**Solution:** Replace `ResolvedRulesInfo` with `RuleSelector` component in all three creation pages.

## Current State Analysis

| Page | Rule UI | Form State | API Support |
|------|---------|------------|-------------|
| CreateQuizPage | ResolvedRulesInfo (read-only) | ❌ No `ruleIds` | ✅ Has `additionalRuleIds` |
| CreateFlashcardPage | ResolvedRulesInfo (read-only) | ✅ Has `ruleIds` | ✅ Has `ruleIds` |
| CreateSlideDeckPage | ResolvedRulesInfo (read-only) | ✅ Has `ruleIds` | ✅ Has `ruleIds` |
| CreateDocumentPage | ✅ RuleSelector | ✅ Has `ruleIds` | ✅ Has `ruleIds` |

**Key Finding:** Flashcard and SlideDeck already have form state and API support, just missing UI. Quiz needs full implementation.

## Architecture

```
User Flow:
1. User selects documents
2. User selects/deselects rules (NEW)
3. User fills other fields
4. User submits → selected ruleIds sent to API

Component Integration:
- RuleSelector needs: directoryId, operation, selectedRuleIds, onSelectionChange
- Form state: Add ruleIds[] field
- API call: Pass ruleIds to generation endpoint
```

## Task List

### Phase 1: Quiz Page (requires full implementation)

- [ ] **Task 1:** Add `ruleIds` to Quiz form type
  - File: `web/src/pages/CreateQuizPage/types/ICreateQuizPageTypes.ts`
  - Add: `ruleIds?: string[];`

- [ ] **Task 2:** Add `ruleIds` to Quiz form schema and defaults
  - File: `web/src/pages/CreateQuizPage/context/hooks/useCreateQuizPageSchema.ts`
  - Add: `ruleIds: z.array(z.string()).optional()`
  - File: `web/src/pages/CreateQuizPage/context/hooks/useCreateQuizPageForm.ts`
  - Add default: `ruleIds: []`

- [ ] **Task 3:** Pass `ruleIds` to Quiz API handler
  - File: `web/src/pages/CreateQuizPage/context/hooks/useCreateQuizPageHandlers.ts`
  - Add to generateQuiz call: `additionalRuleIds: formData.ruleIds`
  - Note: Quiz API uses `additionalRuleIds` (not `ruleIds`)

- [ ] **Task 4:** Replace ResolvedRulesInfo with RuleSelector in Quiz page
  - File: `web/src/pages/CreateQuizPage/CreateQuizPageContainer/CreateQuizPageContainer.tsx`
  - Import: `RuleSelector` instead of `ResolvedRulesInfo`
  - Add: `const watchedRuleIds = watch('ruleIds');`
  - Add handler: `handleRuleSelectionChange`
  - Replace component: `<RuleSelector directoryId={directoryIdParam} operation={RuleApplicability.QUIZ} selectedRuleIds={watchedRuleIds ?? []} onSelectionChange={handleRuleSelectionChange} />`

### Phase 2: Flashcard Page (form state exists, just add UI)

- [ ] **Task 5:** Replace ResolvedRulesInfo with RuleSelector in Flashcard page
  - File: `web/src/pages/CreateFlashcardPage/CreateFlashcardPageContainer/CreateFlashcardPageContainer.tsx`
  - Same pattern as Task 4
  - Note: `ruleIds` already in form state

### Phase 3: SlideDeck Page (form state exists, just add UI)

- [ ] **Task 6:** Replace ResolvedRulesInfo with RuleSelector in SlideDeck page
  - File: `web/src/pages/CreateSlideDeckPage/CreateSlideDeckPageContainer/CreateSlideDeckPageContainer.tsx`
  - Same pattern as Task 4
  - Note: `ruleIds` already in form state

### Phase 4: Cleanup

- [ ] **Task 7:** Delete ResolvedRulesInfo component
  - Delete folder: `web/src/components/ResolvedRulesInfo/`
  - Files to remove:
    - `ResolvedRulesInfo.tsx`
    - `IResolvedRulesInfo.ts`
    - `index.ts`

### Phase 5: Validation

- [ ] **Task 8:** Run validation suite
  - Commands:
    ```bash
    NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:typecheck
    NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:lint
    NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:build
    ```

## Testing Strategy
- Manual UI testing in browser
- Verify rule selection persists in form state
- Verify selected rules are sent to API
- Test with/without directory context
- Test reset to defaults functionality

## Expected Outcome
Users can select/deselect rules before generating quizzes, flashcards, and slide decks, giving them control over which rules are applied during content generation.
