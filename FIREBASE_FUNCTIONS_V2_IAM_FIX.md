# Firebase Functions v2 Authentication Issue - Resolution Guide

## Date: November 16, 2025

## Executive Summary

Firebase callable function `getRules` was returning `FirebaseError: internal` in production, despite the user being authenticated with a valid token. The root cause was **missing Cloud Run IAM permissions**, not CORS or authentication issues as initially suspected.

---

## Problem Statement

### Symptoms
- ✅ User authenticated successfully (verified with Firebase Auth token)
- ✅ Token present and valid (952 characters)
- ❌ Function calls failing with `FirebaseError: internal`
- ❌ Browser console showing misleading CORS-like errors

### Initial Misleading Indicators
1. **Browser Error**: "CORS policy blocking the request"
2. **Firebase SDK Error**: `FirebaseError: internal`
3. **Cloud Run Logs**: "The request was not authenticated"

All three errors pointed to different issues, making diagnosis challenging.

---

## Root Cause Analysis

### The Real Problem: Missing IAM Permissions

Firebase Functions v2 are backed by **Google Cloud Run**. When a callable function is deployed, it creates a Cloud Run service, but **IAM permissions are not automatically configured**.

**Without proper IAM permissions:**
- Cloud Run rejects ALL requests at the infrastructure level
- Requests never reach your function code
- Firebase SDK receives a generic "internal" error
- Browser may show CORS errors due to failed preflight requests

### Why This Happens

1. **Firebase Functions v2 Architecture**:
   ```
   Client → Firebase SDK → Cloud Run Service → Your Function Code
                              ↑
                         (Blocked here without IAM)
   ```

2. **Cloud Run Default Behavior**:
   - Cloud Run services are **private by default**
   - Require explicit IAM permissions to allow invocations
   - Block unauthenticated requests at the infrastructure level

3. **Callable Functions Auth Flow**:
   - Client: Firebase SDK automatically includes auth token
   - Cloud Run: Needs to allow the request through (requires IAM)
   - Function Code: Validates the Firebase Auth token

---

## The Solution

### Step 1: Identify the Cloud Run Service

Firebase Functions v2 create Cloud Run services with lowercase names:
- Function: `getRules`
- Cloud Run service: `getrules` (lowercase)

### Step 2: Check Current IAM Policy

```bash
gcloud run services get-iam-policy getrules \
  --region=asia-east1 \
  --project=code-insights-quiz-ai \
  --format=json
```

**Result**: Empty policy `{"etag": "ACAB"}` - **This is the problem!**

### Step 3: Add Required IAM Binding

For Firebase **callable functions**, add `allUsers` as invoker:

```bash
gcloud run services add-iam-policy-binding getrules \
  --region=asia-east1 \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --project=code-insights-quiz-ai
```

**Why `allUsers`?**
- Callable functions handle authentication **internally** via Firebase SDK
- Cloud Run must allow the initial request through
- Your function code validates the Firebase Auth token
- Unauthenticated users will be rejected **by your function**, not Cloud Run

### Step 4: Verify the Fix

After adding IAM permissions:

```json
{
  "bindings": [
    {
      "members": ["allUsers"],
      "role": "roles/run.invoker"
    }
  ],
  "etag": "BwZDrqJDgKI=",
  "version": 1
}
```

---

## Verification Steps

### 1. Check Authentication in Browser Console

After the fix, you should see:

```javascript
🔐 Auth Check for getRules: {
  isAuthenticated: true,
  userId: 'fkJUAbAapgRx1HKnP7lr68M9sTM2',
  email: 'andre.mashukov@gmail.com',
  hasToken: true,
  tokenLength: 952
}
```

### 2. Successful Function Call

```javascript
Firebase Callable - Starting: getRules
Firebase Callable - Created callable for: getRules
Firebase Callable - Success: getRules (XXXms)
```

### 3. Backend Logs Should Show

```
getRules called { hasAuth: true, uid: 'fkJUAbAapgRx1HKnP7lr68M9sTM2' }
Authentication successful { userId: 'fkJUAbAapgRx1HKnP7lr68M9sTM2' }
Fetching rules from Firestore
Rules fetched successfully { ruleCount: X }
```

---

## Why This Was Hard to Diagnose

### 1. Misleading Error Messages

| What You See | What It Actually Means |
|-------------|------------------------|
| "CORS policy blocking" | Cloud Run rejecting at infrastructure level |
| "FirebaseError: internal" | Generic error when non-HttpsError thrown |
| "Request not authenticated" | IAM permissions missing, not Firebase Auth issue |

### 2. Auth Token Was Valid

- Client showed: ✅ `isAuthenticated: true`, `tokenLength: 952`
- This made it seem like an authentication problem
- **Reality**: Token never reached the function due to IAM blocking

### 3. Other Functions Worked

- Functions like `getQuiz`, `generateQuiz` worked fine
- **Why?** They likely had IAM permissions set during earlier deployments
- **getRules** was deployed differently or permissions were never set

---

## Complete List of Rule-Related Functions

