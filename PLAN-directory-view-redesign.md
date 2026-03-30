# Plan: Directory View Redesign

## Context

The current `DirectoryDetailPage` uses a vertical stack layout (Sources → Artifacts tabs → Rules accordion → Subfolders) that requires excessive scrolling and separates artifacts from their context. The redesign introduces a **local icon sidebar** within the content area for panel-based navigation, clean source list rows with inline actions, and eliminates the old tab/accordion pattern.

### Constraints & Decisions (from Q&A)

| # | Decision |
|---|---|
| 1 | Content panels replace on same page (React state, no route change) |
| 2 | Subfolder pills navigate to subdirectory (`/directory/:subfolderId`) |
| 3 | No artifacts on source rows — artifacts only via sidebar tabs |
| 4 | Source rows: icon + title + word count + date (minimal metadata) |
| 5 | Rules panel shows rules assigned to current directory |
| 6 | Rules displayed as content panel (same pattern as other tabs) |
| 7 | Generate button moved to each source row (inline dropdown) |
| 8 | Delete (trash) icon on each row, appears on hover |

### Reference Wireframe
`wireframes/D-reference-generate-on-card.html`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Global Sidebar (existing, 64-200px)                           │
│  ┌──────────┬──────────────────────────────────────────────────┐│
│  │          │  Breadcrumb: Directories / ML Course / Ch 3      ││
│  │          │  Subfolder Pills: [📁 Exercises] [📁 Lab Work]   ││
│  │  LOCAL   │  ─────────────────────────────────────────────── ││
│  │  ICON    │  Section Header: Sources (4)    [+ Add source]   ││
│  │  SIDEBAR │  ┌──────────────────────────────────────────────┐││
│  │  (60px)  │  │ 📄 Backprop Guide  24k words · Mar 20  [✨▾][🗑]││
│  │          │  │ 📄 Gradient Desc…  18k words · Mar 18  [✨▾][🗑]││
│  │ Sources  │  │ 📄 Loss Functions   12k words · Mar 15  [✨▾][🗑]││
│  │ Quizzes  │  └──────────────────────────────────────────────┘││
│  │ Cards    │                                                  ││
│  │ Slides   │  (When Quizzes active):                          ││
│  │ ──────── │  Section Header: Quizzes (5)    [+ Create quiz]  ││
│  │ Rules    │  ┌──────────────────────────────────────────────┐││
│  │          │  │ 🧠 Quiz Title    10 questions · Mar 20  [🗑]  ││
│  │          │  │ 🧠 Quiz Title 2   8 questions · Mar 18  [🗑]  ││
│  │          │  └──────────────────────────────────────────────┘││
│  └──────────┴──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Component Tree

```
DirectoryDetailPageContainer.tsx (refactored)
├── DirectoryIconSidebar.tsx          (NEW)
│   └── Icon buttons: Sources, Quizzes, Cards, Slides, Rules
├── Breadcrumb + Subfolder Pills      (existing, moved up)
├── Content Panel (switch by activePanel state)
│   ├── SourcesPanel.tsx              (NEW)
│   │   ├── SourceRow.tsx             (NEW)
│   │   │   ├── Generate dropdown     (NEW)
│   │   │   └── Delete icon (hover)   (existing pattern)
│   │   └── Add source button
│   ├── QuizzesPanel.tsx              (NEW)
│   │   ├── QuizRow.tsx               (NEW)
│   │   └── Delete icon (hover)
│   ├── FlashcardsPanel.tsx           (NEW)
│   │   ├── FlashcardRow.tsx          (NEW)
│   │   └── Delete icon (hover)
│   ├── SlidesPanel.tsx               (NEW)
│   │   ├── SlideRow.tsx              (NEW)
│   │   └── Delete icon (hover)
│   └── RulesPanel.tsx                (NEW)
│       └── Rule cards                (from existing accordion)
├── CreateDirectoryDialog             (existing)
├── DeleteDirectoryDialog             (existing)
├── DeleteDocumentDialog              (existing)
└── DeleteArtifactDialog              (existing)
```

### State Management

```typescript
// Local state in DirectoryDetailPageContainer
const [activePanel, setActivePanel] = useState<'sources' | 'quizzes' | 'flashcards' | 'slides' | 'rules'>('sources');
```

No new RTK Query endpoints needed — `useGetDirectoryContentsWithArtifactsQuery` already returns all data.

---

## Task List

### Phase 1: Scaffold New Components

