# Rule Propagation Investigation - Sibling Directory Issue

## Issue Report
User reports that rules attached to one directory are propagating to sibling directories:
- Computer Science rules attached to DSA folder appearing in Chinese Lang prompts
- Language-related rules from Chinese Lang folder appearing in DSA content

## Investigation Summary

### ✅ Backend Logic is Correct
I've verified that the rule resolution logic in `functions/src/services/rule-resolution.ts` is working correctly:

1. **Test Results**: Created and ran `debug-rule-resolution.js` which confirms:
   - Rules only cascade UP the parent chain (child → parent → grandparent)
   - Sibling directories do NOT see each other's rules
   - Test case verified Chinese Lang directory only gets its own rules + Root rules (NOT DSA rules)

2. **Code Review**: The `resolveRulesForDirectory` function:
   - Uses `getDirectoryHierarchy` to walk UP from target directory to root
   - Only collects `ruleIds` from the current directory and its ancestors
   - Never traverses sideways to sibling directories

### 🔍 Possible Causes

Since the backend logic is correct, the issue must be one of the following:

#### 1. **Data Integrity Issue** (Most Likely)
Rules may be accidentally attached to multiple directories:
- A rule meant for DSA might have both `"dsa"` and `"chinese"` in its `directoryIds` array
- The directory-rule relationship is stored in TWO places:
  - `Rule.directoryIds[]` - array of directory IDs this rule is attached to
  - `Directory.ruleIds[]` - array of rule IDs attached to this directory
- If these two arrays are out of sync, it causes issues

#### 2. **Shared Parent Directory**
Both DSA and Chinese Lang directories might share a common parent that has the problematic rules attached:
```
Root (has both CS and Language rules attached)
├── DSA
└── Chinese Lang
```
In this case, both siblings would inherit the rules from Root.

#### 3. **Frontend Caching**
The frontend might be displaying stale cached data from RTK Query.

## Diagnostic Tools Added

### 1. Enhanced Logging
Added detailed console logging to `rule-resolution.ts`:
- Logs directory hierarchy when resolving rules
- Shows which rules are collected from each directory
- Displays rule IDs and their directoryIds associations

### 2. Debug Endpoint: `debugDirectoryRules`
New Firebase function to diagnose rule attachment issues:

```typescript
// Call this from frontend or Firebase Console
const result = await functions.httpsCallable('debugDirectoryRules')({
  directoryId: 'your-directory-id'
});

console.log(result.data.report);
```

This endpoint returns:
- Directory details (name, path, parentId, ruleIds)
- Complete ancestor chain with their rules
- All rules attached to this directory
- **Inconsistencies**: Rules that are in directory but not in rule, or vice versa
- Total count of data integrity issues

## Next Steps for User

### Step 1: Check Your Directory Structure
Run this in the browser console while logged in:

```javascript
// Get your directory tree
const { data } = await firebase.functions().httpsCallable('getDirectoryTree')();
console.log('Directory Tree:', JSON.stringify(data.tree, null, 2));
```

Check if:
1. DSA and Chinese Lang are sibling directories (same parent)?
2. Their parent has any rules attached?

### Step 2: Run the Debug Diagnostic
For each problematic directory, run:

```javascript
// Check DSA directory
const dsaReport = await firebase.functions().httpsCallable('debugDirectoryRules')({
  directoryId: 'your-dsa-directory-id'
});
console.log('DSA Report:', dsaReport.data.report);

// Check Chinese Lang directory  
const chineseReport = await firebase.functions().httpsCallable('debugDirectoryRules')({
  directoryId: 'your-chinese-directory-id'
});
console.log('Chinese Report:', chineseReport.data.report);
```

Look for:
- **Inconsistencies**: If `totalInconsistencies > 0`, you have data corruption
- **Ancestors**: Check if any ancestors have the cross-contaminating rules
- **Rules**: Check if any rule has both directory IDs in its `directoryIds` array

### Step 3: Check the Logs
When you generate a document or quiz, check the Firebase Functions logs:
1. Go to Firebase Console → Functions → Logs
2. Look for `=== RULE RESOLUTION DEBUG ===` entries
3. See exactly which rules are being collected and from which directories

### Step 4: Fix Data Integrity Issues

If you find inconsistencies, you can fix them:

**Option A: Detach and Re-attach**
```javascript
// Detach rule from incorrect directory
await firebase.functions().httpsCallable('detachRuleFromDirectory')({
  ruleId: 'problematic-rule-id',
  directoryId: 'wrong-directory-id'
});

// Attach to correct directory
await firebase.functions().httpsCallable('attachRuleToDirectory')({
  ruleId: 'rule-id',
  directoryId: 'correct-directory-id'
});
```

**Option B: Clear Frontend Cache**
```javascript
// In your browser console
localStorage.clear();
location.reload();
```

## Expected Behavior

With the correct setup:

```
Root
├── Computer Science
│   └── DSA (rules: "Programming Code", "ASCII Diagrams")
└── Chinese Lang (rules: "Language Learning", "Pinyin Format")
```

When generating a document in **DSA directory**, should get:
- ✅ "Programming Code" rule (from DSA)
- ✅ "ASCII Diagrams" rule (from DSA)
- ❌ NOT "Language Learning" rule (sibling's rule)

When generating a document in **Chinese Lang directory**, should get:
- ✅ "Language Learning" rule (from Chinese Lang)
- ✅ "Pinyin Format" rule (from Chinese Lang)
- ❌ NOT "Programming Code" rule (sibling's rule)

## Questions for User

1. What is the exact directory structure? (Parent-child relationships)
2. Have you attached any rules to the parent directory of both DSA and Chinese Lang?
3. When did you first notice this issue? After creating new rules or has it always been there?
4. Can you run the `debugDirectoryRules` function and share the output?

## Files Modified

1. **functions/src/services/rule-resolution.ts** - Added detailed debug logging
2. **functions/src/endpoints/debug-rules.ts** - New diagnostic endpoint
3. **functions/src/index.ts** - Export debug endpoint
4. **functions/debug-rule-resolution.js** - Test script to verify logic

## Cleanup

After resolving the issue, we should:
1. Remove or comment out the detailed console.log statements
2. Consider removing the debug endpoint (or keep it for future diagnostics)
3. Document the correct way to attach rules to directories

---

**Status**: Awaiting user feedback and diagnostic results to identify root cause.
