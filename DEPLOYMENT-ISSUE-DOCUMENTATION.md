# Firebase Functions GitHub Actions Deployment Issue

## 🔴 Critical Issue Summary

Our GitHub Actions workflow for deploying Firebase Functions is failing consistently with the same IAM permission error despite multiple attempted fixes. Manual deployment works perfectly, but automated deployment through CI/CD fails.

**Status:** ❌ UNRESOLVED (Last failure: 2025-09-17T12:11:00)  
**Impact:** Critical - Cannot deploy functions via CI/CD pipeline  
**Urgency:** High - Blocks automated deployment process  

## 📋 Problem Description

The GitHub Actions workflow `firebase-hosting-merge.yml` fails during the Firebase Functions deployment step with this specific error:

```
Error: Missing permissions required for functions deploy. You must have permission 
iam.serviceAccounts.ActAs on service account code-insights-quiz-ai@appspot.gserviceaccount.com.
```

### Key Details
- **Web app deployment:** ✅ Works perfectly
- **Functions build:** ✅ Completes successfully  
- **Functions manual deployment:** ✅ Works when deployed manually
- **Functions automated deployment:** ❌ Fails with IAM permission error

## 🔍 Technical Context

### Service Accounts Involved
1. **GitHub Actions Service Account:**
   - Email: `github-action-1057960904@code-insights-quiz-ai.iam.gserviceaccount.com`
   - Purpose: Used by GitHub Actions workflow for authentication
   - Status: Has project-level permissions

2. **App Engine Default Service Account:**
   - Email: `code-insights-quiz-ai@appspot.gserviceaccount.com`
   - Purpose: Required by Firebase Functions for deployment
   - Status: This is the account we need `iam.serviceAccounts.ActAs` permission on

### Current Workflow Configuration
```yaml
# .github/workflows/firebase-hosting-merge.yml (simplified approach)
- name: Deploy to Firebase
  run: |
    echo '${{ secrets.FIREBASE_SERVICE_ACCOUNT_CODE_INSIGHTS_QUIZ_AI }}' > /tmp/service-account.json
    export GOOGLE_APPLICATION_CREDENTIALS=/tmp/service-account.json
    firebase deploy --project code-insights-quiz-ai
```

### Firebase Functions Configuration
- **Runtime:** Node.js 22
- **Functions:** 5 endpoints (createUser, generateQuiz, submitAnswers, etc.)
- **Location:** us-central1
- **Version:** Firebase Functions v2

## 🛠️ Solutions Attempted

### 1. ✅ Project-Level IAM Role Assignment
```bash
gcloud projects add-iam-policy-binding code-insights-quiz-ai \
  --member="serviceAccount:github-action-1057960904@code-insights-quiz-ai.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```
**Result:** Applied successfully but error persists

### 2. ✅ Service Account-Level Permission Grant
```bash
gcloud iam service-accounts add-iam-policy-binding \
  code-insights-quiz-ai@appspot.gserviceaccount.com \
  --member="serviceAccount:github-action-1057960904@code-insights-quiz-ai.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project=code-insights-quiz-ai
```
**Result:** Applied successfully but error persists

### 3. ✅ Additional Token Creator Role
```bash
gcloud iam service-accounts add-iam-policy-binding \
  code-insights-quiz-ai@appspot.gserviceaccount.com \
  --member="serviceAccount:github-action-1057960904@code-insights-quiz-ai.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project=code-insights-quiz-ai
```
**Result:** Applied successfully but error persists

### 4. ✅ Workflow Simplification
- **Before:** Separate steps for functions and hosting deployment
- **After:** Single `firebase deploy` command with direct service account authentication
- **Result:** Same error persists

### 5. ✅ Authentication Method Changes
- **Tried:** FirebaseExtended/action-hosting-deploy@v0 action
- **Tried:** Direct Firebase CLI with service account JSON
- **Tried:** Combined deployment approach
- **Result:** All approaches fail with same IAM error

## 🚨 **BREAKTHROUGH: Root Cause Identified**