All rule-related Firebase Functions v2 that require IAM permissions:

| Function Name | Cloud Run Service Name | Purpose |
|--------------|------------------------|---------|
| `createRule` | `createrule` | Create a new rule |
| `getRule` | `getrule` | Get a single rule by ID |
| `getRules` | `getrules` | Get all rules for a user |
| `updateRule` | `updaterule` | Update an existing rule |
| `deleteRule` | `deleterule` | Delete a rule |
| `attachRuleToDirectory` | `attachruletodirectory` | Attach a rule to a directory |
| `detachRuleFromDirectory` | `detachrulefromdirectory` | Detach a rule from a directory |
| `getDirectoryRules` | `getdirectoryrules` | Get all rules for a directory |
| `getApplicableRules` | `getapplicablerules` | Get applicable rules for an operation |
| `formatRulesForPrompt` | `formatrulesforprompt` | Format rules for AI prompt injection |
| `getRuleTags` | `getruletags` | Get all unique tags used by rules |
| `debugDirectoryRules` | `debugdirectoryrules` | Debug rule attachment issues |

**Note**: Cloud Run service names are lowercase versions of the function names.

### Quick Command to Set IAM for All Rule Functions

```bash
# Set IAM permissions for all rule-related functions at once
for func in createrule getrule getrules updaterule deleterule \
            attachruletodirectory detachrulefromdirectory \
            getdirectoryrules getapplicablerules \
            formatrulesforprompt getruletags debugdirectoryrules; do
  echo "Setting IAM for $func..."
  gcloud run services add-iam-policy-binding "$func" \
    --region=asia-east1 \
    --member="allUsers" \
    --role="roles/run.invoker" \
    --project=code-insights-quiz-ai
done
```

## Best Practices Going Forward

### 1. Always Set IAM Permissions for v2 Functions

Add this to your deployment script:

```bash
# After deploying a callable function
firebase deploy --only functions:functionName

# Immediately add IAM permissions
gcloud run services add-iam-policy-binding functionname \
  --region=YOUR_REGION \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --project=YOUR_PROJECT_ID
```

### 2. Automated IAM Setup Script

Create `scripts/fix-iam-permissions.sh`:

```bash
#!/bin/bash

# Firebase Functions v2 IAM Fix Script
# Adds Cloud Run invoker permissions for all callable functions

PROJECT_ID="code-insights-quiz-ai"
REGION="asia-east1"

# List of callable functions (lowercase Cloud Run service names)
# Rule-related functions
RULE_FUNCTIONS=(
  "createrule"
  "getrule"
  "getrules"
  "updaterule"
  "deleterule"
  "attachruletodirectory"
  "detachrulefromdirectory"
  "getdirectoryrules"
  "getapplicablerules"
  "formatrulesforprompt"
  "getruletags"
  "debugdirectoryrules"
)

# Other functions (add as needed)
OTHER_FUNCTIONS=(
  "getquiz"
  "generatequiz"
  # Add more functions here
)

# Combine all functions
FUNCTIONS=("${RULE_FUNCTIONS[@]}" "${OTHER_FUNCTIONS[@]}")

for func in "${FUNCTIONS[@]}"; do
  echo "Setting IAM permissions for $func..."
  gcloud run services add-iam-policy-binding "$func" \
    --region="$REGION" \
    --member="allUsers" \
    --role="roles/run.invoker" \
    --project="$PROJECT_ID"
done

echo "✅ All IAM permissions updated!"
```

### 3. Verify After Each Deployment

```bash
# Check IAM policy
gcloud run services get-iam-policy FUNCTION_NAME \
  --region=REGION \
  --project=PROJECT_ID
```

### 4. Enhanced Error Handling in Functions

The fix also included improved error handling:

```typescript
// functions/src/endpoints/rules.ts
import { HttpsError } from 'firebase-functions/v2/https';

async function validateAuth(context: { auth?: { uid?: string } }): Promise<string> {
  if (!context.auth || !context.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be logged in');
  }
  return context.auth.uid;
}

// In endpoint error handling
catch (error) {
  logger.error('Failed to get rules', {
    error: error instanceof Error ? error.message : String(error),
    hasAuth: !!request.auth,
    uid: request.auth?.uid,
  });
  
  if (error instanceof HttpsError) {
    throw error;
  }
  
  throw new HttpsError('internal', `Failed to get rules: ${errorMessage}`);
}
```

---

## Technical Details

### Firebase Functions v2 vs v1

| Aspect | Functions v1 | Functions v2 |
|--------|-------------|-------------|
| Backend | Cloud Functions | Cloud Run |
| IAM Setup | Automatic | **Manual Required** |
| Permissions | Handled by Firebase | Requires gcloud CLI |
| Auth Flow | Automatic | Requires `allUsers` invoker |

### Cloud Run IAM Roles

| Role | Purpose | When to Use |
|------|---------|-------------|
| `roles/run.invoker` | Allow invocation | **Required** for callable functions |
| `roles/run.admin` | Full control | For service management (not needed for runtime) |

