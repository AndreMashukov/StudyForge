# Rules Feature - Complete Specification

## Overview

The Rules feature allows users to define AI behavior guidelines that cascade through directory hierarchies. Rules control how the AI processes documents during scraping, uploading, prompt generation, quiz creation, and followup generation.

**Key Architecture Decision: Directory-Based Rules Only (No Global Rules)**

---

## Table of Contents

1. [Data Model](#data-model)
2. [Rule Inheritance & Cascading](#rule-inheritance--cascading)
3. [UI Components](#ui-components)
4. [User Flows](#user-flows)
5. [Backend API](#backend-api)
6. [Implementation Roadmap](#implementation-roadmap)

---

## Data Model

### Rule Interface

```typescript
export interface Rule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  content: string; // Markdown content, max 10,000 chars
  color: RuleColor;
  tags: string[];
  applicableTo: RuleApplicability[];
  isDefault: boolean; // Auto-selected for operations
  directoryIds: string[]; // Directories this rule is attached to
  createdAt: Date;
  updatedAt: Date;
}

export enum RuleApplicability {
  SCRAPING = 'scraping',
  UPLOAD = 'upload',
  PROMPT = 'prompt',
  QUIZ = 'quiz',
  FOLLOWUP = 'followup',
}

export enum RuleColor {
  RED = 'red',
  ORANGE = 'orange',
  YELLOW = 'yellow',
  GREEN = 'green',
  BLUE = 'blue',
  INDIGO = 'indigo',
  PURPLE = 'purple',
  PINK = 'pink',
  GRAY = 'gray',
}
```

### API Request/Response Types

```typescript
export interface CreateRuleRequest {
  name: string;
  description?: string;
  content: string;
  color: RuleColor;
  tags: string[];
  applicableTo: RuleApplicability[];
  isDefault?: boolean;
}

export interface UpdateRuleRequest {
  name?: string;
  description?: string;
  content?: string;
  color?: RuleColor;
  tags?: string[];
  applicableTo?: RuleApplicability[];
  isDefault?: boolean;
}

export interface AttachRuleToDirectoryRequest {
  ruleId: string;
  directoryId: string;
}

export interface DetachRuleFromDirectoryRequest {
  ruleId: string;
  directoryId: string;
}

export interface GetDirectoryRulesRequest {
  directoryId: string;
  includeAncestors?: boolean; // For cascading
}

export interface GetDirectoryRulesResponse {
  rules: Rule[];
  inheritanceMap: {
    [directoryId: string]: Rule[];
  };
}
```

---

## Rule Inheritance & Cascading

### Additive Inheritance Model

When a user performs an operation in a directory, **all rules from ancestor directories cascade down**:

```
Directory Structure:
Root/
├── Computer Science/          (Rules: CS-1, CS-2)
│   ├── DSA/                   (Rules: DSA-1)
│   │   └── Sorting/           (Rules: SORT-1)
│   └── Web Development/       (Rules: WEB-1)
└── Languages/                 (Rules: LANG-1)
    └── Chinese/               (Rules: CN-1)

Operation in: Computer Science/DSA/Sorting/

Available Rules:
1. CS-1 (from Computer Science)
2. CS-2 (from Computer Science)
3. DSA-1 (from DSA)
4. SORT-1 (from Sorting)

Rules are numbered by hierarchy: Parent → Child
```

### Rule Numbering for AI Injection

Rules are concatenated with hierarchical numbering:

```
─────────────────────────────────────────────────────
ADDITIONAL RULES TO FOLLOW:

The user has selected the following rules to guide your response. 
These rules are listed in hierarchical order (parent directories first). 
Please consider all rules intelligently, prioritizing based on context.

─────────────────────────────────────────────────────
RULE #1 (From: Computer Science) - Academic Style
─────────────────────────────────────────────────────
Use formal academic language with proper citations...

─────────────────────────────────────────────────────
RULE #2 (From: Computer Science/DSA) - Include Complexity Analysis
─────────────────────────────────────────────────────
Always include time and space complexity for algorithms...

─────────────────────────────────────────────────────
RULE #3 (From: Computer Science/DSA/Sorting) - Show Steps
─────────────────────────────────────────────────────
Provide step-by-step visualization of sorting process...

─────────────────────────────────────────────────────
END OF RULES
```

### Default Rule Behavior

When a rule is marked as `isDefault: true`:
- **Auto-selected** in rule selectors within its directories and children
- **User can uncheck** if they don't want it for a specific operation
- **Cascades to children**: Defaults from parent directories auto-select in child directories

---

## UI Components

### 1. Directory Settings Modal

**Access**: Click settings icon on directory in library

**Modal Layout**:
```
┌──────────────────────────────────────────────────────────────┐
│ 📁 Directory Settings: Computer Science             [×]      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ Directory Name: Computer Science                             │
│ Path: /Computer Science                                      │
│                                                               │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│                                                               │
│ 📋 Rules (3 attached)                  [+ Attach Rule]       │
│                                                               │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ ⭐ Academic Style            [Default]  [Actions ▼]  │   │
│ │ [Quiz] [Prompt] [Followup]  🏷️ Style, Formal         │   │
│ │                                                       │   │
│ │ Code Examples                           [Actions ▼]  │   │
│ │ [Quiz] [Prompt]  🏷️ Code, DSA                        │   │
│ │                                                       │   │
│ │ ⭐ Include Diagrams          [Default]  [Actions ▼]  │   │
│ │ [Prompt] [Followup]  🏷️ Visual                       │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                               │
│ Actions dropdown:                                             │
│ - View Details                                                │
│ - Edit Rule                                                   │
│ - Toggle Default                                              │
│ - Detach from Directory                                       │
│                                                               │
│                           [Close]                             │
└──────────────────────────────────────────────────────────────┘
```

**"Attach Rule" Flow**:
1. User clicks [+ Attach Rule]
2. Modal shows list of ALL user's rules (not attached to this directory)
3. Filtered by search/tags
4. User selects one or more rules
5. Rules are attached to directory

---

### 2. Create/Edit Rule Form

**Access**: From Directory Settings → [+ Attach Rule] → [Create New Rule]

**Form Layout**:
```
┌────────────────────────────────────────────────────────────┐
│ Create New Rule                                      [×]    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ Rule Name *                                                 │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ DSA Code Examples                                    │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ Description (Optional)                                      │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ Adds comprehensive code examples for DSA problems    │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ Applies To * (Select at least one)                         │
│ ☐ Scraping  ☑ Upload  ☑ Prompt  ☑ Quiz  ☑ Followup       │
│                                                             │
│ Color *                                                     │
│ ● Red  ● Orange  ● Yellow  ● Green  ● Blue               │
│ ● Indigo  ● Purple  ● Pink  ○ Gray                        │
│                                                             │
│ Tags (Press Enter to add)                                  │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ [DSA ×] [Code ×] [Algorithms ×]  Add tag...          │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ Rule Content * (Markdown supported)                        │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ When generating DSA content:                         │   │
│ │ - Include Python and Java implementations            │   │
│ │ - Add time/space complexity analysis                 │   │
│ │ - Provide step-by-step walkthrough                   │   │
│ │                                                       │   │
│ │ (Markdown editor with preview toggle)                │   │
│ │                                                       │   │
│ │ Characters: 245 / 10,000                             │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ☑ Set as default rule (Auto-select for applicable ops)    │
│                                                             │
│           [Cancel]  [Save Rule]                            │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**Validation**:
- Name: Required, max 100 chars
- Applies To: At least one selected
- Color: Required
- Content: Required, max 10,000 chars

**Note**: Directory attachment happens separately in Directory Settings modal, NOT during rule creation.

---

### 3. Rule Selector Component

Used in all operation pages (scrape, upload, prompt, quiz generation).

**Compact Version** (used everywhere):
```
┌─────────────────────────────────┐
│ 📋 Rules (3)    [Manage...]     │
├─────────────────────────────────┤
│                                  │
│ [DSA ×] [Style ×] [Diagrams ×] │
│                                  │
│ ☑ DSA Code Examples             │
│ ☑ Academic Style                │
│ ☑ Include Diagrams              │
│ ☐ Web Dev Rules                 │
│                                  │
│ [↻ Reset]                       │
└─────────────────────────────────┘
```

**Features**:
- Shows only rules applicable to current operation (filtered by `applicableTo`)
- Shows only rules from current directory + ancestors (cascading)
- Default rules pre-checked
- Selected rules shown as chips at top
- Reset button below list: unchecks all, re-checks defaults
- No order numbers displayed (handled by backend)

**Mobile Version** (Bottom Sheet):
```
User taps "Select Rules" button
↓
Bottom sheet slides up

┌────────────────────────────────────┐
│         Select Rules               │
│         ──────                     │
│                                    │
│ [DSA Code ×] [Style ×]            │
│                                    │
│ ☑ DSA Code Examples                │
│ ☑ Academic Style                   │
│ ☑ Include Diagrams                 │
│ ☐ Web Dev Rules                    │
│                                    │
│ [↻ Reset]  [Apply]                │
└────────────────────────────────────┘
```

---

### 4. Document Viewer - Quiz/Followup Rules

**Layout** (Right Sidebar):
```
┌────────────────────────────────────────────────────────────┐
│ [← Back]  Binary Search Algorithm                          │
├───────────────────────────────┬────────────────────────────┤
│                               │  Actions                   │
│ # Binary Search Algorithm     │  ─────────────             │
│                               │  [Generate Quiz]           │
│ Binary search is an efficient │                            │
│ algorithm...                  │  📋 Quiz Rules (2)         │
│                               │  [Manage...]               │
│ ## Time Complexity            │  ───────────               │
│                               │  [DSA Quiz ×] [Code ×]     │
│ The time complexity is        │                            │
│ O(log n)...                   │  ☑ DSA Quiz Style          │
│                               │  ☑ Code Questions          │
│                               │  ☐ Easy Questions          │
│                               │                            │
│ (Document content...)         │  [↻ Reset]                 │
│                               │                            │
│                               │  📋 Followup Rules (1) *   │
│                               │  [Manage...]               │
│                               │  ───────────               │
│                               │  [Detailed ×]              │
│                               │                            │
│                               │  ☑ Detailed Exp            │
│                               │  ☐ ASCII Diagrams          │
│                               │                            │
│                               │  [↻ Reset]                 │
│                               │                            │
│                               │  * Required for quiz       │
└───────────────────────────────┴────────────────────────────┘
```

**Behavior**:
- Two separate rule selectors: Quiz rules + Followup rules
- Both required (at least 1 followup rule must be selected)
- Generate Quiz button disabled until followup rules selected
- When quiz is generated, followup rules are saved with quiz
- During quiz, "Generate Followup" button uses saved rules (no modal)

---

## User Flows

### Flow 1: Create Rule and Attach to Directory

```
1. User navigates to Library
2. Clicks settings icon on "Computer Science" directory
3. Directory Settings modal opens
4. Clicks [+ Attach Rule]
5. Modal shows all rules, user clicks [Create New Rule]
6. Fills form:
   - Name: "DSA Code Examples"
   - Applies To: [Quiz, Prompt, Followup]
   - Color: Blue
   - Tags: "DSA", "Code"
   - Content: [Markdown instructions]
   - Set as default: ☑
7. Clicks [Save Rule]
8. Rule is created and appears in attach list
9. User selects it and clicks [Attach]
10. Rule now attached to "Computer Science" directory
11. Rule cascades to all child directories (DSA, Sorting, etc.)
```

---

### Flow 2: Generate Document with Cascading Rules

```
1. User navigates to /directories/cs-dsa-sorting (URL-based navigation)
2. Clicks "Generate from Prompt"
3. Rule selector shows cascading rules:
   - "Academic Style" (from Computer Science) ☑ [default]
   - "Include Complexity" (from DSA) ☑ [default]
   - "Show Steps" (from Sorting) ☑ [default]
   - "Code Examples" (from Computer Science) ☐
4. User unchecks "Academic Style" (too formal)
5. User checks "Code Examples"
6. Writes prompt: "Explain quicksort algorithm"
7. Clicks [Generate Document]
8. Backend receives selected ruleIds
9. Backend formats rules hierarchically:
   RULE #1: Code Examples (Computer Science)
   RULE #2: Include Complexity (DSA)
   RULE #3: Show Steps (Sorting)
10. Injects into Gemini prompt
11. Generated document includes code + complexity + steps
```

---

### Flow 3: Generate Quiz with Followup Rules

```
1. User viewing document: "Binary Search Algorithm"
2. Right sidebar shows Quiz Rules and Followup Rules selectors
3. Quiz Rules pre-selected:
   - ☑ DSA Quiz Style [default]
   - ☑ Code Questions [default]
4. Followup Rules pre-selected:
   - ☑ Detailed Explanations [default]
5. User unchecks "Code Questions", checks "Conceptual Questions"
6. Clicks [Generate Quiz]
7. Quiz is generated with:
   - quizRuleIds: ["dsa-quiz-style", "conceptual-questions"]
   - followupRuleIds: ["detailed-explanations"]
8. During quiz, user clicks [Generate Followup] on a question
9. Backend uses saved followupRuleIds (no modal shown)
10. Followup generated with "Detailed Explanations" rule
```

---

### Flow 4: Delete Rule (Protected)

```
1. User in Directory Settings for "Computer Science"
2. Clicks Actions dropdown on "Academic Style" rule
3. Selects "Delete Rule"
4. System checks: rule is attached to 3 directories
5. Modal appears:
   ┌────────────────────────────────────────┐
   │ ⚠️ Cannot Delete Rule                  │
   ├────────────────────────────────────────┤
   │                                         │
   │ This rule is currently attached to:     │
   │                                         │
   │ - Computer Science                      │
   │ - Computer Science / DSA                │
   │ - Computer Science / Web Development    │
   │                                         │
   │ Please detach it from all directories   │
   │ before deleting.                        │
   │                                         │
   │              [OK]                       │
   └────────────────────────────────────────┘
6. User must detach from all directories first
7. Then can delete the rule
```

---

## Backend API

### Firestore Structure

```
/users/{userId}/rules/{ruleId}
  - id: string
  - userId: string
  - name: string
  - description: string
  - content: string
  - color: RuleColor
  - tags: string[]
  - applicableTo: RuleApplicability[]
  - isDefault: boolean
  - directoryIds: string[]  ← Array of directory IDs
  - createdAt: Timestamp
  - updatedAt: Timestamp

/users/{userId}/directories/{directoryId}
  - id: string
  - name: string
  - path: string
  - parentId: string | null
  - ruleIds: string[]  ← Denormalized for quick access
```

### API Endpoints

```typescript
// Rule CRUD
POST   /createRule                    // Create new rule (no directory attachment)
PUT    /updateRule                    // Update rule metadata
DELETE /deleteRule                    // Delete rule (fails if attached to directories)
GET    /getRules                      // Get all rules for user

// Directory-Rule Attachment
POST   /attachRuleToDirectory        // Attach rule to directory
POST   /detachRuleFromDirectory      // Detach rule from directory
GET    /getDirectoryRules            // Get rules for directory + ancestors (cascading)

// Rule Filtering
POST   /getApplicableRules           // Get rules by operation type + directory
GET    /getRuleTags                  // Get all unique tags for user

// Rule Injection
POST   /formatRulesForPrompt         // Format selected rules for AI injection
```

### Rule Resolution Service

```typescript
class RuleResolutionService {
  /**
   * Get all rules for a directory (including cascading from ancestors)
   */
  async resolveRulesForDirectory(
    directoryId: string,
    operation: RuleApplicability
  ): Promise<Rule[]> {
    // 1. Get directory path (e.g., "Computer Science/DSA/Sorting")
    const directory = await getDirectory(directoryId);
    const ancestorIds = await getAncestorDirectoryIds(directory);
    
    // 2. Get all rules attached to this directory and ancestors
    const allRuleIds = new Set<string>();
    
    for (const dirId of [directoryId, ...ancestorIds]) {
      const dir = await getDirectory(dirId);
      dir.ruleIds.forEach(id => allRuleIds.add(id));
    }
    
    // 3. Fetch all rules
    const rules = await getRulesByIds(Array.from(allRuleIds));
    
    // 4. Filter by operation type
    const applicableRules = rules.filter(rule =>
      rule.applicableTo.includes(operation)
    );
    
    // 5. Sort by directory hierarchy (parent first)
    return sortByDirectoryHierarchy(applicableRules, ancestorIds);
  }
  
  /**
   * Format rules for injection into AI prompt
   */
  formatRulesForPrompt(rules: Rule[]): string {
    const ruleBlocks = rules.map((rule, index) => {
      const directoryName = getDirectoryName(rule.directoryIds[0]);
      return `
${'─'.repeat(61)}
RULE #${index + 1} (From: ${directoryName}) - ${rule.name}
${'─'.repeat(61)}
${rule.content}`;
    });
    
    return `
${'─'.repeat(61)}
ADDITIONAL RULES TO FOLLOW:

The user has selected the following rules to guide your response. 
These rules are listed in hierarchical order (parent directories first). 
Please consider all rules intelligently, prioritizing based on context.

${ruleBlocks.join('\n\n')}

${'─'.repeat(61)}
END OF RULES

Please generate content that follows these rules while maintaining
coherence and quality.
`;
  }
}
```

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1-2)

**Backend:**
- [ ] Create Firestore schema for rules
- [ ] Implement Rule CRUD endpoints
- [ ] Implement directory-rule attachment endpoints
- [ ] Create rule resolution service (cascading logic)
- [ ] Add Firestore indexes for queries

**Frontend:**
- [ ] Create Redux slice for rules state
- [ ] Create RTK Query API for rules
- [ ] Build rule data types and interfaces

### Phase 2: Directory Settings UI (Week 2-3)

**Components:**
- [ ] Directory Settings Modal component
- [ ] Rule list view in directory settings
- [ ] Attach/Detach rule functionality
- [ ] Rule deletion protection logic

### Phase 3: Rule Creation/Editing (Week 3-4)

**Components:**
- [ ] Create/Edit Rule Form modal
- [ ] Markdown editor for rule content
- [ ] Tag input component
- [ ] Color picker component
- [ ] Applicability checkbox group
- [ ] Form validation with Zod

### Phase 4: Rule Selector Component (Week 4-5)

**Components:**
- [ ] Compact Rule Selector component
- [ ] Mobile bottom sheet variant
- [ ] Reset functionality
- [ ] Selected rules chips display
- [ ] Cascading rules loading logic

### Phase 5: Integration (Week 5-6)

**Pages:**
- [ ] Document Viewer: Quiz/Followup rule selectors
- [ ] Generate from Prompt page integration
- [ ] Scrape Document page integration
- [ ] Upload Document page integration

**Backend:**
- [ ] Inject rules into scraping service
- [ ] Inject rules into document generation
- [ ] Inject rules into quiz generation
- [ ] Inject rules into followup generation

### Phase 6: Testing & Polish (Week 6-7)

**Testing:**
- [ ] Unit tests for rule resolution service
- [ ] Integration tests for cascading logic
- [ ] E2E tests for user flows
- [ ] Mobile responsive testing

**Polish:**
- [ ] Accessibility improvements (ARIA labels)
- [ ] Keyboard navigation
- [ ] Loading states and skeletons
- [ ] Error handling and user feedback
- [ ] Performance optimization

### Phase 7: Documentation & Launch (Week 7)

**Documentation:**
- [ ] User guide for rules feature
- [ ] Example rules template library
- [ ] Video tutorial

**Launch:**
- [ ] Deploy to production
- [ ] Monitor usage analytics
- [ ] Collect user feedback

---

## Key Design Principles

1. **Directory-First**: All rules are directory-based, no global scope
2. **Cascading by Default**: Rules from parent directories automatically available in children
3. **User Control**: Defaults are suggestions, users can always override
4. **Hierarchical Clarity**: Rules numbered by directory hierarchy for AI
5. **Protected Deletion**: Can't delete rules that are attached to directories
6. **Required Constraints**: Some operations require specific rule types (e.g., followup rules for quiz)
7. **Filter Composition**: Tag + Applicability filters use AND logic
8. **Mobile-First**: Responsive design with bottom sheets for mobile
9. **No Root Documents**: Directory selection required for all document operations
10. **Smart AI Handling**: Let AI resolve rule conflicts intelligently

---

## Future Enhancements (Post-Launch)

1. **Rule Templates**: Pre-built rule templates for common use cases
2. **Rule Analytics**: Track which rules are most effective
3. **Rule Sharing**: Share rules between users or make public
4. **Rule Versioning**: Track rule changes over time
5. **Bulk Operations**: Attach/detach multiple rules at once
6. **Rule Suggestions**: AI-powered rule recommendations based on directory content
7. **Rule Groups**: Bundle related rules together
8. **Conditional Rules**: Apply rules based on document properties (length, type, etc.)

---

## Summary

This specification provides a complete blueprint for implementing the Rules feature with:

✅ Directory-based architecture (no global rules)
✅ Additive inheritance model
✅ Multiple directory attachment
✅ Hierarchical rule numbering for AI
✅ Protected deletion logic
✅ Complete UI/UX designs
✅ Comprehensive user flows
✅ Backend API structure
✅ Implementation roadmap

The feature empowers users to customize AI behavior per directory while maintaining simplicity and clear hierarchical relationships.
