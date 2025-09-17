# Deployment Configuration

This document outlines the environment variables and secrets required for the automated deployment pipeline.

## Required GitHub Secrets

### General Secrets
- `FIREBASE_SERVICE_ACCOUNT_CODE_INSIGHTS_QUIZ_AI`: Firebase service account key for authentication
  - Generate in Firebase Console → Project Settings → Service Accounts → Generate Private Key

### Production Environment
- `VITE_FIREBASE_API_KEY`: Firebase API key for web app
- `VITE_FIREBASE_AUTH_DOMAIN`: Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID`: Firebase project ID 
- `VITE_FIREBASE_STORAGE_BUCKET`: Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID`: Firebase app ID
- `VITE_GEMINI_API_KEY`: Google Generative AI API key

## Setting Up Firebase Project

### 1. Use Existing Firebase Project
The project is already configured to use `code-insights-quiz-ai` as the Firebase project.

### 2. Configure Firebase Features
In the Firebase Console, ensure these features are enabled:
- Authentication (Email/Password provider)
- Firestore Database
- Functions
- Hosting

### 3. Get Firebase Configuration
1. Go to Firebase Console → Project Settings → General
2. Scroll to "Your apps" section
3. Click on the web app or create a new one
4. Copy the configuration values to GitHub Secrets

### 4. Generate Service Account
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Copy the entire JSON content to `FIREBASE_SERVICE_ACCOUNT_CODE_INSIGHTS_QUIZ_AI` secret

## Environment Variables by Service

### React Web App (Frontend)
- `VITE_FIREBASE_API_KEY`: Firebase web API key
- `VITE_FIREBASE_AUTH_DOMAIN`: Firebase authentication domain (usually `project-id.firebaseapp.com`)
- `VITE_FIREBASE_PROJECT_ID`: Firebase project identifier (`code-insights-quiz-ai`)
- `VITE_FIREBASE_STORAGE_BUCKET`: Firebase storage bucket URL
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Firebase cloud messaging sender ID
- `VITE_FIREBASE_APP_ID`: Firebase app identifier
- `VITE_GEMINI_API_KEY`: Google Generative AI API key

### Firebase Functions (Backend)
Functions will use Firebase project configuration automatically.
For Gemini API access, configure using Firebase CLI:
```bash
firebase functions:config:set gemini.api_key="your-api-key"
```

## Deployment Process

### Automatic Deployment
- Push to `main` branch automatically triggers production deployment
- Tests must pass before deployment proceeds
- Both web app and functions are deployed together

### Manual Deployment
Use the "Deploy to Production" workflow in GitHub Actions tab with manual trigger.

## Security Best Practices

1. **Firebase Security Rules**: Implement proper Firestore security rules
2. **GitHub Secrets**: Never commit secrets to the repository
3. **API Key Restrictions**: Restrict Firebase API keys to your domain
4. **Functions Environment**: Set sensitive config in Firebase Functions config

## Local Development Setup

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Set up Firebase Emulators**:
   ```bash
   firebase init emulators
   # Select: Authentication, Functions, Firestore, Hosting
   ```

3. **Create Local Environment File**:
   ```bash
   # Create web/.env.local (not tracked by git)
   VITE_FIREBASE_API_KEY=demo-key
   VITE_FIREBASE_AUTH_DOMAIN=localhost
   VITE_FIREBASE_PROJECT_ID=demo-project
   VITE_FIREBASE_STORAGE_BUCKET=demo-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
   VITE_GEMINI_API_KEY=your-dev-gemini-key
   ```

4. **Start Development**:
   ```bash
   # Start emulators in one terminal
   firebase emulators:start
   
   # Start web app in another terminal
   nx serve web
   ```

## Troubleshooting

### Common Issues
1. **Service Account Key**: Ensure the JSON is properly formatted in GitHub Secrets
2. **Project Not Found**: Verify project ID is `code-insights-quiz-ai`
3. **Build Failures**: Check NX workspace configuration and dependencies
4. **Permission Denied**: Verify service account has proper Firebase roles

### Debugging Deployment
1. Check GitHub Actions logs
2. Verify environment variables are set correctly
3. Test deployment locally:
   ```bash
   # Test build
   nx build web --configuration=production
   nx build functions --configuration=production
   
   # Test deployment (requires Firebase login)
   firebase deploy
   ```

## Monitoring

### GitHub Actions Status
- View deployment status in GitHub Actions tab
- Automatic deployment on every push to main
- Manual deployment option available

### Firebase Console
- Monitor function execution and errors
- Check hosting deployment status
- Review database usage and performance