### Important Security Note

**Q: Is `allUsers` safe for authenticated functions?**

**A: Yes!** Here's why:

1. **Cloud Run Level** (`allUsers`):
   - Allows the HTTP request through
   - Does NOT bypass authentication

2. **Function Code Level**:
   - Validates Firebase Auth token
   - Rejects requests without valid tokens
   - Controls access based on your business logic

3. **Defense in Depth**:
   ```
   Request → Cloud Run (allows through)
           → Firebase SDK (validates token)
           → Function Code (checks permissions)
           → Firestore Rules (final check)
   ```

---

## Related Files Modified

### 1. Backend Function Code
**File**: `functions/src/endpoints/rules.ts`

**Changes**:
- Added `HttpsError` import and usage
- Updated `validateAuth` to throw `HttpsError('unauthenticated')`
- Enhanced error logging with auth context
- Proper error propagation with `HttpsError`

### 2. Client-Side Debugging
**File**: `web/src/store/api/baseApi.ts`

**Changes**:
- Added comprehensive auth state logging
- Pre-flight auth token validation
- Clear error messages for debugging
- Auth token length and validity checks

### 3. IAM Configuration
**Command**: `gcloud run services add-iam-policy-binding`

**What It Does**:
- Configures Cloud Run service permissions
- Allows public invocation (auth handled by function)
- Required for Functions v2 callable functions

---

## Debugging Checklist for Future Issues

### ✅ Client-Side Checks
- [ ] User authenticated? (`auth.currentUser`)
- [ ] Token present? (`getIdToken()`)
- [ ] Token not expired? (< 1 hour old)
- [ ] Correct function name?
- [ ] Correct region specified?

### ✅ Firebase Console Checks
- [ ] Function deployed successfully?
- [ ] Function shows as "callable" type?
- [ ] Correct region (asia-east1)?
- [ ] Function logs showing errors?

### ✅ Cloud Run Checks
- [ ] **IAM permissions set?** ⚠️ **Most Common Issue**
- [ ] Service exists? (`gcloud run services list`)
- [ ] Service healthy? (Check Cloud Run console)
- [ ] Correct service name? (lowercase function name)

### ✅ Code Checks
- [ ] Using `onCall` (not `onRequest`)?
- [ ] Throwing `HttpsError` (not plain `Error`)?
- [ ] Proper CORS configuration?
- [ ] Authentication validation in place?

---

## Key Takeaways

1. **Firebase Functions v2 require manual IAM setup** - This is by design, not a bug

2. **"CORS errors" are often red herrings** - Check IAM and authentication first

3. **Cloud Run blocks at infrastructure level** - Without IAM, requests never reach your code

4. **`allUsers` is safe for callable functions** - Auth is handled by your function code

5. **Always verify IAM after deployment** - Add to your deployment checklist

6. **Use `HttpsError` for all function errors** - Plain `Error` becomes "internal" on client

---

## Prevention Strategy

### Add to CI/CD Pipeline

```yaml
# .github/workflows/deploy-functions.yml
- name: Deploy Functions
  run: firebase deploy --only functions

- name: Configure IAM Permissions for Rule Functions
  run: |
    # All rule-related functions
    for func in createrule getrule getrules updaterule deleterule \
                attachruletodirectory detachrulefromdirectory \
                getdirectoryrules getapplicablerules \
                formatrulesforprompt getruletags debugdirectoryrules; do
      gcloud run services add-iam-policy-binding $func \
        --region=asia-east1 \
        --member="allUsers" \
        --role="roles/run.invoker" \
        --project=code-insights-quiz-ai || echo "Failed to set IAM for $func (may already be set)"
    done
```

### Post-Deployment Checklist

1. ✅ Deploy functions with Firebase CLI
2. ✅ Set IAM permissions with gcloud
3. ✅ Test in browser (check auth state logs)
4. ✅ Verify backend logs show execution
5. ✅ Confirm no "not authenticated" warnings

---

## References

- [Firebase Functions v2 Documentation](https://firebase.google.com/docs/functions/beta/2nd-gen)
- [Cloud Run IAM Documentation](https://cloud.google.com/run/docs/securing/managing-access)
- [Firebase Callable Functions](https://firebase.google.com/docs/functions/callable)
- [HttpsError Class Reference](https://firebase.google.com/docs/reference/functions/2nd-gen/node/firebase-functions.https.httpserror)

---

## Conclusion

The issue was **not** CORS, **not** authentication, and **not** a bug in the code. It was a **missing Cloud Run IAM configuration** required for Firebase Functions v2.

**The one-line fix:**
```bash
gcloud run services add-iam-policy-binding getrules \
  --member="allUsers" --role="roles/run.invoker"
```

This is now part of our standard deployment process for all Firebase Functions v2.

---

## Credits

**Diagnosed and Fixed**: November 16, 2025  
**Time to Resolution**: ~3 hours (with multiple red herrings)  
**Lessons Learned**: Always check IAM permissions first for Cloud Run-backed services

