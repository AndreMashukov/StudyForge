in this app I want to add new feature - "Rules", that would describe how AI should: 1. scrap documents; upload documents; do the text prompt; generate quizzes; the main idea is to have app wide rules; then rules specific to a certain directory; for example if I have directori called "computer Science" then I should be able to create rules for how to learn CS DSA topics which would require for example to generate code for DSA probles solutions. And if I create a folder "Learning Chinese" then a diffrenet set of rules should be applied; 
The rules attached to the directory should cascade to subdirectories; and it should be possible to attach rules to any folder;

We may start with taking a prompts and make them composable of rules; 
Can you elaborate on this and suggest what solution would fit better.

so for now I would like to start with elaborating on creating a "Rules Manager" that would allow to create rules; the rule should have name, content, color, tag, properties; the ui should allow to perfrom CRUD on rules as well view them and filter them by tags; 
For now let's just consider that all rules are global and injected into prompts;
So when performing prompts user should be allowed to choose which rules should be applied,
Please elaborate on how UI might look like for 
1. scrap documents; 
2. upload documents; 
2. do the text prompt; 
3. generate quizzes;
4. generate followups; 
Let's do a Q&A first to elaborate on this  

## Q&A Session on Your Comments

### 1. **Rules Manager Page Filters**
**Comment**: "add filter by RuleApplicability and remove search by name"

**Questions:**
- Should we have a **multi-select dropdown** for RuleApplicability (e.g., "Show: Quiz + Followup rules only")?
- Or separate **pill/chip filters** like: `[All]` `[Scraping]` `[Upload]` `[Prompt]` `[Quiz]` `[Followup]`?
A: multi-select dropdown
- Should we keep the tag filter as well, or just have RuleApplicability filter?
- When both tag filter and applicability filter are active, should they work with AND logic (rule must match BOTH) or OR logic?

---

### 2. **Rule Card Design Simplification**
**Comment**: "let's only maintain default rule indicator, no 'Actions', no 'Order'"

**Questions:**
- How do users **edit or delete** a rule if there are no action buttons on the card?
  - Option A: Click the card to open a modal with Edit/Delete buttons?
  - Option B: Right-click context menu?
  - Option C: Hover to reveal actions?
A: We need to have 'Actions' dropdown on the cards in the "Rules Manager"
  
- Without showing "Order" on the card, how will users know the **injection sequence**? Or do we just hide it completely and let the backend handle ordering automatically?

---

### 3. **Card View Modal Instead of Expansion**
**Comment**: "Don't use Expansion, open a modal for detailed view"

**Questions:**
- When user clicks a rule card, the modal should show:
  - Full rule content (markdown rendered)
  - Description
  - Tags, applicability badges
  - Created/Updated dates
  - **[Edit]** and **[Delete]** buttons?
  
- Should this be a **read-only modal** with just an "Edit" button that opens the edit form? Or should it be the edit form directly?
A: no

---

### 4. **Rule Selector - Remove Clear/Defaults Buttons**
**Comment**: "no need this" (referring to `[Clear] [Defaults]` buttons)

**Questions:**
- How should users quickly **reset to default rules** if they've made custom selections?
  - Just manually uncheck all and re-check defaults?
  - Or add a small "Reset" icon button somewhere else?
A: add a small "Reset" icon button 

- Should we still have the **"Clear All"** functionality, maybe as a link or icon in the header?

---

### 5. **Compact Rule Selector Only**
**Comment**: "use compact version only"

**Questions:**
- Should we use the **compact version** for ALL screen sizes (desktop, tablet, mobile)?
- Or use compact for desktop/tablet and the **bottom sheet** for mobile?
A: yes
- The compact version shows rules with `#1, #2, #3` - should we keep these order numbers or remove them (since you removed order from cards)?
A: remove them

---

### 6. **No Smart Rule Suggestions**
**Comment**: "Smart Rule Suggestion Logic >> no need this"

**Confirmed** - We'll remove the directory-based rule suggestions feature. Users will manually select rules.
A: ahh wait, so let's elaborate on how we ensure that rules are cascading from parent directories to child directories? if ceratain rules were applied to parent directories then those rules should become default rules for child directory


---

### 7. **Quiz Generation - Select Followup Rules Here**
**Comment**: "I think it's a good point to specify rules for quiz followup here in Quiz Generation panel"

**Questions:**
- So on the Document Viewer page sidebar, we'll have:
  - **📋 Quiz Rules** (for generating the quiz)
  - **📋 Followup Rules** (for generating followups during the quiz)
  
- When user generates a quiz, the **followup rules** are saved with the quiz, so when they later click "Generate Followup" during the quiz, it uses the pre-selected rules?
A: yes

- Should followup rules be **required** to generate a quiz, or optional?
A: required

---

### 8. **No Modal for Followup Generation**
**Comment**: "no need to show rules selection on followup generation since we are gonna select them on quiz generation"

**Confirmed** - Followup generation will use the rules selected during quiz generation. The "Generate Followup" button will work immediately without showing a modal.

**Question:**
- Should we show a **toast notification** indicating which rules were used? E.g., "Generated with 2 followup rules: Detailed Explanations, ASCII Diagrams"
A: no

---

### 9. **Create/Edit Rule Form - Remove Order & Active**
**Comment**: "remove 'Order' and 'Active'"

**Questions:**
- If we remove **"Order"** from the form, how should the backend determine injection order?
  - Option A: Auto-assign order based on creation timestamp (older rules = lower order)?
  - Option B: Default all rules to order 1, and let AI handle conflicts?
  - Option C: Use alphabetical order by rule name?
A: we concatenate rule with a delimiter "RULE #{NUMBER}" and then ask AI to prioritize them smartly

- If we remove **"Active"** toggle:
  - Are all rules always active?
  A: yes
  - Or should we add a global "Archive" feature to hide rules instead?
  A: no

---

## Summary of Changes

Based on your comments, here's what I understand we're doing:

### ✅ Confirmed Changes:
1. Add RuleApplicability filter, remove search by name
2. Simplify rule cards - only show default indicator
3. Click card opens modal for full view (not expansion)
4. Remove `[Clear] [Defaults]` buttons from rule selector
5. Use compact rule selector everywhere
6. Remove smart rule suggestions
7. Add followup rules selection in quiz generation panel
8. No modal for followup generation (use pre-selected rules)
9. Remove "Order" and "Active" fields from create/edit form

### ❓ Need Clarification:
1. How users edit/delete rules without action buttons
2. How to handle rule ordering without the Order field
3. Should we keep order numbers (`#1, #2`) in compact selector
4. Toast notification for followup generation rules
5. How to handle inactive/archived rules without "Active" field

Please answer these questions so I can update the specification accordingly! 🚀