- [ ] 1.1 Create `DirectoryIconSidebar.tsx` — 60px wide icon sidebar with Sources, Quizzes, Cards, Slides, Rules buttons. Active state highlighted with primary purple.
- [ ] 1.2 Create `SourcesPanel.tsx` — section header with count + Add source button, renders source rows.
- [ ] 1.3 Create `SourceRow.tsx` — list row with icon, title, word count, date, inline Generate dropdown, hover Delete icon.
- [ ] 1.4 Create `QuizzesPanel.tsx` — section header with count + Create quiz button, renders quiz rows.
- [ ] 1.5 Create `FlashcardsPanel.tsx` — section header with count + Create flashcards button, renders flashcard rows.
- [ ] 1.6 Create `SlidesPanel.tsx` — section header with count + Create slides button, renders slide rows.
- [ ] 1.7 Create `RulesPanel.tsx` — section header showing directory-specific rules.

### Phase 2: Refactor DirectoryDetailPageContainer

- [ ] 2.1 Add `activePanel` state (default: `'sources'`)
- [ ] 2.2 Replace current layout (vertical stack) with flex layout: icon sidebar + content panel
- [ ] 2.3 Move breadcrumb + subfolder pills above the flex container
- [ ] 2.4 Remove old `<Tabs>` section for artifacts
- [ ] 2.5 Remove old Rules accordion section
- [ ] 2.6 Remove old Subfolders section (subfolders now shown as pills)
- [ ] 2.7 Remove old Sources card grid (replaced by SourcesPanel)
- [ ] 2.8 Keep header actions (Rules link, Generate dropdown, New subfolder, Add source) — adjust placement
- [ ] 2.9 Wire up DeleteArtifactDialog to all content panels

### Phase 3: Generate Dropdown on Source Rows

- [ ] 3.1 Create inline Generate dropdown in `SourceRow.tsx` — small pill button with `✨ Generate ▾` text
- [ ] 3.2 Dropdown options: Quiz, Flashcards, Slide deck (each navigates to create page with documentId + directoryId)
- [ ] 3.3 Style: purple text (#8B5CF6), transparent bg, subtle border, hover bg change

### Phase 4: Styling & Polish

- [ ] 4.1 Style icon sidebar: 60px width, bg #0A0A0A, border-right, icon-only with labels
- [ ] 4.2 Style source rows: list rows (not cards), hover bg change, delete icon transition
- [ ] 4.3 Style artifact rows: consistent with source rows, type-specific icons
- [ ] 4.4 Style subfolder pills: rounded chips with folder icons
- [ ] 4.5 Ensure responsive behavior (sidebar collapses on mobile)

### Phase 5: Cleanup & Verification

- [ ] 5.1 Run TypeScript check (`yarn nx run web:typecheck`)
- [ ] 5.2 Run lint (`yarn nx run web:lint`)
- [ ] 5.3 Remove unused imports in DirectoryDetailPageContainer
- [ ] 5.4 Visual verification in browser

---

## Out of Scope

- Mobile responsive design (desktop-first for now)
- Drag-and-drop reordering
- Bulk actions (multi-select)
- Search/filter within content panels
- Pagination (existing ARTIFACT_PAGE_LIMIT = 100 stays)
- New API endpoints
- Changes to the global Sidebar component
- Route changes (stays `/directory/:directoryId`)

---

## Testing Strategy

1. **TypeScript + Lint**: Clean build with `yarn nx run web:typecheck` and `yarn nx run web:lint`
2. **Visual Testing**: Run the app, navigate to directory page, verify all 5 content panels render correctly
3. **Interaction Testing**: Verify Generate dropdown, delete icons, sidebar panel switching, subfolder pill navigation
4. **PR Review**: Self-review with `git diff main...HEAD`

---

## Files to Create

| File | Type |
|------|------|
| `web/src/pages/DirectoryDetailPage/DirectoryIconSidebar.tsx` | New |
| `web/src/pages/DirectoryDetailPage/SourcesPanel.tsx` | New |
| `web/src/pages/DirectoryDetailPage/SourceRow.tsx` | New |
| `web/src/pages/DirectoryDetailPage/QuizzesPanel.tsx` | New |
| `web/src/pages/DirectoryDetailPage/FlashcardsPanel.tsx` | New |
| `web/src/pages/DirectoryDetailPage/SlidesPanel.tsx` | New |
| `web/src/pages/DirectoryDetailPage/RulesPanel.tsx` | New |

## Files to Modify

| File | Change |
|------|--------|
| `web/src/pages/DirectoryDetailPage/DirectoryDetailPageContainer.tsx` | Major refactor |

## Files to Keep (unchanged)

| File | Reason |
|------|--------|
| `DeleteArtifactDialog.tsx` | Reused as-is |
| `DeleteDocumentDialog.tsx` | Reused as-is |
| `DirectoryDetailPage.tsx` | Reused as-is |
| `index.ts` | Reused as-is |
