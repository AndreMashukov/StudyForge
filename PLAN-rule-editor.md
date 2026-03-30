# Plan: Rule Editor Page

## Context
- New full-page Rule Editor for creating and editing **global** rules with AI assistance
- Global-only scope — no directory attachment from this page
- Replaces the modal-based workflow with a richer, dedicated editing experience
- Adds AI-powered rule generation via a new Gemini cloud function

## Wireframe Reference
- `/a0/usr/workdir/rule-wireframe-1-create-mode.png` — Create mode (empty form + AI panel)
- `/a0/usr/workdir/rule-wireframe-2-edit-mode.png` — Edit mode (populated form + AI panel)
- `/a0/usr/workdir/rule-wireframe-3-ai-working.png` — AI generating (loading state in panel)
- `/a0/usr/workdir/rule-wireframe-4-ai-done.png` — AI done (generated content shown, apply/discard buttons)

## Architecture

### Route
```
/rules/editor              → create mode (global rule)
/rules/editor/:ruleId     → edit mode (existing global rule)
```

### New Cloud Function: `generateRuleWithAI`
- **Input**: `{ topic: string, description?: string, applicableTo?: RuleApplicability[], existingContent?: string }`
- **Output**: `{ success: true, generatedContent: string, generatedName: string, generatedDescription: string }`
- **Model**: `gemini-3.1-pro-preview` (same as flashcards)
- **Pattern**: Follow flashcards.ts — `onCall`, Zod validation, `GoogleGenAI`, `JsonSanitizer` for response parsing
- **Prompt**: System prompt explaining rule format, user topic, optional existing content for improvement mode

### Frontend Page Structure
```
RuleEditorPage/
├── index.tsx                    # Route component, reads params
├── context/
│   ├── RuleEditorContext.tsx     # State + providers
│   └── hooks/
│       ├── useRuleEditorForm.ts  # Form state, validation, submit
│       └── useAIAssistant.ts     # AI generation state
├── components/
│   ├── RuleEditorContainer.tsx   # Main layout (form + AI panel)
│   ├── RuleFormSection.tsx       # Left: form fields
│   ├── AIAssistantPanel.tsx      # Right: AI input, status, results
│   ├── RuleMarkdownPreview.tsx   # Markdown preview using existing MarkdownRenderer
│   └── RuleEditorHeader.tsx      # Back button, title, save/delete actions
```

### Layout (per wireframes)
- **Left side (~60%)**: Form fields stacked vertically
  - Name (Input)
  - Description (Input, optional)
  - Applicability (toggle buttons, reused pattern)
  - Color (swatch picker, reused pattern)
  - Tags (enter-to-add, reused pattern)
  - Content (Textarea with live Markdown preview toggle)
  - Is Default (checkbox)
- **Right side (~40%)**: AI Assistant Panel
  - Topic/description input
  - "Generate" button
  - Loading state (spinner + progress text)
  - Generated result preview
  - "Apply to Form" / "Discard" buttons
  - "Improve existing" mode when editing

## Task List

### Backend
1. [ ] Create `functions/src/services/gemini/rule-prompt-builder.ts` — prompt template for rule generation
2. [ ] Create `functions/src/endpoints/rule-ai.ts` — `generateRuleWithAI` callable function
3. [ ] Register new function in `functions/src/index.ts`
4. [ ] Add Zod schemas for request/response validation

### Frontend — API Layer
5. [ ] Add `generateRuleWithAI` mutation to `store/api/Rules/rulesApi.ts`
6. [ ] Add RTK Query tag invalidation (`Rules`)

### Frontend — Page
7. [ ] Create `RuleEditorPage/` directory structure
8. [ ] Build `RuleEditorContext` + hooks (`useRuleEditorForm`, `useAIAssistant`)
9. [ ] Build `RuleEditorHeader` (back nav, save/delete actions)
10. [ ] Build `RuleFormSection` (all form fields, reuse patterns from RuleFormModal)
11. [ ] Build `RuleMarkdownPreview` (wrap existing MarkdownRenderer)
12. [ ] Build `AIAssistantPanel` (input, loading, result, apply/discard)
13. [ ] Build `RuleEditorContainer` (two-column layout)
14. [ ] Build `RuleEditorPage/index.tsx` (route param parsing, mode detection)
15. [ ] Add route to `web/src/app/app.tsx`

### Frontend — Navigation Updates
16. [ ] Update `RulesPage` — "Create Rule" button → navigate to `/rules/editor`
17. [ ] Update `RulesPage` — edit action → navigate to `/rules/editor/:ruleId` (replace modal open)

## Out of Scope
- Rule duplication/clone feature
- Drag-to-reorder rules
- Filter UI on RulesPage (exists as dead code, not touching)
- Streaming AI responses (use regular request/response for v1)
- Mobile-responsive AI panel (wireframes show desktop layout; panel collapses on mobile)
- Directory-scoped rule creation from this page (use DirectoryRulesPage for that)

## Testing Strategy
- Browser exploration via Playwright: test create flow, edit flow, AI generation
- Verify: form validation, AI apply/discard, save creates rule, back navigation
- Verify: edit mode loads existing data, AI "improve" mode works

## Constraints (from exploration)
- Must use `<Button>` not native `<button>`
- Must use `useTheme()` for colors, not Tailwind `dark:` classes
- Must use `<Page showSidebar={true}>` wrapper
- Firebase Callable Function pattern (not HTTP)
- RTK Query tags for cache invalidation
- Rule delete blocked while attached to directories — editor must show appropriate UI/error
- Character limit: 15,000 for content (backend validation)