AndreMashukov: added some comments to UI SPEC, let's do Q&A to elaborate on that 

GitHub Copilot: I'll help you go through the comments you added to the UI specification document. Let me review them first. 

Read [](file:///Users/andrey/Desktop/projects/code-insights-ai/docs/RULES_UI_SPECIFICATION.md)

Great! I've reviewed all your comments. Let me go through each one and ask clarifying questions to make sure we're aligned on the implementation:

## Q&A Session on Your Comments

### 1. **Rules Manager Page Filters**
**Comment**: "add filter by RuleApplicability and remove search by name"

**Questions:**
- Should we have a **multi-select dropdown** for RuleApplicability (e.g., "Show: Quiz + Followup rules only")?
- Or separate **pill/chip filters** like: `[All]` `[Scraping]` `[Upload]` `[Prompt]` `[Quiz]` `[Followup]`?
- Should we keep the tag filter as well, or just have RuleApplicability filter?
- When both tag filter and applicability filter are active, should they work with AND logic (rule must match BOTH) or OR logic?

---

### 2. **Rule Card Design Simplification**
**Comment**: "let's only maintain default rule indicator, no 'Actions', no 'Order'"

**Questions:**
- How do users **edit or delete** a rule if there are no action buttons on the card?
  - Option A: Click the card to open a modal with Edit/Delete buttons?
  - Option B: Right-click context menu?
  - Option C: Hover to reveal actions?
  
- Without showing "Order" on the card, how will users know the **injection sequence**? Or do we just hide it completely and let the backend handle ordering automatically?

---

### 3. **Card View Modal Instead of Expansion**
**Comment**: "Don't use Expansion, open a modal for detailed view"

**Questions:**
- When user clicks a rule card, the modal should show:
  - Full rule content (markdown rendered)
  - Description
  - Tags, applicability badges
  - Created/Updated dates
  - **[Edit]** and **[Delete]** buttons?
  
- Should this be a **read-only modal** with just an "Edit" button that opens the edit form? Or should it be the edit form directly?

---

### 4. **Rule Selector - Remove Clear/Defaults Buttons**
**Comment**: "no need this" (referring to `[Clear] [Defaults]` buttons)

**Questions:**
- How should users quickly **reset to default rules** if they've made custom selections?
  - Just manually uncheck all and re-check defaults?
  - Or add a small "Reset" icon button somewhere else?

- Should we still have the **"Clear All"** functionality, maybe as a link or icon in the header?

---

### 5. **Compact Rule Selector Only**
**Comment**: "use compact version only"

**Questions:**
- Should we use the **compact version** for ALL screen sizes (desktop, tablet, mobile)?
- Or use compact for desktop/tablet and the **bottom sheet** for mobile?
- The compact version shows rules with `#1, #2, #3` - should we keep these order numbers or remove them (since you removed order from cards)?

---

### 6. **No Smart Rule Suggestions**
**Comment**: "Smart Rule Suggestion Logic >> no need this"

**Confirmed** - We'll remove the directory-based rule suggestions feature. Users will manually select rules.

---

### 7. **Quiz Generation - Select Followup Rules Here**
**Comment**: "I think it's a good point to specify rules for quiz followup here in Quiz Generation panel"

**Questions:**
- So on the Document Viewer page sidebar, we'll have:
  - **📋 Quiz Rules** (for generating the quiz)
  - **📋 Followup Rules** (for generating followups during the quiz)
  
- When user generates a quiz, the **followup rules** are saved with the quiz, so when they later click "Generate Followup" during the quiz, it uses the pre-selected rules?

- Should followup rules be **required** to generate a quiz, or optional?

---

### 8. **No Modal for Followup Generation**
**Comment**: "no need to show rules selection on followup generation since we are gonna select them on quiz generation"

**Confirmed** - Followup generation will use the rules selected during quiz generation. The "Generate Followup" button will work immediately without showing a modal.

**Question:**
- Should we show a **toast notification** indicating which rules were used? E.g., "Generated with 2 followup rules: Detailed Explanations, ASCII Diagrams"

---

### 9. **Create/Edit Rule Form - Remove Order & Active**
**Comment**: "remove 'Order' and 'Active'"

**Questions:**
- If we remove **"Order"** from the form, how should the backend determine injection order?
  - Option A: Auto-assign order based on creation timestamp (older rules = lower order)?
  - Option B: Default all rules to order 1, and let AI handle conflicts?
  - Option C: Use alphabetical order by rule name?

- If we remove **"Active"** toggle:
  - Are all rules always active?
  - Or should we add a global "Archive" feature to hide rules instead?

---

## Summary of Changes

Based on your comments, here's what I understand we're doing:

### ✅ Confirmed Changes:
1. Add RuleApplicability filter, remove search by name
2. Simplify rule cards - only show default indicator
3. Click card opens modal for full view (not expansion)
4. Remove `[Clear] [Defaults]` buttons from rule selector
5. Use compact rule selector everywhere
6. Remove smart rule suggestions
7. Add followup rules selection in quiz generation panel
8. No modal for followup generation (use pre-selected rules)
9. Remove "Order" and "Active" fields from create/edit form

### ❓ Need Clarification:
1. How users edit/delete rules without action buttons
2. How to handle rule ordering without the Order field
3. Should we keep order numbers (`#1, #2`) in compact selector
4. Toast notification for followup generation rules
5. How to handle inactive/archived rules without "Active" field

Please answer these questions so I can update the specification accordingly! 🚀

AndreMashukov: 
## Q&A Session on Your Comments

### 1. **Rules Manager Page Filters**
**Comment**: "add filter by RuleApplicability and remove search by name"

**Questions:**
- Should we have a **multi-select dropdown** for RuleApplicability (e.g., "Show: Quiz + Followup rules only")?
- Or separate **pill/chip filters** like: `[All]` `[Scraping]` `[Upload]` `[Prompt]` `[Quiz]` `[Followup]`?
A: multi-select dropdown
- Should we keep the tag filter as well, or just have RuleApplicability filter?
- When both tag filter and applicability filter are active, should they work with AND logic (rule must match BOTH) or OR logic?

---

### 2. **Rule Card Design Simplification**
**Comment**: "let's only maintain default rule indicator, no 'Actions', no 'Order'"

**Questions:**
- How do users **edit or delete** a rule if there are no action buttons on the card?
  - Option A: Click the card to open a modal with Edit/Delete buttons?
  - Option B: Right-click context menu?
  - Option C: Hover to reveal actions?
A: We need to have 'Actions' dropdown on the cards in the "Rules Manager"
  
- Without showing "Order" on the card, how will users know the **injection sequence**? Or do we just hide it completely and let the backend handle ordering automatically?

---

### 3. **Card View Modal Instead of Expansion**
**Comment**: "Don't use Expansion, open a modal for detailed view"

**Questions:**
- When user clicks a rule card, the modal should show:
  - Full rule content (markdown rendered)
  - Description
  - Tags, applicability badges
  - Created/Updated dates
  - **[Edit]** and **[Delete]** buttons?
  
- Should this be a **read-only modal** with just an "Edit" button that opens the edit form? Or should it be the edit form directly?
A: no

---

### 4. **Rule Selector - Remove Clear/Defaults Buttons**
**Comment**: "no need this" (referring to `[Clear] [Defaults]` buttons)

**Questions:**
- How should users quickly **reset to default rules** if they've made custom selections?
  - Just manually uncheck all and re-check defaults?
  - Or add a small "Reset" icon button somewhere else?
A: add a small "Reset" icon button 

- Should we still have the **"Clear All"** functionality, maybe as a link or icon in the header?

---

### 5. **Compact Rule Selector Only**
**Comment**: "use compact version only"

**Questions:**
- Should we use the **compact version** for ALL screen sizes (desktop, tablet, mobile)?
- Or use compact for desktop/tablet and the **bottom sheet** for mobile?
A: yes
- The compact version shows rules with `#1, #2, #3` - should we keep these order numbers or remove them (since you removed order from cards)?
A: remove them

---

### 6. **No Smart Rule Suggestions**
**Comment**: "Smart Rule Suggestion Logic >> no need this"

**Confirmed** - We'll remove the directory-based rule suggestions feature. Users will manually select rules.
A: ahh wait, so let's elaborate on how we ensure that rules are cascading from parent directories to child directories? if ceratain rules were applied to parent directories then those rules should become default rules for child directory


---

### 7. **Quiz Generation - Select Followup Rules Here**
**Comment**: "I think it's a good point to specify rules for quiz followup here in Quiz Generation panel"

**Questions:**
- So on the Document Viewer page sidebar, we'll have:
  - **📋 Quiz Rules** (for generating the quiz)
  - **📋 Followup Rules** (for generating followups during the quiz)
  
- When user generates a quiz, the **followup rules** are saved with the quiz, so when they later click "Generate Followup" during the quiz, it uses the pre-selected rules?
A: yes

- Should followup rules be **required** to generate a quiz, or optional?
A: required

---

### 8. **No Modal for Followup Generation**
**Comment**: "no need to show rules selection on followup generation since we are gonna select them on quiz generation"

**Confirmed** - Followup generation will use the rules selected during quiz generation. The "Generate Followup" button will work immediately without showing a modal.

**Question:**
- Should we show a **toast notification** indicating which rules were used? E.g., "Generated with 2 followup rules: Detailed Explanations, ASCII Diagrams"
A: no

---

### 9. **Create/Edit Rule Form - Remove Order & Active**
**Comment**: "remove 'Order' and 'Active'"

**Questions:**
- If we remove **"Order"** from the form, how should the backend determine injection order?
  - Option A: Auto-assign order based on creation timestamp (older rules = lower order)?
  - Option B: Default all rules to order 1, and let AI handle conflicts?
  - Option C: Use alphabetical order by rule name?
A: we concatenate rule with a delimiter "RULE #{NUMBER}" and then ask AI to prioritize them smartly

- If we remove **"Active"** toggle:
  - Are all rules always active?
  A: yes
  - Or should we add a global "Archive" feature to hide rules instead?
  A: no

---

### Question 1: **Rule Scope Levels**

You want rules that cascade from parent to child directories. Let me clarify the architecture:

**Scenario:**
```
Root/
├── Computer Science/
│   ├── DSA/
│   │   └── Sorting/
│   └── Web Development/
└── Languages/
    └── Chinese/
```

**Questions:**

**A)** Should we have **TWO types of rules**?
- **Global Rules**: Apply to entire workspace (what we have in Phase 1)
- **Directory Rules**: Apply to specific directory + children
A: let's stick only with Directory Rule, no Global rules

