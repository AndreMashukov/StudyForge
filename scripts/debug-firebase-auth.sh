#!/bin/bash

# Firebase Authentication Debug Script
# Run this locally to test your service account permissions

PROJECT_ID="code-insights-quiz-ai"
GITHUB_SA="github-action-1057960904@code-insights-quiz-ai.iam.gserviceaccount.com"
APPENGINE_SA="code-insights-quiz-ai@appspot.gserviceaccount.com"

echo "🔍 Firebase Authentication Debug Script"
echo "======================================"
echo ""

# Check if gcloud is authenticated
echo "1. Checking gcloud authentication..."
if gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1; then
    echo "✅ gcloud is authenticated"
else
    echo "❌ gcloud is not authenticated"
    echo "Please run: gcloud auth login"
    exit 1
fi

echo ""

# Check project access
echo "2. Checking project access..."
if gcloud projects describe $PROJECT_ID > /dev/null 2>&1; then
    echo "✅ Can access project $PROJECT_ID"
else
    echo "❌ Cannot access project $PROJECT_ID"
    exit 1
fi

echo ""

# Check GitHub Actions service account
echo "3. Checking GitHub Actions service account..."
if gcloud iam service-accounts describe $GITHUB_SA --project=$PROJECT_ID > /dev/null 2>&1; then
    echo "✅ GitHub Actions service account exists"
else
    echo "❌ GitHub Actions service account not found"
fi

echo ""

# Check App Engine service account
echo "4. Checking App Engine service account..."
if gcloud iam service-accounts describe $APPENGINE_SA --project=$PROJECT_ID > /dev/null 2>&1; then
    echo "✅ App Engine service account exists"
else
    echo "❌ App Engine service account not found"
fi

echo ""

# Check IAM permissions
echo "5. Checking IAM permissions..."
echo "GitHub Actions service account roles:"
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:$GITHUB_SA"

echo ""
echo "App Engine service account permissions (for impersonation):"
gcloud iam service-accounts get-iam-policy $APPENGINE_SA \
  --project=$PROJECT_ID \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:$GITHUB_SA"

echo ""

# Check Firebase CLI authentication
echo "6. Testing Firebase CLI authentication..."
if command -v firebase > /dev/null 2>&1; then
    echo "✅ Firebase CLI is installed"
    
    echo "Current Firebase projects:"
    firebase projects:list 2>/dev/null || echo "❌ Cannot list Firebase projects"
    
    echo ""
    echo "Testing Firebase login status:"
    firebase login:list 2>/dev/null || echo "❌ Firebase login failed"
    
else
    echo "❌ Firebase CLI is not installed"
    echo "Install with: npm install -g firebase-tools"
fi

echo ""

# Check required APIs
echo "7. Checking required APIs..."
required_apis=(
    "cloudfunctions.googleapis.com"
    "cloudbuild.googleapis.com"
    "artifactregistry.googleapis.com"
    "firebase.googleapis.com"
    "run.googleapis.com"
)

for api in "${required_apis[@]}"; do
    if gcloud services list --enabled --filter="name:$api" --format="value(name)" | grep -q "$api"; then
        echo "✅ $api is enabled"
    else
        echo "❌ $api is not enabled"
        echo "   Enable with: gcloud services enable $api --project=$PROJECT_ID"
    fi
done

echo ""
echo "🏁 Debug complete!"
echo ""
echo "If you see any ❌ errors above, please fix them before attempting deployment."
echo "If everything shows ✅, the issue might be with GitHub Actions environment or IAM propagation delays."
