# Firebase Functions Deployment

## Status: Manual Deployment Only

Firebase Functions deployment has been removed from GitHub Actions due to persistent IAM permission issues. 

## Current Functions

The following functions are available and working in production:

1. **generateQuiz** - Generate AI-powered quizzes
2. **getQuiz** - Retrieve quiz by ID  
3. **getUserQuizzes** - Get user's quiz history
4. **getRecentQuizzes** - Get recently created quizzes
5. **scrapeContent** - Scrape web content for quiz generation

## Manual Deployment

To deploy functions manually:

```bash
# From the functions directory
cd functions

# Install dependencies
yarn install

# Build the functions
yarn build

# Deploy using Firebase CLI
firebase deploy --only functions --project code-insights-quiz-ai
```

## GitHub Actions

GitHub Actions now only deploys:
- ✅ Firebase Hosting (web app)
- ✅ Firestore rules and indexes
- 🚫 Firebase Functions (manual deployment required)

This ensures reliable CI/CD pipeline for the web application while maintaining functions through manual deployment when needed.