**B)** Or should we modify the current Rule model to have an **optional `directoryId` field**?
- If `directoryId` is `null` → Global rule
- If `directoryId` is set → Directory-specific rule
A: If `directoryId` is set → Directory-specific rule

**C)** Rule Attachment Behavior:
When a user attaches rules to "Computer Science" folder:
- Do these rules become **default-selected** for operations in child directories?
A: yes
- Or do they **automatically inject** (user can't deselect them)?
- Or do they appear as **suggestions** that user can accept/reject?

---

### Question 2: **Directory Rule UI/UX**

**Where should users manage directory-specific rules?**

**Option A: Directory Context Menu**
```
[Right-click on "Computer Science" folder]
↓
Context Menu:
- Rename Directory
- Delete Directory
- ⚙️ Manage Directory Rules  ← Opens modal
```

**Option B: Directory Settings Page**
```
[Click settings icon on directory in library]
↓
Navigate to /directories/:id/settings
Shows:
- Directory name/description
- 📋 Directory Rules section
```

**Option C: Rules Manager with Directory Filter**
```
Rules Manager page has additional filter:
[Scope: Global ▼] [Directory: All ▼]
- Select specific directory to see its rules
- Create new rule → Choose scope (Global or Directory-specific)
```

**Which approach do you prefer?** Or a combination?

A: Option B;

---

### Question 3: **Rule Inheritance & Override Logic**

**Scenario:** User creates document in `Computer Science/DSA/Sorting/`

**Which rules should be available?**

**Option A: Additive Inheritance (All Rules Merged)**
```
Available Rules:
1. Global rules (workspace-wide)
2. Rules from "Computer Science"
3. Rules from "Computer Science/DSA"
4. Rules from "Computer Science/DSA/Sorting"

All are available, defaults are pre-selected.
```

**Option B: Cascade with Override (Child Replaces Parent)**
```
Priority order:
1. Check "Sorting" → If has rules, use those
2. If no rules, check "DSA"
3. If no rules, check "Computer Science"
4. If no rules, use Global rules

Only ONE level of rules applies at a time.
```

**Option C: Hybrid (Global + Nearest Directory)**
```
Available Rules:
1. Global rules (always included)
2. Rules from closest parent directory that has rules

Example: If "Sorting" has no rules but "DSA" has rules,
show Global + DSA rules.
```


**Which inheritance model should we implement?**
A: option A
---

### Question 4: **Default Rule Selection Logic**

When a rule is marked as `isDefault: true`:

**Question:** Should "default" mean:
- **A)** Auto-selected in the rule selector by default (user can uncheck)
- **B)** Auto-selected AND always checked (user cannot uncheck global defaults, only directory-specific ones)
- **C)** Auto-selected, and the scope matters:
  - Global defaults apply everywhere
  - Directory defaults only apply in that directory + children

