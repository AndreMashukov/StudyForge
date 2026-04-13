#!/bin/bash

# Firebase Functions GitHub Actions Deployment Fix
# This script applies the correct IAM permissions for Firebase Functions v2 deployment

PROJECT_ID="code-insights-quiz-ai"
GITHUB_SA="github-action-1057960904@code-insights-quiz-ai.iam.gserviceaccount.com"
APPENGINE_SA="code-insights-quiz-ai@appspot.gserviceaccount.com"

echo "🔧 Fixing Firebase Functions deployment permissions..."
echo "Project: $PROJECT_ID"
echo "GitHub Actions SA: $GITHUB_SA"
echo "App Engine SA: $APPENGINE_SA"
echo ""

# 1. Grant Service Account User role (you already have this)
echo "✅ Granting Service Account User role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/iam.serviceAccountUser"

# 2. Grant Service Account Token Creator role (you already have this)
echo "✅ Granting Service Account Token Creator role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/iam.serviceAccountTokenCreator"

# 3. CRITICAL: Grant Cloud Functions Admin role (for full deployment permissions)
echo "🎯 Granting Cloud Functions Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/cloudfunctions.admin"

# 4. CRITICAL: Grant Firestore Admin role (for datastore.indexes permissions)
echo "🎯 Granting Firestore Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/datastore.owner"

# 5. CRITICAL: Grant Firebase Rules Admin role  
echo "🎯 Granting Firebase Rules Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/firebaserules.admin"

# 6. CRITICAL: Grant Cloud Build Editor role (needed for Functions v2)
echo "🎯 Granting Cloud Build Editor role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/cloudbuild.builds.editor"

# 7. CRITICAL: Grant Artifact Registry Writer role (needed for Functions v2)
echo "🎯 Granting Artifact Registry Writer role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/artifactregistry.writer"

# 8. CRITICAL: Grant the SA permission to act as the App Engine SA
echo "🎯 Granting impersonation permissions on App Engine SA..."
gcloud iam service-accounts add-iam-policy-binding \
  $APPENGINE_SA \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/iam.serviceAccountUser" \
  --project=$PROJECT_ID

# 9. CRITICAL: Grant the SA permission to create tokens for App Engine SA
echo "🎯 Granting token creation permissions on App Engine SA..."
gcloud iam service-accounts add-iam-policy-binding \
  $APPENGINE_SA \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/iam.serviceAccountUser" \
  --project=$PROJECT_ID

# 10. CRITICAL: Also grant actAs permission directly on the App Engine SA
echo "🎯 Granting direct actAs permissions on App Engine SA..."
gcloud iam service-accounts add-iam-policy-binding \
  $APPENGINE_SA \
  --member="serviceAccount:$GITHUB_SA" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project=$PROJECT_ID

# 11. Enable required APIs (just in case)
echo "🔌 Enabling required APIs..."
gcloud services enable cloudfunctions.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudbuild.googleapis.com --project=$PROJECT_ID
gcloud services enable artifactregistry.googleapis.com --project=$PROJECT_ID
gcloud services enable run.googleapis.com --project=$PROJECT_ID

# 12. CRITICAL: Set Cloud Run invoker permissions for all callable functions
# Firebase Functions v2 are backed by Cloud Run, which is private by default.
# Callable functions handle auth internally — Cloud Run must allow requests through.
echo ""
echo "🔑 Setting Cloud Run invoker permissions for callable functions..."

REGION="asia-east1"
CALLABLE_FUNCTIONS=(
  # Rule-related functions
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
  # Interaction tracking functions
  "flushinteractionsession"
  "getinteractionstats"
)

for func in "${CALLABLE_FUNCTIONS[@]}"; do
  echo "  Setting IAM for $func..."
  gcloud run services add-iam-policy-binding "$func" \
    --region="$REGION" \
    --member="allUsers" \
    --role="roles/run.invoker" \
    --project="$PROJECT_ID" 2>/dev/null || echo "  ⚠️  Skipped $func (not deployed yet or already set)"
done

echo ""
echo "✅ IAM permissions configured successfully!"
echo "⏱️  Please wait 2-3 minutes for IAM changes to propagate."
echo "🚀 Then try running your GitHub Actions workflow again."
