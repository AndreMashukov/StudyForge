# Quick Setup Guide for Firebase Emulator Backups

## Add These Lines to Your `.env.local` File

Open your `.env.local` file and add these lines:

```bash
# Firebase Emulator Configuration (NO CREDENTIALS NEEDED!)
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIRESTORE_EMULATOR_HOST=localhost:8080
GCLOUD_PROJECT=code-insights-quiz-ai
```

## Complete Example `.env.local` Structure

Your `.env.local` should look something like this:

```bash
# ============================================
# Firebase Emulator (for backup scripts)
# ============================================
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIRESTORE_EMULATOR_HOST=localhost:8080
GCLOUD_PROJECT=code-insights-quiz-ai

# ============================================
# Web App Firebase Config (Client-Side)
# ============================================
NX_PUBLIC_FIREBASE_API_KEY=your-api-key
NX_PUBLIC_FIREBASE_AUTH_DOMAIN=code-insights-quiz-ai.firebaseapp.com
NX_PUBLIC_FIREBASE_PROJECT_ID=code-insights-quiz-ai
NX_PUBLIC_FIREBASE_STORAGE_BUCKET=code-insights-quiz-ai.appspot.com
NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NX_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:your-app-id

# Optional: Use emulators for web app too
# NX_PUBLIC_USE_FIREBASE_EMULATOR=true
```

## After Adding These Variables

1. **Make sure Firebase emulators are running:**
   ```bash
   firebase emulators:start
   ```

2. **Run the backup:**
   ```bash
   yarn backup:firebase
   ```

3. **You should see:**
   ```
   ✅ Firebase Admin SDK initialized (Emulator mode - NO CREDENTIALS NEEDED)
   ```

## Important Notes

- **No credentials needed** when using emulators
- The emulator variables tell Firebase Admin SDK to connect locally
- Make sure emulators are running before backing up
- These variables are only for the backup scripts, not for production