**Which behavior do you want?**
Option: C
---

### Question 5: **Data Model Changes**

To support directory rules, we need to update the Rule model:

```typescript
export interface Rule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  content: string;
  color: RuleColor;
  tags: string[];
  applicableTo: RuleApplicability[];
  isDefault: boolean;
  
  // NEW FIELDS for Phase 2:
  scope: 'global' | 'directory';  // Rule scope
  directoryId?: string;           // Optional: which directory this rule applies to
  
  createdAt: Date;
  updatedAt: Date;
}
```

**Questions:**
- Should we allow a rule to be attached to **multiple directories** at once?
  - If yes, change `directoryId?: string` to `directoryIds?: string[]`
A: yes
- Should directory rules be **visible in the global Rules Manager**?
  - Or should they only appear when viewing that directory's settings?
A: only appear when viewing that directory's settings

---

### Question 6: **Migration & Backwards Compatibility**

**Current State (Phase 1):** All rules are global.
A: no global rules

**Phase 2:** We introduce directory-specific rules.

**Questions:**
- Should all existing Phase 1 rules automatically become `scope: 'global'`?
- Should we provide a **"Convert to Directory Rule"** feature in Rules Manager?
  - User clicks "Move to Directory" → selects a directory → rule becomes directory-specific

---

### Question 7: **Visual Indicators**

**In the Rules Manager, how should we visually distinguish between rule types?**

**Option A: Scope Badge**
```
┌──────────────────────────────────────────────┐
│ DSA Code Examples  [Global]      [Actions ▼]│  ← Badge shows scope
│ [Quiz] [Prompt]  🏷️ DSA, Code              │
│ Default Rule                                  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Chinese Examples  [CS/Chinese]   [Actions ▼]│  ← Shows directory path
│ [Quiz] [Prompt]  🏷️ Language                │
│ Default Rule                                  │
└──────────────────────────────────────────────┘
```

**Option B: Section Grouping**
```
Rules Manager:

══════════ GLOBAL RULES ══════════
[DSA Code Examples]
[ASCII Diagrams]

══════════ DIRECTORY RULES ══════════
📁 Computer Science
  - CS Code Examples
  - Academic Style

📁 Languages / Chinese
  - Chinese Character Rules
```
A: option B (no global rules)

**Which visual approach do you prefer?**

---

### Question 8: **Rule Selection UI with Directory Context**

When generating a document in `Computer Science/DSA/`, the rule selector should show:

**Option A: Flat List with Scope Labels**
```
📋 Rules (3 selected)      [Manage Rules]
─────────────────────────────────────────

[DSA Code ×] [Clean MD ×] [Academic ×]

Available Rules:
☑ DSA Code Examples         [Global]
☑ Clean Markdown            [Global]
☑ Academic Style            [CS]
☐ Web Dev Rules             [CS/Web]  ← Grayed (not in current path)
```

**Option B: Grouped by Source**
```
📋 Rules (3 selected)      [Manage Rules]
─────────────────────────────────────────

[DSA Code ×] [Clean MD ×] [Academic ×]

Available Rules:

Global Rules:
☑ DSA Code Examples
☑ Clean Markdown

Directory Rules (Computer Science):
☑ Academic Style

Directory Rules (Computer Science/DSA):
☐ Advanced DSA
```

**Which layout makes more sense for users?**
A: option A
---



AndreMashukov: added some comments to UI SPEC, let's do Q&A to elaborate on that 

GitHub Copilot: I'll help you go through the comments you added to the UI specification document. Let me review them first. 

