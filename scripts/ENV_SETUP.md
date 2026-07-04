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

---

## Gemini API key rotation (P0 security)

If a Gemini key was ever committed to git, treat it as **compromised** even after deleting the file. History and clones may still contain it.

### 1. Revoke the exposed key

1. Open [Google AI Studio → API keys](https://aistudio.google.com/apikey).
2. Delete or restrict the leaked key immediately.

### 2. Mint a replacement

Create a new key in AI Studio. Store it only in approved secret stores — never in tracked files.

| Environment | Where to store |
|-------------|----------------|
| **Production Functions** | Firebase / GCP Secret Manager |
| **Local emulator** | `functions/.secret.local` (gitignored; copy from `functions/.secret.local.example`) |
| **Local scripts / seed** | `functions/.env` or `functions/.env.local` |
| **CI web build** | GitHub secret `NX_PUBLIC_GEMINI_API_KEY` (if used client-side) |

Production secret commands (project `study-forge-202604`):

```bash
firebase functions:secrets:set GEMINI_API_KEY --project study-forge-202604
firebase functions:secrets:set LLM_SETTINGS_ENCRYPTION_KEY --project study-forge-202604
yarn nx run functions:deploy
```

### 3. Local setup after rotation

```bash
cp functions/.secret.local.example functions/.secret.local
# Edit functions/.secret.local with your new key

cp functions/.env.example functions/.env
# Edit functions/.env with the same GEMINI_API_KEY for seed scripts
```

### 4. Purge leaked files from git history

After untracking and gitignoring `.secret.local`, rewrite history and force-push (coordinate with all collaborators):

```bash
git filter-repo --path .secret.local --invert-paths --force
git push --force-with-lease origin main
```

All contributors must re-clone or reset local branches after the force push.

### 5. Secret scanning

Install pre-commit scanning locally:

```bash
brew install gitleaks
./scripts/setup-git-hooks.sh
```

CI runs `gitleaks/gitleaks-action` on every push and PR (see `.github/workflows/ci.yml`).

---

## App Check (P0 security)

Callable Cloud Functions enforce App Check globally. The web app initializes App Check in both production and emulator modes via `web/src/config/firebase.ts`.

### Setup

1. Register the web app in Firebase Console → **App Check** with reCAPTCHA v3.
2. Set `NX_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` locally and as a GitHub secret for production builds.
3. Deploy functions after changing enforcement: `yarn nx run functions:deploy`.

### Local emulator

With `enforceAppCheck: true`, emulator callables reject requests without a valid App Check token. The web dev client enables debug tokens automatically — register the token from the browser console under App Check → **Manage debug tokens**.

### Firebase Console rollout (Firestore / Storage)

Use monitor mode first, then enforce per product in App Check settings. Callable enforcement is controlled in functions code, not the Console.

### HTTP (`onRequest`) routes

`onRequest` handlers do not inherit `enforceAppCheck`. Use `functions/src/lib/app-check-verification.ts` for first-party HTTP routes. Public probes (`healthCheck`) and third-party API-key routes (`api`) intentionally skip App Check.

