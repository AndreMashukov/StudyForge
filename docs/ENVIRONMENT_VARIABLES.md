# Environment Variables Setup

This project uses NX workspace environment variables for centralized configuration management. The web application supports both `NX_PUBLIC_` and `VITE_` prefixed variables for maximum compatibility.

## Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your actual Firebase project configuration values.

## Important: Vite Configuration for NX_PUBLIC_ Variables

The web application uses Vite, which by default only exposes `VITE_` prefixed environment variables to the browser. To support `NX_PUBLIC_` variables (which is the Nx convention), the Vite configuration in `web/vite.config.ts` includes:

```typescript
export default defineConfig(() => ({
  // Configure Vite to load environment variables with both prefixes
  envPrefix: ['VITE_', 'NX_PUBLIC_'],
  // ... other config
}));
```

This allows both `NX_PUBLIC_` and `VITE_` prefixed variables to be accessible via `import.meta.env` in the browser.

## Available Environment Variables

### Server-side Environment Variables (NX_ prefix)
- `NX_FIREBASE_REGION` - Firebase functions region (default: asia-east1)  
- `NX_ENVIRONMENT` - Set to `development` for emulator, `production` for deployed services
- `USE_GEMINI_MOCK_LOCAL` - Set to `true` to force mock quiz generation in local development (for geographic restrictions)

### Public Environment Variables (NX_PUBLIC_ prefix)
These are accessible in both server-side and client-side code:
- `NX_PUBLIC_FIREBASE_PROJECT_ID` - Your Firebase project ID
- `NX_PUBLIC_FIREBASE_AUTH_DOMAIN` - Your Firebase auth domain
- `NX_PUBLIC_FIREBASE_STORAGE_BUCKET` - Your Firebase storage bucket
- `NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Your Firebase messaging sender ID
- `NX_PUBLIC_FIREBASE_APP_ID` - Your Firebase app ID

### Client-side Only (VITE_ prefix)
These are only available in Vite-based applications (web):
- `VITE_FIREBASE_API_KEY` - Firebase API key (sensitive, client-side only)
- `VITE_GEMINI_API_KEY` - Gemini API key (for AI features)

## Usage in Node.js Scripts

Public environment variables are available in Node.js scripts using:

```javascript
const firebaseConfig = {
  projectId: process.env.NX_PUBLIC_FIREBASE_PROJECT_ID,
  authDomain: process.env.NX_PUBLIC_FIREBASE_AUTH_DOMAIN,
  storageBucket: process.env.NX_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NX_PUBLIC_FIREBASE_APP_ID
};

const functions = getFunctions(app, process.env.NX_FIREBASE_REGION);
```

## Usage in React/Vite Applications

For client-side applications in the web project, you can use NX_PUBLIC_ variables directly:

```typescript
// Using NX_PUBLIC_ variables (recommended for NX workspaces)
const firebaseConfig = {
  apiKey: import.meta.env.NX_PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.NX_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.NX_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.NX_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.NX_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.NX_PUBLIC_FIREBASE_APP_ID
};

// Use emulator setting
const useEmulator = import.meta.env.NX_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
```

### Fallback Pattern (Recommended)
For maximum compatibility, use both NX and VITE prefixes with fallbacks:

```typescript
const firebaseConfig = {
  apiKey: import.meta.env.NX_PUBLIC_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || "demo-key",
  authDomain: import.meta.env.NX_PUBLIC_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
  projectId: import.meta.env.NX_PUBLIC_FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  // ... other config
};
```

This pattern allows you to:
- Use NX workspace environment variables (preferred)
- Fall back to VITE_ variables for CI/CD environments that don't support NX_PUBLIC_
- Provide demo values for initial setup

### Why Both Prefixes?

- **NX_PUBLIC_**: Nx workspace convention, works great in development
- **VITE_**: Standard Vite convention, often required by CI/CD systems
- **Fallback strategy**: Ensures compatibility across different deployment environments

## Environment Variable Prefixes

- `NX_` - Server-side only (Node.js, Firebase Functions)
- `NX_PUBLIC_` - Available in both server-side and client-side code
- `VITE_` - Client-side only (exposed to browser in Vite applications)

**Security Note**: Both `NX_PUBLIC_` and `VITE_` prefixed variables are exposed to the browser, so avoid including sensitive data in these variables.

## Geographic Restrictions for Gemini API

The Google Gemini API has geographic restrictions and may not be available in all regions. If you encounter the error "User location is not supported for the API use" when running locally:

### Automatic Fallback
The application automatically detects when running in the Firebase emulator and will use mock quiz generation if geographic restrictions are encountered. This allows you to:
- Continue developing and testing locally
- Test the complete quiz generation flow with realistic mock data
- Deploy to production where the API works from supported cloud regions

### Manual Configuration
You can explicitly enable mock mode by setting:
```bash
export USE_GEMINI_MOCK_LOCAL=true
# OR
export NX_ENVIRONMENT=development
```

### Production Deployment
- ✅ Works in Firebase Functions (cloud deployment)
- ❌ May not work in local emulator (depending on your location)
- 🔄 Automatic fallback to mock quiz generation for local development

The mock quiz generator creates realistic questions based on the scraped content, allowing you to test the complete application flow even when the Gemini API is not accessible locally.