Read [](file:///Users/andrey/Desktop/projects/code-insights-ai/docs/RULES_UI_SPECIFICATION.md)

Great! I've reviewed all your comments. Let me go through each one and ask clarifying questions to make sure we're aligned on the implementation:

## Q&A Session on Your Comments

### 1. **Rules Manager Page Filters**
**Comment**: "add filter by RuleApplicability and remove search by name"

**Questions:**
- Should we have a **multi-select dropdown** for RuleApplicability (e.g., "Show: Quiz + Followup rules only")?
- Or separate **pill/chip filters** like: `[All]` `[Scraping]` `[Upload]` `[Prompt]` `[Quiz]` `[Followup]`?
- Should we keep the tag filter as well, or just have RuleApplicability filter?
- When both tag filter and applicability filter are active, should they work with AND logic (rule must match BOTH) or OR logic?

---

### 2. **Rule Card Design Simplification**
**Comment**: "let's only maintain default rule indicator, no 'Actions', no 'Order'"

**Questions:**
- How do users **edit or delete** a rule if there are no action buttons on the card?
  - Option A: Click the card to open a modal with Edit/Delete buttons?
  - Option B: Right-click context menu?
  - Option C: Hover to reveal actions?
  
- Without showing "Order" on the card, how will users know the **injection sequence**? Or do we just hide it completely and let the backend handle ordering automatically?

---

### 3. **Card View Modal Instead of Expansion**
**Comment**: "Don't use Expansion, open a modal for detailed view"

**Questions:**
- When user clicks a rule card, the modal should show:
  - Full rule content (markdown rendered)
  - Description
  - Tags, applicability badges
  - Created/Updated dates
  - **[Edit]** and **[Delete]** buttons?
  
- Should this be a **read-only modal** with just an "Edit" button that opens the edit form? Or should it be the edit form directly?

---

### 4. **Rule Selector - Remove Clear/Defaults Buttons**
**Comment**: "no need this" (referring to `[Clear] [Defaults]` buttons)

**Questions:**
- How should users quickly **reset to default rules** if they've made custom selections?
  - Just manually uncheck all and re-check defaults?
  - Or add a small "Reset" icon button somewhere else?

- Should we still have the **"Clear All"** functionality, maybe as a link or icon in the header?

---

### 5. **Compact Rule Selector Only**
**Comment**: "use compact version only"

**Questions:**
- Should we use the **compact version** for ALL screen sizes (desktop, tablet, mobile)?
- Or use compact for desktop/tablet and the **bottom sheet** for mobile?
- The compact version shows rules with `#1, #2, #3` - should we keep these order numbers or remove them (since you removed order from cards)?

---

### 6. **No Smart Rule Suggestions**
**Comment**: "Smart Rule Suggestion Logic >> no need this"

**Confirmed** - We'll remove the directory-based rule suggestions feature. Users will manually select rules.

---

### 7. **Quiz Generation - Select Followup Rules Here**
**Comment**: "I think it's a good point to specify rules for quiz followup here in Quiz Generation panel"

**Questions:**
- So on the Document Viewer page sidebar, we'll have:
  - **📋 Quiz Rules** (for generating the quiz)
  - **📋 Followup Rules** (for generating followups during the quiz)
  
- When user generates a quiz, the **followup rules** are saved with the quiz, so when they later click "Generate Followup" during the quiz, it uses the pre-selected rules?

- Should followup rules be **required** to generate a quiz, or optional?

---

### 8. **No Modal for Followup Generation**
**Comment**: "no need to show rules selection on followup generation since we are gonna select them on quiz generation"

**Confirmed** - Followup generation will use the rules selected during quiz generation. The "Generate Followup" button will work immediately without showing a modal.

**Question:**
- Should we show a **toast notification** indicating which rules were used? E.g., "Generated with 2 followup rules: Detailed Explanations, ASCII Diagrams"

---

### 9. **Create/Edit Rule Form - Remove Order & Active**
**Comment**: "remove 'Order' and 'Active'"

**Questions:**
- If we remove **"Order"** from the form, how should the backend determine injection order?
  - Option A: Auto-assign order based on creation timestamp (older rules = lower order)?
  - Option B: Default all rules to order 1, and let AI handle conflicts?
  - Option C: Use alphabetical order by rule name?

- If we remove **"Active"** toggle:
  - Are all rules always active?
  - Or should we add a global "Archive" feature to hide rules instead?

---

## Summary of Changes

Based on your comments, here's what I understand we're doing:

### ✅ Confirmed Changes:
1. Add RuleApplicability filter, remove search by name
2. Simplify rule cards - only show default indicator
3. Click card opens modal for full view (not expansion)
4. Remove `[Clear] [Defaults]` buttons from rule selector
5. Use compact rule selector everywhere
6. Remove smart rule suggestions
7. Add followup rules selection in quiz generation panel
8. No modal for followup generation (use pre-selected rules)
9. Remove "Order" and "Active" fields from create/edit form

### ❓ Need Clarification:
1. How users edit/delete rules without action buttons
2. How to handle rule ordering without the Order field
3. Should we keep order numbers (`#1, #2`) in compact selector
4. Toast notification for followup generation rules
5. How to handle inactive/archived rules without "Active" field

Please answer these questions so I can update the specification accordingly! 🚀

AndreMashukov: 
## Q&A Session on Your Comments

### 1. **Rules Manager Page Filters**
**Comment**: "add filter by RuleApplicability and remove search by name"

**Questions:**
- Should we have a **multi-select dropdown** for RuleApplicability (e.g., "Show: Quiz + Followup rules only")?
- Or separate **pill/chip filters** like: `[All]` `[Scraping]` `[Upload]` `[Prompt]` `[Quiz]` `[Followup]`?
A: multi-select dropdown
- Should we keep the tag filter as well, or just have RuleApplicability filter?
- When both tag filter and applicability filter are active, should they work with AND logic (rule must match BOTH) or OR logic?

---

### 2. **Rule Card Design Simplification**
**Comment**: "let's only maintain default rule indicator, no 'Actions', no 'Order'"

**Questions:**
- How do users **edit or delete** a rule if there are no action buttons on the card?
  - Option A: Click the card to open a modal with Edit/Delete buttons?
  - Option B: Right-click context menu?
  - Option C: Hover to reveal actions?
A: We need to have 'Actions' dropdown on the cards in the "Rules Manager"
  
- Without showing "Order" on the card, how will users know the **injection sequence**? Or do we just hide it completely and let the backend handle ordering automatically?

---

### 3. **Card View Modal Instead of Expansion**
**Comment**: "Don't use Expansion, open a modal for detailed view"

**Questions:**
- When user clicks a rule card, the modal should show:
  - Full rule content (markdown rendered)
  - Description
  - Tags, applicability badges
  - Created/Updated dates
  - **[Edit]** and **[Delete]** buttons?
  
- Should this be a **read-only modal** with just an "Edit" button that opens the edit form? Or should it be the edit form directly?
A: no

---

### 4. **Rule Selector - Remove Clear/Defaults Buttons**
**Comment**: "no need this" (referring to `[Clear] [Defaults]` buttons)

**Questions:**
- How should users quickly **reset to default rules** if they've made custom selections?
  - Just manually uncheck all and re-check defaults?
  - Or add a small "Reset" icon button somewhere else?
A: add a small "Reset" icon button 

- Should we still have the **"Clear All"** functionality, maybe as a link or icon in the header?

---

### 5. **Compact Rule Selector Only**
**Comment**: "use compact version only"

**Questions:**
- Should we use the **compact version** for ALL screen sizes (desktop, tablet, mobile)?
- Or use compact for desktop/tablet and the **bottom sheet** for mobile?
A: yes
- The compact version shows rules with `#1, #2, #3` - should we keep these order numbers or remove them (since you removed order from cards)?
A: remove them

---

### 6. **No Smart Rule Suggestions**
**Comment**: "Smart Rule Suggestion Logic >> no need this"

**Confirmed** - We'll remove the directory-based rule suggestions feature. Users will manually select rules.
A: ahh wait, so let's elaborate on how we ensure that rules are cascading from parent directories to child directories? if ceratain rules were applied to parent directories then those rules should become default rules for child directory


---

### 7. **Quiz Generation - Select Followup Rules Here**
**Comment**: "I think it's a good point to specify rules for quiz followup here in Quiz Generation panel"

**Questions:**
- So on the Document Viewer page sidebar, we'll have:
  - **📋 Quiz Rules** (for generating the quiz)
  - **📋 Followup Rules** (for generating followups during the quiz)
  
- When user generates a quiz, the **followup rules** are saved with the quiz, so when they later click "Generate Followup" during the quiz, it uses the pre-selected rules?
A: yes

- Should followup rules be **required** to generate a quiz, or optional?
A: required

---

### 8. **No Modal for Followup Generation**
**Comment**: "no need to show rules selection on followup generation since we are gonna select them on quiz generation"

**Confirmed** - Followup generation will use the rules selected during quiz generation. The "Generate Followup" button will work immediately without showing a modal.

**Question:**
- Should we show a **toast notification** indicating which rules were used? E.g., "Generated with 2 followup rules: Detailed Explanations, ASCII Diagrams"
A: no

---

### 9. **Create/Edit Rule Form - Remove Order & Active**
**Comment**: "remove 'Order' and 'Active'"

**Questions:**
- If we remove **"Order"** from the form, how should the backend determine injection order?
  - Option A: Auto-assign order based on creation timestamp (older rules = lower order)?
  - Option B: Default all rules to order 1, and let AI handle conflicts?
  - Option C: Use alphabetical order by rule name?
A: we concatenate rule with a delimiter "RULE #{NUMBER}" and then ask AI to prioritize them smartly

- If we remove **"Active"** toggle:
  - Are all rules always active?
  A: yes
  - Or should we add a global "Archive" feature to hide rules instead?
  A: no

---


GitHub Copilot: Excellent! I have all the answers I need. Now let me ask follow-up questions about the **directory-based rule cascading** feature you mentioned in #6. This is a critical architectural decision that affects Phase 2:

## Follow-up Q&A: Directory Rule Cascading

### Question 1: **Rule Scope Levels**

You want rules that cascade from parent to child directories. Let me clarify the architecture:

**Scenario:**
```
Root/
├── Computer Science/
│   ├── DSA/
│   │   └── Sorting/
│   └── Web Development/
└── Languages/
    └── Chinese/
```

**Questions:**

**A)** Should we have **TWO types of rules**?
- **Global Rules**: Apply to entire workspace (what we have in Phase 1)
- **Directory Rules**: Apply to specific directory + children