**Latest Failure Analysis (Run #16 - 2025-09-17T12:34:13):**

### Debug Logs Reveal the Real Issues:

#### 1. **Missing Cloud Functions Permissions** ❌
The GitHub Actions service account is missing essential Cloud Functions permissions:
```
cloudfunctions.functions.create
cloudfunctions.functions.delete
cloudfunctions.functions.get
cloudfunctions.functions.list
cloudfunctions.functions.update
cloudfunctions.operations.get
datastore.indexes.create
datastore.indexes.delete
datastore.indexes.update
```

#### 2. **Service Account Impersonation Failed** ❌  
Debug logs show empty response when testing `iam.serviceAccounts.actAs` permission:
```
POST https://iam.googleapis.com/v1/projects/***/serviceAccounts/***@appspot.gserviceaccount.com:testIamPermissions
Response: {} (empty - no permissions granted)
```

#### 3. **What Actually Works** ✅
Current service account has only these permissions:
- `datastore.indexes.list`
- `firebase.projects.get`
- `firebasehosting.sites.update`

### **The Real Solution**

The service account needs **Cloud Functions Developer** role, not just Service Account User role.

## 💡 **CORRECT FIX COMMANDS**

Run these commands to properly fix the issue:

### Fix 1: Grant Cloud Functions Developer Role
```bash
gcloud projects add-iam-policy-binding code-insights-quiz-ai \
  --member="serviceAccount:github-action-1057960904@code-insights-quiz-ai.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.developer"
```

### Fix 2: Grant Firebase Admin Role (Alternative)
```bash
gcloud projects add-iam-policy-binding code-insights-quiz-ai \
  --member="serviceAccount:github-action-1057960904@code-insights-quiz-ai.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"
```

### Fix 3: Re-apply Service Account User (with proper scope)
```bash
# Remove existing binding first
gcloud iam service-accounts remove-iam-policy-binding \
  code-insights-quiz-ai@appspot.gserviceaccount.com \
  --member="serviceAccount:github-action-1057960904@code-insights-quiz-ai.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project=code-insights-quiz-ai

# Re-add with proper scope
gcloud iam service-accounts add-iam-policy-binding \
  code-insights-quiz-ai@appspot.gserviceaccount.com \
  --member="serviceAccount:github-action-1057960904@code-insights-quiz-ai.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project=code-insights-quiz-ai
```

## 📊 Latest Failure Details

**Workflow Run:** #14 (ID: 17797061100)  
**Date:** 2025-09-17T12:11:00  
**Duration:** Build successful, deployment failed immediately  

### Complete Error Log
```
Error: Missing permissions required for functions deploy. You must have permission 
iam.serviceAccounts.ActAs on service account code-insights-quiz-ai@appspot.gserviceaccount.com.

To address this error, ask a project Owner to assign your account the "Service Account User" role from this URL:
https://console.cloud.google.com/iam-admin/iam?project=code-insights-quiz-ai

Process completed with exit code 1.
```

### Build Process Success
```
✓ Web build completed in 2.39s
✓ Functions dependencies installed (9.76s)
✓ Functions build completed (1.91s)
✓ Firebase CLI installed successfully
```

## 🔬 Analysis

### What Works
- ✅ Manual Firebase Functions deployment via local CLI
- ✅ GitHub Actions can authenticate to Firebase for hosting
- ✅ All build processes complete successfully
- ✅ Service account has correct project-level permissions
- ✅ Service account has direct permissions on target service account

### What Doesn't Work
- ❌ GitHub Actions workflow cannot impersonate App Engine service account
- ❌ Firebase Functions deployment fails despite correct IAM roles
- ❌ Permission propagation may have delays or additional requirements

### Hypothesis
The issue appears to be related to **service account impersonation chains** in Google Cloud. While we've granted the necessary roles, there may be:

1. **Permission Propagation Delay:** IAM changes can take up to 7 minutes to propagate
2. **Missing Conditional Bindings:** Some IAM policies may require specific conditions
3. **Firebase CLI Authentication Context:** The CLI may be using different authentication flow than expected
4. **Google Cloud API Inconsistencies:** Different APIs may have different permission requirements

## 💡 Potential Next Steps

### Option A: Alternative Deployment Strategy
- Consider using Google Cloud Build instead of GitHub Actions
- Use Cloud Build triggers connected to GitHub repository
- Leverage native Google Cloud IAM integration

### Option B: Service Account Key Rotation
- Generate new service account with elevated permissions
- Update GitHub secrets with new service account key
- Test with fresh authentication context

### Option C: Firebase CLI Version Investigation
- Test with different Firebase CLI versions
- Investigate if v13+ has different IAM requirements
- Consider using Firebase Admin SDK for deployment

### Option D: Temporary Manual Deployment
- Continue manual deployment until issue resolved
- Implement automated testing without deployment
- Document manual deployment process for team

## 📈 Impact Assessment

### Development Impact
- **High:** Blocks automated CI/CD pipeline
- **Medium:** Requires manual intervention for every deployment
- **Low:** Functions still work in production (when manually deployed)

### Business Impact
- **Deployment Velocity:** Reduced by manual intervention requirement
- **Developer Experience:** Frustrating workflow disruption
- **Risk Management:** Manual deployments increase human error risk

## 🔐 Security Considerations

All attempted solutions follow Google Cloud IAM best practices:
- ✅ Principle of least privilege maintained
- ✅ Service account permissions scoped appropriately  
- ✅ No excessive permissions granted
- ✅ Secrets properly managed in GitHub

## 📚 Reference Links

1. [Google Cloud IAM Service Account Impersonation](https://cloud.google.com/iam/docs/impersonating-service-accounts)
2. [Firebase Functions IAM Requirements](https://firebase.google.com/docs/functions/iam)
3. [GitHub Actions Firebase Deployment Guide](https://firebase.google.com/docs/hosting/github-integration)
4. [Service Account User Role Documentation](https://cloud.google.com/iam/docs/understanding-roles#iam.serviceAccountUser)

## 🏷️ Tags
- `firebase-functions`
- `github-actions` 
- `iam-permissions`
- `deployment-issue`
- `service-account-impersonation`
- `ci-cd-pipeline`

---

**Last Updated:** 2025-09-17T12:15:00  
**Reporter:** Development Team  
**Priority:** P1 (High)  
**Status:** Under Investigation