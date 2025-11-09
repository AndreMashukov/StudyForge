# Environment Variables Guide for Firebase Backups

## For Firebase Backup Scripts

The backup scripts (`backup-firebase.ts`, `backup-firebase-auth.ts`, `backup-firestore.ts`) use Firebase Admin SDK, which requires different authentication than the web app.

### Option 1: Use Service Account Key File (Recommended for Production)

Add to your `.env.local` or export in your shell:

```bash
# Path to your Firebase service account JSON key file
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"

# Optional: Explicitly set project ID (if not in service account)
export GCLOUD_PROJECT="code-insights-quiz-ai"
```

**To get a service account key:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `code-insights-quiz-ai`
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Save the JSON file securely (e.g., `~/.config/firebase-service-account.json`)
6. Set the path in `GOOGLE_APPLICATION_CREDENTIALS`

### Option 2: Use Firebase Emulators (For Local Testing)

Add to your `.env.local`:

```bash
# Firebase Emulator Configuration
export FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
export FIRESTORE_EMULATOR_HOST="localhost:8080"
export GCLOUD_PROJECT="code-insights-quiz-ai"
```

**Note:** Make sure Firebase emulators are running:
```bash
firebase emulators:start
```

### Option 3: Use Application Default Credentials

If you have `gcloud` CLI installed, you can authenticate once:

```bash
gcloud auth application-default login
```

Then you don't need any environment variables in `.env.local` for backups.

---

## For Web App (Client-Side Firebase Config)

The web app uses `NX_PUBLIC_*` prefixed variables. These are different from Admin SDK credentials:

```bash
# Web App Firebase Configuration (Client-Side)
NX_PUBLIC_FIREBASE_API_KEY="your-api-key"
NX_PUBLIC_FIREBASE_AUTH_DOMAIN="code-insights-quiz-ai.firebaseapp.com"
NX_PUBLIC_FIREBASE_PROJECT_ID="code-insights-quiz-ai"
NX_PUBLIC_FIREBASE_STORAGE_BUCKET="code-insights-quiz-ai.appspot.com"
NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NX_PUBLIC_FIREBASE_APP_ID="your-app-id"

# Optional: Use Firebase Emulators for web app
NX_PUBLIC_USE_FIREBASE_EMULATOR="true"
```

---

## Complete Example `.env.local`

```bash
# ============================================
# Firebase Admin SDK (for backup scripts)
# ============================================
# Option A: Service Account Key File
export GOOGLE_APPLICATION_CREDENTIALS="/Users/yourusername/.config/firebase-service-account.json"

# Option B: Emulators (comment out Option A if using this)
# export FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
# export FIRESTORE_EMULATOR_HOST="localhost:8080"

# Project ID (optional, usually in service account)
export GCLOUD_PROJECT="code-insights-quiz-ai"

# ============================================
# Web App Firebase Config (Client-Side)
# ============================================
NX_PUBLIC_FIREBASE_API_KEY="your-api-key-here"
NX_PUBLIC_FIREBASE_AUTH_DOMAIN="code-insights-quiz-ai.firebaseapp.com"
NX_PUBLIC_FIREBASE_PROJECT_ID="code-insights-quiz-ai"
NX_PUBLIC_FIREBASE_STORAGE_BUCKET="code-insights-quiz-ai.appspot.com"
NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789012"
NX_PUBLIC_FIREBASE_APP_ID="1:123456789012:web:your-app-id"

# Optional: Use emulators for web app
# NX_PUBLIC_USE_FIREBASE_EMULATOR="true"

# ============================================
# Other Environment Variables
# ============================================
# Add any other environment variables your app needs
```

---

## Quick Check

To verify your `.env.local` is set up correctly for backups:

```bash
# Source your .env.local file
source .env.local

# Check if GOOGLE_APPLICATION_CREDENTIALS is set
echo $GOOGLE_APPLICATION_CREDENTIALS

# Or check if emulator variables are set
echo $FIREBASE_AUTH_EMULATOR_HOST
echo $FIRESTORE_EMULATOR_HOST

# Then try running backup
yarn backup:firebase
```

---

## Important Notes

1. **`.env.local` is gitignored** - Never commit service account keys or API keys to git
2. **Service Account Keys** - Store securely, rotate regularly, limit access
3. **Emulators** - Use for local development/testing, not production backups
4. **Project ID** - Your project ID appears to be `code-insights-quiz-ai` based on the codebase