**B)** Or should we modify the current Rule model to have an **optional `directoryId` field**?
- If `directoryId` is `null` → Global rule
- If `directoryId` is set → Directory-specific rule

**C)** Rule Attachment Behavior:
When a user attaches rules to "Computer Science" folder:
- Do these rules become **default-selected** for operations in child directories?
- Or do they **automatically inject** (user can't deselect them)?
- Or do they appear as **suggestions** that user can accept/reject?

---

### Question 2: **Directory Rule UI/UX**

**Where should users manage directory-specific rules?**

**Option A: Directory Context Menu**
```
[Right-click on "Computer Science" folder]
↓
Context Menu:
- Rename Directory
- Delete Directory
- ⚙️ Manage Directory Rules  ← Opens modal
```

**Option B: Directory Settings Page**
```
[Click settings icon on directory in library]
↓
Navigate to /directories/:id/settings
Shows:
- Directory name/description
- 📋 Directory Rules section
```

**Option C: Rules Manager with Directory Filter**
```
Rules Manager page has additional filter:
[Scope: Global ▼] [Directory: All ▼]
- Select specific directory to see its rules
- Create new rule → Choose scope (Global or Directory-specific)
```

**Which approach do you prefer?** Or a combination?

---

### Question 3: **Rule Inheritance & Override Logic**

**Scenario:** User creates document in `Computer Science/DSA/Sorting/`

**Which rules should be available?**

**Option A: Additive Inheritance (All Rules Merged)**
```
Available Rules:
1. Global rules (workspace-wide)
2. Rules from "Computer Science"
3. Rules from "Computer Science/DSA"
4. Rules from "Computer Science/DSA/Sorting"

All are available, defaults are pre-selected.
```

**Option B: Cascade with Override (Child Replaces Parent)**
```
Priority order:
1. Check "Sorting" → If has rules, use those
2. If no rules, check "DSA"
3. If no rules, check "Computer Science"
4. If no rules, use Global rules

Only ONE level of rules applies at a time.
```

**Option C: Hybrid (Global + Nearest Directory)**
```
Available Rules:
1. Global rules (always included)
2. Rules from closest parent directory that has rules

Example: If "Sorting" has no rules but "DSA" has rules,
show Global + DSA rules.
```

**Which inheritance model should we implement?**

---

### Question 4: **Default Rule Selection Logic**

When a rule is marked as `isDefault: true`:

**Question:** Should "default" mean:
- **A)** Auto-selected in the rule selector by default (user can uncheck)
- **B)** Auto-selected AND always checked (user cannot uncheck global defaults, only directory-specific ones)
- **C)** Auto-selected, and the scope matters:
  - Global defaults apply everywhere
  - Directory defaults only apply in that directory + children

**Which behavior do you want?**

---

### Question 5: **Data Model Changes**

To support directory rules, we need to update the Rule model:

```typescript
export interface Rule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  content: string;
  color: RuleColor;
  tags: string[];
  applicableTo: RuleApplicability[];
  isDefault: boolean;
  
  // NEW FIELDS for Phase 2:
  scope: 'global' | 'directory';  // Rule scope
  directoryId?: string;           // Optional: which directory this rule applies to
  
  createdAt: Date;
  updatedAt: Date;
}
```

**Questions:**
- Should we allow a rule to be attached to **multiple directories** at once?
  - If yes, change `directoryId?: string` to `directoryIds?: string[]`
- Should directory rules be **visible in the global Rules Manager**?
  - Or should they only appear when viewing that directory's settings?

---

### Question 6: **Migration & Backwards Compatibility**

**Current State (Phase 1):** All rules are global.

**Phase 2:** We introduce directory-specific rules.

**Questions:**
- Should all existing Phase 1 rules automatically become `scope: 'global'`?
- Should we provide a **"Convert to Directory Rule"** feature in Rules Manager?
  - User clicks "Move to Directory" → selects a directory → rule becomes directory-specific

---

### Question 7: **Visual Indicators**

**In the Rules Manager, how should we visually distinguish between rule types?**

**Option A: Scope Badge**
```
┌──────────────────────────────────────────────┐
│ DSA Code Examples  [Global]      [Actions ▼]│  ← Badge shows scope
│ [Quiz] [Prompt]  🏷️ DSA, Code              │
│ Default Rule                                  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Chinese Examples  [CS/Chinese]   [Actions ▼]│  ← Shows directory path
│ [Quiz] [Prompt]  🏷️ Language                │
│ Default Rule                                  │
└──────────────────────────────────────────────┘
```

**Option B: Section Grouping**
```
Rules Manager:

══════════ GLOBAL RULES ══════════
[DSA Code Examples]
[ASCII Diagrams]

══════════ DIRECTORY RULES ══════════
📁 Computer Science
  - CS Code Examples
  - Academic Style

📁 Languages / Chinese
  - Chinese Character Rules
```

**Which visual approach do you prefer?**

---

### Question 8: **Rule Selection UI with Directory Context**

When generating a document in `Computer Science/DSA/`, the rule selector should show:

**Option A: Flat List with Scope Labels**
```
📋 Rules (3 selected)      [Manage Rules]
─────────────────────────────────────────

[DSA Code ×] [Clean MD ×] [Academic ×]

Available Rules:
☑ DSA Code Examples         [Global]
☑ Clean Markdown            [Global]
☑ Academic Style            [CS]
☐ Web Dev Rules             [CS/Web]  ← Grayed (not in current path)
```

**Option B: Grouped by Source**
```
📋 Rules (3 selected)      [Manage Rules]
─────────────────────────────────────────

[DSA Code ×] [Clean MD ×] [Academic ×]

Available Rules:

Global Rules:
☑ DSA Code Examples
☑ Clean Markdown

Directory Rules (Computer Science):
☑ Academic Style

Directory Rules (Computer Science/DSA):
☐ Advanced DSA
```

**Which layout makes more sense for users?**

---

## Summary: What I Need to Know

To finalize the Phase 2 design for directory-based rules, please answer:

1. **Rule Scope**: Global + Directory with optional `directoryId`? Or separate rule types?
2. **UI Location**: Where do users manage directory rules? (Context menu, Settings page, or Rules Manager?)
3. **Inheritance Logic**: Additive (all parent rules), Override (nearest only), or Hybrid?
4. **Default Behavior**: How do directory defaults interact with global defaults?
5. **Data Model**: Single or multiple directory attachment per rule?
6. **Visual Design**: How to distinguish global vs directory rules in UI?
7. **Rule Selector**: Flat list or grouped by scope?

Once you answer these, I'll update the full specification with both **Phase 1 (Global Rules)** and **Phase 2 (Directory Rules)** architecture! 🚀

AndreMashukov: 
### Question 1: **Rule Scope Levels**

You want rules that cascade from parent to child directories. Let me clarify the architecture:

**Scenario:**
```
Root/
├── Computer Science/
│   ├── DSA/
│   │   └── Sorting/
│   └── Web Development/
└── Languages/
    └── Chinese/
```

**Questions:**

**A)** Should we have **TWO types of rules**?
- **Global Rules**: Apply to entire workspace (what we have in Phase 1)
- **Directory Rules**: Apply to specific directory + children
A: let's stick only with Directory Rule, no Global rules

**B)** Or should we modify the current Rule model to have an **optional `directoryId` field**?
- If `directoryId` is `null` → Global rule
- If `directoryId` is set → Directory-specific rule
A: If `directoryId` is set → Directory-specific rule

**C)** Rule Attachment Behavior:
When a user attaches rules to "Computer Science" folder:
- Do these rules become **default-selected** for operations in child directories?
A: yes
- Or do they **automatically inject** (user can't deselect them)?
- Or do they appear as **suggestions** that user can accept/reject?

---

### Question 2: **Directory Rule UI/UX**

**Where should users manage directory-specific rules?**

**Option A: Directory Context Menu**
```
[Right-click on "Computer Science" folder]
↓
Context Menu:
- Rename Directory
- Delete Directory
- ⚙️ Manage Directory Rules  ← Opens modal
```

**Option B: Directory Settings Page**
```
[Click settings icon on directory in library]
↓
Navigate to /directories/:id/settings
Shows:
- Directory name/description
- 📋 Directory Rules section
```

**Option C: Rules Manager with Directory Filter**
```
Rules Manager page has additional filter:
[Scope: Global ▼] [Directory: All ▼]
- Select specific directory to see its rules
- Create new rule → Choose scope (Global or Directory-specific)
```

**Which approach do you prefer?** Or a combination?

A: Option B;

---

### Question 3: **Rule Inheritance & Override Logic**

**Scenario:** User creates document in `Computer Science/DSA/Sorting/`

**Which rules should be available?**

**Option A: Additive Inheritance (All Rules Merged)**
```
Available Rules:
1. Global rules (workspace-wide)
2. Rules from "Computer Science"
3. Rules from "Computer Science/DSA"
4. Rules from "Computer Science/DSA/Sorting"

All are available, defaults are pre-selected.
```

**Option B: Cascade with Override (Child Replaces Parent)**
```
Priority order:
1. Check "Sorting" → If has rules, use those
2. If no rules, check "DSA"
3. If no rules, check "Computer Science"
4. If no rules, use Global rules

Only ONE level of rules applies at a time.
```

**Option C: Hybrid (Global + Nearest Directory)**
```
Available Rules:
1. Global rules (always included)
2. Rules from closest parent directory that has rules

Example: If "Sorting" has no rules but "DSA" has rules,
show Global + DSA rules.
```


**Which inheritance model should we implement?**
A: option A
---

### Question 4: **Default Rule Selection Logic**

When a rule is marked as `isDefault: true`:

**Question:** Should "default" mean:
- **A)** Auto-selected in the rule selector by default (user can uncheck)
- **B)** Auto-selected AND always checked (user cannot uncheck global defaults, only directory-specific ones)
- **C)** Auto-selected, and the scope matters:
  - Global defaults apply everywhere
  - Directory defaults only apply in that directory + children

**Which behavior do you want?**
Option: C
---

### Question 5: **Data Model Changes**

To support directory rules, we need to update the Rule model:

```typescript
export interface Rule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  content: string;
  color: RuleColor;
  tags: string[];
  applicableTo: RuleApplicability[];
  isDefault: boolean;
  
  // NEW FIELDS for Phase 2:
  scope: 'global' | 'directory';  // Rule scope
  directoryId?: string;           // Optional: which directory this rule applies to
  
  createdAt: Date;
  updatedAt: Date;
}
```

**Questions:**
- Should we allow a rule to be attached to **multiple directories** at once?
  - If yes, change `directoryId?: string` to `directoryIds?: string[]`
A: yes
- Should directory rules be **visible in the global Rules Manager**?
  - Or should they only appear when viewing that directory's settings?
A: only appear when viewing that directory's settings

---

### Question 6: **Migration & Backwards Compatibility**

**Current State (Phase 1):** All rules are global.
A: no global rules

**Phase 2:** We introduce directory-specific rules.

**Questions:**
- Should all existing Phase 1 rules automatically become `scope: 'global'`?
- Should we provide a **"Convert to Directory Rule"** feature in Rules Manager?
  - User clicks "Move to Directory" → selects a directory → rule becomes directory-specific

---

### Question 7: **Visual Indicators**

**In the Rules Manager, how should we visually distinguish between rule types?**

**Option A: Scope Badge**
```
┌──────────────────────────────────────────────┐
│ DSA Code Examples  [Global]      [Actions ▼]│  ← Badge shows scope
│ [Quiz] [Prompt]  🏷️ DSA, Code              │
│ Default Rule                                  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Chinese Examples  [CS/Chinese]   [Actions ▼]│  ← Shows directory path
│ [Quiz] [Prompt]  🏷️ Language                │
│ Default Rule                                  │
└──────────────────────────────────────────────┘
```

**Option B: Section Grouping**
```
Rules Manager:

══════════ GLOBAL RULES ══════════
[DSA Code Examples]
[ASCII Diagrams]

══════════ DIRECTORY RULES ══════════
📁 Computer Science
  - CS Code Examples
  - Academic Style

📁 Languages / Chinese
  - Chinese Character Rules
```
A: option B (no global rules)

**Which visual approach do you prefer?**

---

### Question 8: **Rule Selection UI with Directory Context**

When generating a document in `Computer Science/DSA/`, the rule selector should show:

**Option A: Flat List with Scope Labels**
```
📋 Rules (3 selected)      [Manage Rules]
─────────────────────────────────────────

[DSA Code ×] [Clean MD ×] [Academic ×]

Available Rules:
☑ DSA Code Examples         [Global]
☑ Clean Markdown            [Global]
☑ Academic Style            [CS]
☐ Web Dev Rules             [CS/Web]  ← Grayed (not in current path)
```

**Option B: Grouped by Source**
```
📋 Rules (3 selected)      [Manage Rules]
─────────────────────────────────────────

[DSA Code ×] [Clean MD ×] [Academic ×]

Available Rules:

Global Rules:
☑ DSA Code Examples
☑ Clean Markdown

Directory Rules (Computer Science):
☑ Academic Style

Directory Rules (Computer Science/DSA):
☐ Advanced DSA
```

**Which layout makes more sense for users?**
A: option A
---


GitHub Copilot: Perfect! Now I have complete clarity on the architecture. Let me ask a few final clarifying questions to nail down the implementation details:

## Final Clarification Questions

### Question 1: **Root Directory Rules**

Since we're removing global rules, what about documents created at the **root level** (not in any directory)?

**Scenario:**
```
Root/
├── document-at-root.md  ← No directory
├── Computer Science/
│   └── DSA/
└── Languages/
```

**Questions:**
- **A)** Should users be able to create a "Root" pseudo-directory with rules?
- **B)** Should root-level operations show NO rules (force users to use directories)?
- **C)** Should there be a special "Default Directory Rules" that apply when no directory is selected?
A: it should not allow to create documents in the root directory
---

### Question 2: **Multiple Directory Attachment**

You said rules can be attached to multiple directories (`directoryIds: string[]`).

**Scenario:**
```
Rule: "Include Code Examples"
Attached to: ["Computer Science/DSA", "Computer Science/Web Development"]
```

**Questions:**
- **A)** When viewing the Directory Settings page for "DSA", should it show:
  - Only rules where DSA is in the `directoryIds` array?
  - Or also show rules from parent directories?
A:  Only rules where DSA is in the `directoryIds` array?

- **B)** In the rule creation form, how should users select multiple directories?
  - Multi-select dropdown?
  - Checkbox tree of all directories?
  - Tags/chips that autocomplete directory names?
A: when creating rules we shouldn't be able to choose directories;
we attach rules to directories using diresctory's settings

---

### Question 3: **Directory Settings Page URL**

**Questions:**
- What should the route be for Directory Settings?
  - Option A: `/directories/:id/settings`
  - Option B: `/directories/:id/rules`
  - Option C: Include in the library view as a modal/sidebar?

- Should this page show:
  - **Only** the rules section?
  - Or directory metadata + rules + other settings?
A: can it be just a modal without new using new routes?
---

### Question 4: **Rule Deletion Impact**

**Scenario:** User deletes a rule that's attached to 3 directories and is marked as default.

**Questions:**
- Should there be a **warning dialog** showing:
  - "This rule is attached to 3 directories: [CS, DSA, Web Dev]"
  - "This rule is marked as default and will be removed from future operations"
  - [Cancel] [Delete Anyway]

- Should deletion be **immediate** or require confirmation?
A: it should not allow to delete a rule that is attached to one ore more directories
it should show a modal that says that
---

### Question 5: **Tag Filter + Applicability Filter Logic**

You said to add both tag filter AND applicability filter.

**Question:** When BOTH are active, should they use:
- **AND logic**: Show rules that match BOTH filters
  - Example: Tag="DSA" AND Applicability="Quiz" → Only DSA quiz rules
- **OR logic**: Show rules that match EITHER filter
  - Example: Tag="DSA" OR Applicability="Quiz" → All DSA rules + all quiz rules
A: AND logic
---

### Question 6: **Followup Rules Requirement**

You said followup rules are **required** to generate a quiz.

**Questions:**
- Should the "Generate Quiz" button be **disabled** until at least one followup rule is selected?
- Should there be validation: "Please select at least 1 followup rule to continue"?
A: yes
- Should we pre-select default followup rules from the current directory?
A: yes and cascading rules from the ancestors

---

### Question 7: **Rule Selector "Reset" Button**

You said to add a small "Reset" icon button.

**Questions:**
- Where should this button be placed?
  - Next to "Manage Rules" link?
  - In the header of the rule selector panel?
  - Below the rule list?
  A: Below the rule list

- What should "Reset" do exactly?
  - Uncheck all rules and re-check only defaults?
  - Or completely clear all selections (including defaults)?
A: Uncheck all rules and re-check only defaults?
---

### Question 8: **Creating Documents Without Directory**

**Scenario:** User goes to "Generate from Prompt" but hasn't selected a directory.

**Questions:**
- Should the directory field be **required**?
- Or should we allow document creation without directory, but then:
  - No rules are available?
  - Show all rules from all directories (confusing)?
  - Force user to select a directory first?
A: there is no fields related to directory, directory id can be taken from url 
---

### Question 9: **Rule Ordering for AI**

You said to concatenate rules with `RULE #1`, `RULE #2`, etc. and let AI prioritize.

**Questions:**
- What determines the numbering?
  - **Creation date** (older = #1)?
  - **Alphabetical** by rule name?
  - **Directory hierarchy** (parent rules first, then child rules)?
  - **Random** (doesn't matter)?
A: directory hierartchy

- Example with Additive Inheritance:
  ```
  Document in: Computer Science/DSA/Sorting
  
  Available Rules:
  - "CS Academic Style" from Computer Science
  - "Include Complexity" from DSA  
  - "Show Steps" from Sorting
  
  Should numbering be:
  RULE #1: CS Academic Style (parent first)
  RULE #2: Include Complexity (middle)
  RULE #3: Show Steps (child last)
  
  Or different order?
  ```

---

### Question 10: **Viewing Rule Details Modal**

You answered "no" to making the modal read-only with Edit button.

**Clarification:** So when user clicks a rule card, should it:
- **A)** Open a modal showing full details + [Edit] + [Delete] buttons at the bottom?
- **B)** Directly open the edit form modal?
- **C)** Do nothing (no modal at all)?
A: Directly open the edit form moda

---

## Summary: What I Need

Please answer these 10 questions so I can create the **final, complete specification** that covers:

1. ✅ All UI components and layouts
2. ✅ Directory-based rule architecture (no global rules)
3. ✅ Additive inheritance model
4. ✅ Multiple directory attachment
5. ✅ Directory Settings page with rules management
6. ✅ Rule cascading behavior
7. ✅ Default rule selection logic
8. ✅ Data model with `directoryIds: string[]`
9. ✅ Complete user flows
10. ✅ Backend API structure

Once you answer these, I'll create an updated **RULES_UI_SPECIFICATION.md** with your architecture! 🚀