# StudyForge Chrome Extension — Screenshot Capture & Document Creation Plan

**Goal:** Build a Chrome extension that captures the visible viewport on a Chrome command shortcut, sends the screenshot to the StudyForge external API, and creates a document with the target directory's inherited rules.

**Architecture:** Two-part feature: (1) new backend endpoint that accepts base64-encoded screenshots and uses Gemini multimodal to generate a markdown document, (2) CRXJS+Vite Chrome extension in the NX monorepo with a service worker for capture+sending, a popup for settings (API key, API URL, app URL, command→directoryId mapping), and silent notifications on completion.

**Tech Stack:** CRXJS v2 (Vite plugin), React, TypeScript, `chrome.*` APIs (commands, tabs, storage, notifications), `@google/genai` (Gemini multimodal), Firebase Functions, Firebase Auth (API key validation)

---

## Current State

- **Backend:** StudyForge has Firebase Callable Functions + an external REST API at `/api/*` that authenticates via `X-API-Key` or `Authorization: Bearer sf-...` headers.
- **API key management:** Fully built — users create/revoke keys at `/settings` page. Keys are `sf-` prefix + 64 hex chars.
- **Document creation:** `generateFromPrompt` accepts text prompt + optional text files (text/plain, text/markdown), resolves directory rules via `resolveEffectiveRules()`, calls Gemini to generate markdown, saves as document.
- **Gemini:** Uses `@google/genai` SDK (`GoogleGenAI`). Currently text-only for documents. Already uses `InlineDataPart` for image generation (slide deck images).
- **Rule system:** `resolveEffectiveRules()` walks directory hierarchy collecting rules, filtering by `RuleApplicability`, formats for prompt injection. Supports `inherit`, `inherit-plus-explicit`, `explicit-only` modes.
- **No Chrome extension exists** in the repo.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth | API key (`X-API-Key` header) | Simpler than Firebase Auth in extension; keys already exist in SF settings |
| Screenshot scope | Visible viewport only | Fastest capture; `chrome.tabs.captureVisibleTab()` zero-config |
| Flow | Silent auto-create + notification | User chose minimal friction; shortcut → capture → document appears |
| Commands | One capture command for MVP; multiple hotkeys later | Chrome shortcuts are user-remapped in `chrome://extensions/shortcuts`; additional commands require static manifest entries |
| Rules | Inherited from directory using `RuleApplicability.PROMPT` | Directory ID is pasted manually in settings; each directory has its own rules |
| Storage | Generated markdown document only | Do not persist the original screenshot for MVP |
| Settings | API key, API base URL, app base URL, command→directory ID | Stored in `chrome.storage.local`; API/app URLs remain editable for production/local use |
| Abuse control | Per-API-key cooldown/rate limit on screenshot generation | Prevent accidental expensive repeated Gemini calls from the hotkey |

---

## Implementation Patterns

Use these patterns to keep the MVP small without baking duplication into the first implementation.

| Pattern | Backend / Extension Use | Implementation Guidance |
|---------|--------------------------|-------------------------|
| Application Service / Use Case | `ScreenshotDocumentGenerationService` | Centralize screenshot validation, rule resolution, Gemini call, title extraction, and document creation. Callable and external API routes must delegate to this shared service. |
| Facade | Firebase callable + external REST route | Endpoint code should only handle transport concerns: auth, request/response shape, HTTP/callable error mapping, and rate-limit invocation. |
| Prompt Builder | `ScreenshotPromptBuilder` | Build screenshot extraction instructions in `functions/src/services/gemini/prompt-builder/`, matching existing Gemini prompt-builder style. Do not build long prompts inline in endpoint code. |
| Adapter / Gateway | `GeminiService`, Chrome APIs, external API client | Keep third-party calls behind narrow wrappers: Gemini multimodal generation, `chrome.tabs`, `chrome.notifications`, `chrome.storage`, and `fetch` to StudyForge. |
| Repository | Extension settings + rate-limit state | Use an `ExtensionSettingsRepository` wrapper over `chrome.storage.local`; use a Firestore-backed service for API-key rate-limit counters. |
| Guard / Validator | Screenshot request + extension settings | Centralize MIME/base64/size validation and required settings checks so background command handling stays readable. |
| Command Pattern | Chrome `commands.onCommand` listener | Treat `capture-screenshot` as a command dispatched to a handler. Future multiple hotkeys can add additional command names without rewriting capture logic. |
| Lightweight State Machine | Extension capture lifecycle | Model the service-worker flow as `idle → validating → capturing → uploading → success/error` to prevent duplicate in-flight captures and unclear notifications. |

---

## Part 1: Backend — Screenshot-to-Document Endpoint

### Task 1.1: Add shared types for screenshot generation

**Objective:** Define request/response types used by both frontend and cloud functions.

**Files:**
- Modify: `libs/shared-types/src/index.ts`

**Step 1: Add types**

Add after the existing `GenerateFromPromptRequest` / `GenerateFromPromptResponse`:

```typescript
/** POST /documents/generate-from-screenshot request */
export interface GenerateFromScreenshotRequest {
  /** Base64-encoded image data (PNG, JPEG, or WebP). Data URL prefix (data:image/...;base64,) is stripped server-side. */
  imageBase64: string;
  /** The directory to create the document in. Rules are inherited from this directory. */
  directoryId: string;
  /** Optional title override. If omitted, Gemini generates a title from the screenshot content. */
  title?: string;
  /** Optional additional prompt text appended to the screenshot analysis instruction. */
  prompt?: string;
  /** Optional explicit rule IDs. When provided, ruleResolutionMode defaults to 'explicit-only'. */
  ruleIds?: string[];
  /** Optional rule resolution mode override. Default: 'inherit' (uses directory rules only). */
  ruleResolutionMode?: RuleResolutionMode;
}

/** POST /documents/generate-from-screenshot successful response */
export interface GenerateFromScreenshotResponse {
  documentId: string;
  title: string;
  content: string;
  wordCount: number;
  metadata: {
    generatedAt: string;
    sourceType: 'screenshot';
    directoryId: string;
    prompt?: string;
  };
}
```

### Task 1.2: Add Gemini multimodal screenshot-to-document method

**Objective:** New method `generateDocumentFromScreenshot()` on `GeminiService` that sends a base64 image + prompt to Gemini and returns markdown. Keep prompt construction in a dedicated prompt builder.

**Files:**
- Modify: `functions/src/services/gemini/gemini.ts`
- Create: `functions/src/services/gemini/prompt-builder/screenshot-prompt-builder.ts`
- Modify: `functions/src/services/gemini/prompt-builder/index.ts`

**Step 1: Keep the existing GenAI import**

No additional `Type` import is needed for inline image parts. The current import should remain:
```typescript
import { FinishReason, GoogleGenAI } from '@google/genai';
```

**Step 2: Add the method**

First add `ScreenshotPromptBuilder` beside the existing prompt builders:

```typescript
export interface ScreenshotPromptInput {
  userPrompt?: string;
  rules?: string;
}

export class ScreenshotPromptBuilder {
  public static buildDocumentPrompt({ userPrompt, rules }: ScreenshotPromptInput): string {
    let prompt = `You are an educational content extraction AI. Analyze the provided screenshot and produce a comprehensive, well-structured Markdown document.

Instructions:
- Extract ALL visible text, preserving headings, paragraphs, lists, tables, and code blocks.
- Describe any diagrams, charts, or visual elements in detail using Markdown (use fenced blocks with 'mermaid' for diagrams when possible).
- Include relevant metadata (page title, author, date if visible).
- Preserve the hierarchical structure of the content.
- If the screenshot shows a UI, describe the interface, its purpose, and its components.
- Do NOT wrap the response in a Markdown code block.
- Start with a descriptive H1 heading summarizing the screenshot content.`;

    if (rules?.trim()) {
      prompt += `\n\nAdditional Rules for Content Generation:\n${rules.trim()}`;
    }

    if (userPrompt?.trim()) {
      prompt += `\n\nAdditional User Instructions:\n${userPrompt.trim()}`;
    }

    return prompt;
  }
}
```

Export it from `functions/src/services/gemini/prompt-builder/index.ts`, then import it in `gemini.ts` with the other prompt builders.

Add after the existing `generateDocumentFromPrompt` method (after line ~462):

```typescript
/**
 * Generate a markdown document from a screenshot image using Gemini multimodal.
 *
 * @param imageBase64 - Base64-encoded image data (with or without data URL prefix)
 * @param userPrompt - Optional additional context prompt (appended to system instruction)
 * @param rules - Optional rules text to inject into the system prompt
 * @returns Generated markdown document content
 */
public static async generateDocumentFromScreenshot(
  imageBase64: string,
  userPrompt?: string,
  rules?: string
): Promise<string> {
  try {
    functions.logger.info('Generating document from screenshot with Gemini AI', {
      imageSize: imageBase64.length,
      hasPrompt: !!userPrompt?.trim(),
      hasRules: !!rules?.trim(),
    });

    // Strip data URL prefix if present, keeping only the raw base64
    let mimeType = 'image/png';
    let rawBase64 = imageBase64;
    const dataUrlMatch = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      rawBase64 = dataUrlMatch[2];
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) {
      throw new Error(`Unsupported screenshot MIME type: ${mimeType}`);
    }

    const normalizedBase64 = rawBase64.replace(/\s/g, '');
    if (normalizedBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedBase64)) {
      throw new Error('Screenshot image data is not valid base64');
    }
    const decodedImage = Buffer.from(normalizedBase64, 'base64');
    if (decodedImage.length === 0) {
      throw new Error('Screenshot image data is empty');
    }
    rawBase64 = normalizedBase64;

    const client = this.getClient();
    const systemPrompt = ScreenshotPromptBuilder.buildDocumentPrompt({
      userPrompt,
      rules,
    });

    const response = await client.models.generateContent({
      model: GEMINI_PRO_MODEL, // gemini-pro-latest supports multimodal
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: rawBase64,
              },
            },
            { text: systemPrompt },
          ],
        },
      ],
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 16384,
      },
    });

    const text = response.text;

    if (!text) {
      throw new Error('Empty response from Gemini API for screenshot document generation');
    }

    const validatedContent = this.validateAndFixDocumentContent(text);

    functions.logger.info('Document generated from screenshot successfully', {
      length: validatedContent.length,
      wasFixed: validatedContent !== text,
    });

    return validatedContent;
  } catch (error) {
    functions.logger.error('Error generating document from screenshot:', error);
    throw new Error(
      `Failed to generate document from screenshot: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}
```

### Task 1.3: Add screenshot document application service and callable facade

**Objective:** Create one reusable backend use case for screenshot document generation, then expose it through a thin Firebase Callable Function.

**Files:**
- Create: `functions/src/services/screenshot-document-generation.ts`
- Modify: `functions/src/endpoints/documents.ts`

**Step 1: Import new types**

At top, add:
```typescript
import {
  // ... existing imports
  GenerateFromScreenshotRequest,
  GenerateFromScreenshotResponse,
} from '@shared-types';
import { ScreenshotDocumentGenerationService } from '../services/screenshot-document-generation';
```

**Step 2: Create the application service**

Move the common generation workflow into `ScreenshotDocumentGenerationService`. This service owns request validation beyond transport shape, directory validation, rule resolution, Gemini generation, title extraction, document creation, and response construction.

```typescript
export interface ScreenshotDocumentGenerationInput extends GenerateFromScreenshotRequest {
  userId: string;
}

export class ScreenshotDocumentGenerationService {
  public static async generate(
    input: ScreenshotDocumentGenerationInput
  ): Promise<GenerateFromScreenshotResponse> {
    // Validate imageBase64, directoryId, rule inputs
    // Validate directory ownership
    // Resolve rules with RuleApplicability.PROMPT
    // Call GeminiService.generateDocumentFromScreenshot()
    // Extract title, create generated document, and return response DTO
  }
}
```

Keep route-specific error mapping outside this service. The service should throw normal `Error`s or project-specific validation errors; callable/HTTP facades map them to `HttpsError` or HTTP status responses.

**Step 3: Add the callable facade**

Add after the existing `generateFromPrompt` export (after line ~1059), before the module end. The callable must delegate to `ScreenshotDocumentGenerationService` instead of duplicating the full workflow:

```typescript
export const generateFromScreenshot = onCall(
  {
    region: 'asia-east1',
    cors: true,
    secrets: [geminiApiKey],
    timeoutSeconds: 540,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as GenerateFromScreenshotRequest;

      logger.info('Generating document from screenshot', {
        userId,
        imageSize: data.imageBase64?.length,
        directoryId: data.directoryId,
        hasPrompt: !!data.prompt?.trim(),
      });

      const response = await ScreenshotDocumentGenerationService.generate({
        ...data,
        userId,
      });

      return { success: true, data: response };
    } catch (error) {
      logger.error('Error generating document from screenshot:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to generate document from screenshot');
    }
  }
);
```

For reference, the application service should contain the previous inline flow:

```typescript
// Inside ScreenshotDocumentGenerationService.generate()
const data = input;
const { userId } = input;

await directoryService.validateDirectoryId(userId, data.directoryId);

const mode = data.ruleIds?.length
  ? (data.ruleResolutionMode === 'explicit-only' || data.ruleResolutionMode === 'inherit-plus-explicit'
      ? data.ruleResolutionMode
      : 'explicit-only')
  : 'inherit';

const { text: rulesText, ruleIds: effectiveRuleIds } = await resolveEffectiveRules({
  userId,
  directoryId: data.directoryId,
  operation: RuleApplicability.PROMPT,
  additionalRuleIds: data.ruleIds || [],
  mode,
});

if (rulesText) {
  logger.info('Injecting effective rules into screenshot document generation', {
    ruleCount: effectiveRuleIds.length,
    userId,
    mode,
  });
}

const generatedContent = await GeminiService.generateDocumentFromScreenshot(
  data.imageBase64,
  data.prompt,
  rulesText
);
```

**Step 4: Export from index.ts**

Modify `functions/src/index.ts` to export the new function:
```typescript
export { generateFromScreenshot } from './endpoints/documents';
```

### Task 1.4: Add external API route for screenshot generation

**Objective:** Add `POST /api/documents/generate-from-screenshot` to the external API so the Chrome extension can call it with an API key.

**Files:**
- Modify: `functions/src/endpoints/external-api.ts`
- Modify: `docs/EXTERNAL_API.md`

**Step 0: Add per-API-key screenshot rate limiting**

**Objective:** Prevent accidental repeated shortcut presses from triggering expensive Gemini calls.

**Files:**
- Modify: `functions/src/lib/api-key-auth.ts`
- Create: `functions/src/services/api-rate-limit.ts`
- Modify: `functions/src/endpoints/external-api.ts`

**Step 0a: Expose API key identity from auth**

Keep the existing `validateApiKeyFromRequest(req): Promise<string>` wrapper for compatibility, but add a richer helper:

```typescript
export interface ExternalAuthResult {
  userId: string;
  credentialType: 'api-key' | 'firebase-id-token';
  apiKeyId?: string;
}

export async function validateExternalAuthFromRequest(req: Request): Promise<ExternalAuthResult> {
  // Same validation flow as validateApiKeyFromRequest(), but when an API key is used,
  // return the owning userId and the matching apiKeys document ID.
}
```

In `validateStoredApiKey()`, return both the owner user ID and `doc.id` internally so screenshot generation can rate-limit per key. Existing callers can continue receiving only `userId` through `validateApiKeyFromRequest()`.

**Step 0b: Add a Firestore-backed rate limiter**

Create `enforceScreenshotGenerationRateLimit()` with a conservative MVP policy:

```typescript
const SCREENSHOT_COOLDOWN_MS = 15_000;
const SCREENSHOT_WINDOW_MS = 60 * 60 * 1000;
const SCREENSHOT_MAX_PER_WINDOW = 30;
```

Store counters under a user-owned path such as:

```text
users/{userId}/apiRateLimits/screenshot_{apiKeyId}
```

Use a Firestore transaction to atomically enforce:
- at least 15 seconds between screenshot-generation starts per API key
- at most 30 screenshot generations per hour per API key

If the request was authenticated with a Firebase ID token instead of an API key, use `firebase_{userId}` as the fallback limiter key. The Chrome extension uses API keys, but this keeps the endpoint safe for manual testing.

**Step 0c: Use rich auth in the external API**

In `functions/src/endpoints/external-api.ts`, replace the top-level authentication assignment with:

```typescript
const auth = await validateExternalAuthFromRequest(req);
const userId = auth.userId;
```

Then call the limiter inside the screenshot route after request validation and before Gemini generation:

```typescript
await enforceScreenshotGenerationRateLimit({
  userId,
  limiterKey: auth.apiKeyId ? `api_key_${auth.apiKeyId}` : `firebase_${userId}`,
});
```

**Step 1: Import types**

At top, add:
```typescript
import {
  // ... existing imports
  GenerateFromScreenshotRequest,
  GenerateFromScreenshotResponse,
} from '@shared-types';
import { ScreenshotDocumentGenerationService } from '../services/screenshot-document-generation';
```

**Step 2: Add route handler**

Add inside the `onRequest` handler, before the 404 fallback (search for `res.status(404)`), after the existing `/documents/generate-from-prompt` block (after line ~1131):

```typescript
// POST /documents/generate-from-screenshot
if (method === 'POST' && path === '/documents/generate-from-screenshot') {
  const body: unknown = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    res.status(400).json({ success: false, error: 'Request body must be a JSON object.' });
    return;
  }
  const data = body as GenerateFromScreenshotRequest;

  if (!data.imageBase64 || typeof data.imageBase64 !== 'string') {
    res.status(400).json({ success: false, error: 'imageBase64 is required and must be a base64-encoded string.' });
    return;
  }

  if (data.imageBase64.length > 14_000_000) {
    res.status(400).json({ success: false, error: 'Image too large. Maximum 10MB base64-encoded.' });
    return;
  }

  if (!data.directoryId || typeof data.directoryId !== 'string' || !data.directoryId.trim()) {
    res.status(400).json({ success: false, error: 'directoryId is required.' });
    return;
  }

  await enforceScreenshotGenerationRateLimit({
    userId,
    limiterKey: auth.apiKeyId ? `api_key_${auth.apiKeyId}` : `firebase_${userId}`,
  });

  const response = await ScreenshotDocumentGenerationService.generate({
    ...data,
    userId,
  });

  res.status(201).json({ success: true, data: response });
  return;
}
```

**Step 3: Update external API docs and available route list**

- Add `POST /documents/generate-from-screenshot` to the external API route list in `functions/src/endpoints/external-api.ts`.
- Add the endpoint to `docs/EXTERNAL_API.md` with a screenshot request example.
- Update API key examples in `docs/EXTERNAL_API.md` to prefer the current `sf-` prefix. Legacy `ciai_` keys are still accepted by auth, but newly generated keys use `sf-`.

### Task 1.5: Build and deploy backend

**Objective:** TypeScript check, then deploy the cloud functions.

**Commands:**
```bash
cd /Users/andrey-mac/projects/study-forge
yarn install
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run shared-types:build
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:build
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:deploy-selected --functions=generateFromScreenshot,api --firebaseProject=study-forge-202604 --printOnly=false
```

---

## Part 2: Chrome Extension Setup (CRXJS + Vite)

### Task 2.1: Add extension NX project and dependencies

**Objective:** Scaffold the extension directory with CRXJS plugin.

**Files:**
- Create: `extension/project.json`
- Create: `extension/vite.config.ts`
- Create: `extension/manifest.config.ts`
- Create: `extension/tsconfig.json`
- Modify: `package.json` (add `@crxjs/vite-plugin` dep)

**Step 1: Install CRXJS**
```bash
cd /Users/andrey-mac/projects/study-forge
yarn add -D @crxjs/vite-plugin -W
```

**Step 2: Create `extension/project.json`**
```json
{
  "name": "extension",
  "$schema": "../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "extension/src",
  "projectType": "application",
  "tags": ["type:app", "platform:browser"],
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "options": { "outputPath": "dist/extension" }
    },
    "dev": {
      "executor": "@nx/vite:dev-server",
      "options": { "buildTarget": "extension:build" }
    }
  }
}
```

**Step 3: Create `extension/vite.config.ts`**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import manifest from './manifest.config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../node_modules/.vite/extension',
  plugins: [
    react(),
    crx({ manifest }),
    nxViteTsPaths(),
  ],
  build: {
    outDir: '../dist/extension',
    emptyOutDir: true,
  },
});
```

**Step 4: Create `extension/manifest.config.ts`**
```typescript
import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'StudyForge Capture',
  version: '1.0.0',
  description: 'Capture browser viewport screenshots and create StudyForge documents',
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'StudyForge Capture',
    default_icon: {
      16: 'public/icon-16.png',
      48: 'public/icon-48.png',
      128: 'public/icon-128.png',
    },
  },
  icons: {
    16: 'public/icon-16.png',
    48: 'public/icon-48.png',
    128: 'public/icon-128.png',
  },
  permissions: [
    'activeTab',
    'storage',
    'notifications',
  ],
  host_permissions: [
    'https://*.cloudfunctions.net/*',
    'https://studyforge.io/*',
    'http://127.0.0.1/*',
    'http://localhost/*',
  ],
  commands: {
    'capture-screenshot': {
      suggested_key: {
        default: 'Ctrl+Shift+P',
        mac: 'Command+Shift+P',
      },
      description: 'Capture viewport and create StudyForge document',
    },
  },
  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },
});
```

Notes:
- The shortcut is only a suggested default. Users can change or clear it in `chrome://extensions/shortcuts`.
- MVP ships one command. Multiple directory-specific hotkeys are a future enhancement and require additional static entries under `commands`.
- Editable API URLs must still match `host_permissions`; add any custom production API domain here before packaging.

**Step 5: Create `extension/tsconfig.json`**
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../dist/extension",
    "types": ["chrome", "vite/client"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "strict": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "references": []
}
```

### Task 2.2: Create extension popup (settings UI)

**Objective:** Build the React popup with API key config, editable API/app URLs, and command→directoryId mapping.

**Files:**
- Create: `extension/src/popup/index.html`
- Create: `extension/src/popup/main.tsx`
- Create: `extension/src/popup/App.tsx`
- Create: `extension/src/popup/App.styles.ts` (or use Tailwind if shared)

**Step 1: Create `extension/src/popup/index.html`**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StudyForge Capture</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

**Step 2: Create `extension/src/popup/main.tsx`**
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
```

**Step 3: Create `extension/src/popup/App.tsx`**

The popup should have:
- **SF API Key** text input (saved to `chrome.storage.local`)
- **API Base URL** text input (saved to `chrome.storage.local`)
- **App Base URL** text input (saved to `chrome.storage.local`, used when opening created documents)
- **Status indicator** (saved/unsaved)
- **Command→Directory mapping row**: shows the current Chrome shortcut and a pasted directory ID input
- **"Save" button** that writes to `chrome.storage.local`
- Reference the API base URL (configurable or default: `https://asia-east1-studyforge.cloudfunctions.net/api`)
- Keep capture silent: no per-capture prompt field in the MVP popup

```tsx
import React, { useState, useEffect } from 'react';

interface ExtensionSettings {
  apiKey: string;
  apiBaseUrl: string;
  appBaseUrl: string;
  directoryMappings: Record<string, string>; // command name → directoryId
}

interface CommandShortcut {
  name?: string;
  shortcut?: string;
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  apiKey: '',
  apiBaseUrl: 'https://asia-east1-studyforge.cloudfunctions.net/api',
  appBaseUrl: 'https://studyforge.io',
  directoryMappings: {
    'capture-screenshot': '', // MVP command
  },
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [commands, setCommands] = useState<CommandShortcut[]>([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.storage.local.get('settings', (result) => {
      chrome.commands.getAll((registeredCommands) => {
        setCommands(registeredCommands);
        if (result.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...result.settings });
        }
        setLoading(false);
      });
    });
  }, []);

  const getShortcutLabel = (commandName: string): string => {
    const command = commands.find((item) => item.name === commandName);
    return command?.shortcut || 'Not assigned';
  };

  const handleSave = () => {
    chrome.storage.local.set({ settings }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  if (loading) {
    return <div style={styles.container}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>StudyForge Capture</h1>

      {/* API Key */}
      <div style={styles.section}>
        <label style={styles.label}>SF API Key</label>
        <input
          type="password"
          style={styles.input}
          value={settings.apiKey}
          onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
          placeholder="sf-..."
        />
        <span style={styles.hint}>
          Get your key from StudyForge → Settings → API Keys
        </span>
      </div>

      {/* API Base URL */}
      <div style={styles.section}>
        <label style={styles.label}>API Base URL</label>
        <input
          type="text"
          style={styles.input}
          value={settings.apiBaseUrl}
          onChange={(e) => setSettings({ ...settings, apiBaseUrl: e.target.value })}
        />
      </div>

      {/* App Base URL */}
      <div style={styles.section}>
        <label style={styles.label}>App Base URL</label>
        <input
          type="text"
          style={styles.input}
          value={settings.appBaseUrl}
          onChange={(e) => setSettings({ ...settings, appBaseUrl: e.target.value })}
        />
      </div>

      {/* Command → Directory Mapping */}
      <div style={styles.section}>
        <h2 style={styles.subtitle}>Capture Command</h2>
        <span style={styles.hint}>
          Paste the StudyForge directory ID where captured documents should be created.
        </span>
        {Object.entries(settings.directoryMappings).map(([command, directoryId]) => (
          <div key={command} style={styles.mappingRow}>
            <label style={styles.label}>
              {getShortcutLabel(command)}
            </label>
            <input
              type="text"
              style={styles.input}
              value={directoryId}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  directoryMappings: {
                    ...settings.directoryMappings,
                    [command]: e.target.value,
                  },
                })
              }
              placeholder="Directory ID"
            />
          </div>
        ))}
        <span style={styles.hint}>
          Shortcut changes happen in chrome://extensions/shortcuts. Additional capture commands are out of scope for MVP.
        </span>
      </div>

      {/* Save */}
      <div style={styles.footer}>
        <button style={styles.button} onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default App;

// Inline styles (keep popup compact)
const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 320,
    padding: 16,
    fontFamily: 'system-ui, sans-serif',
    fontSize: 13,
    color: '#1a1a1a',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    margin: '0 0 16px 0',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: 600,
    margin: '0 0 8px 0',
  },
  section: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontWeight: 600,
    marginBottom: 4,
    fontSize: 12,
  },
  input: {
    width: '100%',
    padding: '6px 8px',
    fontSize: 13,
    border: '1px solid #ccc',
    borderRadius: 4,
    boxSizing: 'border-box',
    marginBottom: 4,
  },
  hint: {
    fontSize: 11,
    color: '#666',
    display: 'block',
  },
  mappingRow: {
    marginBottom: 8,
  },
  footer: {
    marginTop: 16,
  },
  button: {
    width: '100%',
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    backgroundColor: '#10B981',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
};
```

### Task 2.3: Create service worker (background)

**Objective:** Service worker that listens for the keyboard shortcut, dispatches to a capture command handler, sends to the SF API, and shows a notification.

**Files:**
- Create: `extension/src/background/main.ts`
- Create: `extension/src/background/CaptureScreenshotCommandHandler.ts`
- Create: `extension/src/services/ExtensionSettingsRepository.ts`
- Create: `extension/src/services/ExtensionSettingsValidator.ts`
- Create: `extension/src/services/ScreenshotCaptureService.ts`
- Create: `extension/src/services/StudyForgeApiClient.ts`
- Create: `extension/src/services/NotificationService.ts`

Use this extension-side structure:

| File | Pattern | Responsibility |
|------|---------|----------------|
| `background/main.ts` | Facade / entrypoint | Register Chrome event listeners and pass commands to handlers. |
| `CaptureScreenshotCommandHandler.ts` | Command Pattern + state machine | Own `idle → validating → capturing → uploading → success/error`, prevent concurrent captures, coordinate services. |
| `ExtensionSettingsRepository.ts` | Repository | Read/write settings from `chrome.storage.local`. |
| `ExtensionSettingsValidator.ts` | Guard / Validator | Check API key, API URL, app URL, and mapped directory ID before capture. |
| `ScreenshotCaptureService.ts` | Adapter | Wrap `chrome.tabs.captureVisibleTab()`. |
| `StudyForgeApiClient.ts` | Gateway / Adapter | Wrap `fetch()` calls to `/documents/generate-from-screenshot`. |
| `NotificationService.ts` | Adapter | Wrap `chrome.notifications` and notification click URL storage. |

`background/main.ts` should stay tiny:

```typescript
const handler = new CaptureScreenshotCommandHandler({
  settingsRepository: new ExtensionSettingsRepository(),
  settingsValidator: new ExtensionSettingsValidator(),
  screenshotCaptureService: new ScreenshotCaptureService(),
  studyForgeApiClient: new StudyForgeApiClient(),
  notificationService: new NotificationService(),
});

chrome.commands.onCommand.addListener((command) => {
  void handler.handle(command);
});
```

The following service-worker code shows the logic to distribute across those files rather than a required single-file implementation:

```typescript
interface ExtensionSettings {
  apiKey: string;
  apiBaseUrl: string;
  appBaseUrl: string;
  directoryMappings: Record<string, string>;
}

const DEFAULT_API_BASE_URL = 'https://asia-east1-studyforge.cloudfunctions.net/api';
const DEFAULT_APP_BASE_URL = 'https://studyforge.io';

async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get('settings', (result) => {
      resolve({
        apiKey: '',
        apiBaseUrl: DEFAULT_API_BASE_URL,
        appBaseUrl: DEFAULT_APP_BASE_URL,
        directoryMappings: {},
        ...(result.settings || {}),
      });
    });
  });
}

/**
 * Capture the current tab's visible viewport as a base64 data URL.
 */
async function captureViewport(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      { format: 'png' },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!dataUrl) {
          reject(new Error('Failed to capture tab'));
          return;
        }
        resolve(dataUrl);
      }
    );
  });
}

/**
 * POST the screenshot to the StudyForge external API.
 */
async function sendToStudyForge(
  imageBase64: string,
  directoryId: string,
  apiKey: string,
  apiBaseUrl: string
): Promise<{ documentId: string; title: string }> {
  const url = `${apiBaseUrl.replace(/\/+$/, '')}/documents/generate-from-screenshot`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      imageBase64,
      directoryId,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage: string;
    try {
      const parsed = JSON.parse(errorBody);
      errorMessage = parsed.error || `HTTP ${response.status}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${errorBody.substring(0, 200)}`;
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Unknown API error');
  }

  return {
    documentId: result.data.documentId,
    title: result.data.title,
  };
}

/**
 * Show a Chrome notification.
 */
function buildDocumentUrl(appBaseUrl: string, documentId: string): string {
  return `${appBaseUrl.replace(/\/+$/, '')}/document/${encodeURIComponent(documentId)}`;
}

function showNotification(title: string, message: string, documentUrl?: string): void {
  chrome.notifications.create(
    {
      type: 'basic',
      iconUrl: 'public/icon-48.png',
      title,
      message,
      priority: 0,
    },
    (notificationId) => {
      if (documentUrl && notificationId) {
        chrome.storage.local.set({ [`notification_${notificationId}`]: documentUrl });
      }
    }
  );
}

// Listen for notification clicks to open the document in SF
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.storage.local.get(`notification_${notificationId}`, (result) => {
    const documentUrl = result[`notification_${notificationId}`];
    if (documentUrl) {
      chrome.tabs.create({
        url: documentUrl,
      });
      chrome.storage.local.remove(`notification_${notificationId}`);
    }
  });
});

// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const settings = await getSettings();

    if (!settings.apiKey) {
      showNotification(
        'StudyForge Capture',
        'No API key configured. Open the extension popup to set your API key.'
      );
      return;
    }

    const directoryId = settings.directoryMappings[command];
    if (!directoryId) {
      showNotification(
        'StudyForge Capture',
        `No directory mapped for this shortcut. Open the extension popup to configure settings.`
      );
      return;
    }

    // Show a "Capturing..." notification
    showNotification('StudyForge Capture', 'Capturing viewport...');

    // Capture the viewport
    const imageDataUrl = await captureViewport();

    // Send to StudyForge
    const result = await sendToStudyForge(
      imageDataUrl,
      directoryId,
      settings.apiKey,
      settings.apiBaseUrl
    );

    // Show success notification
    showNotification(
      'StudyForge Capture',
      `Document "${result.title}" created!`,
      buildDocumentUrl(settings.appBaseUrl, result.documentId)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    showNotification('StudyForge Capture — Error', message);
  }
});
```

### Task 2.4: Create extension icons

**Objective:** Create placeholder icon PNGs (16, 48, 128px) for the extension.

**Files:**
- Create: `extension/public/icon-16.png`
- Create: `extension/public/icon-48.png`
- Create: `extension/public/icon-128.png`

Use a simple SF-themed icon (green/educational motif). For now, generate minimal placeholder PNGs.

### Task 2.5: Add type declarations for Chrome APIs

**Objective:** Add `@types/chrome` dependency.

**Step 1:** Install chrome types
```bash
cd /Users/andrey-mac/projects/study-forge
yarn add -D @types/chrome -W
```

### Task 2.6: Build and test extension

**Objective:** Verify the extension builds and can be loaded into Chrome.

**Commands:**
```bash
cd /Users/andrey-mac/projects/study-forge
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run extension:build
```

**Verification:**
- Load unpacked from `dist/extension/` in chrome://extensions (Developer mode ON)
- Click the extension icon → popup opens with settings UI
- Configure API key, API base URL, app base URL, and directory ID in settings
- Press Ctrl+Shift+P on any tab → screenshot is captured and sent to SF API

---

## Part 3: Integration & Polish

### Task 3.1: End-to-end TypeScript check

```bash
cd /Users/andrey-mac/projects/study-forge
yarn install
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run web:lint
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run shared-types:build
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:build
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run extension:build
```

### Task 3.2: Manual E2E test flow

1. **Set up:** Create an API key in StudyForge Settings page
2. **Configure extension:** Paste API key, API base URL, app base URL, and directory ID in popup
3. **Navigate to a content-rich page** (e.g., Wikipedia article, docs page)
4. **Press the assigned extension shortcut** (suggested default: Ctrl+Shift+P, or Cmd+Shift+P on Mac)
5. **Verify:** Notification appears → "Document 'X' created!"
6. **Click notification** → opens document in StudyForge
7. **Verify content:** Generated markdown accurately reflects the screenshot

---

## Files Summary

### New files (extension/)
| File | Purpose |
|------|---------|
| `extension/project.json` | NX project config |
| `extension/vite.config.ts` | Vite + CRXJS plugin |
| `extension/manifest.config.ts` | Chrome extension manifest (M3) |
| `extension/tsconfig.json` | TypeScript config |
| `extension/src/popup/index.html` | Popup HTML entry |
| `extension/src/popup/main.tsx` | Popup React entry |
| `extension/src/popup/App.tsx` | Settings UI (API key, API/app URLs, directory mapping) |
| `extension/src/background/main.ts` | Service worker entrypoint and command listener registration |
| `extension/src/background/CaptureScreenshotCommandHandler.ts` | Capture command orchestration and lifecycle state |
| `extension/src/services/ExtensionSettingsRepository.ts` | `chrome.storage.local` settings repository |
| `extension/src/services/ExtensionSettingsValidator.ts` | Settings guard/validator |
| `extension/src/services/ScreenshotCaptureService.ts` | `chrome.tabs.captureVisibleTab()` adapter |
| `extension/src/services/StudyForgeApiClient.ts` | StudyForge external API client |
| `extension/src/services/NotificationService.ts` | `chrome.notifications` adapter |
| `extension/public/icon-16.png` | Extension icon 16px |
| `extension/public/icon-48.png` | Extension icon 48px |
| `extension/public/icon-128.png` | Extension icon 128px |

### Modified files (backend)
| File | Change |
|------|--------|
| `libs/shared-types/src/index.ts` | Add `GenerateFromScreenshotRequest`, `GenerateFromScreenshotResponse` |
| `functions/src/services/screenshot-document-generation.ts` | Shared screenshot-to-document application service |
| `functions/src/services/gemini/gemini.ts` | Add `generateDocumentFromScreenshot()` method |
| `functions/src/services/gemini/prompt-builder/screenshot-prompt-builder.ts` | Dedicated screenshot extraction prompt builder |
| `functions/src/services/gemini/prompt-builder/index.ts` | Export screenshot prompt builder |
| `functions/src/services/api-rate-limit.ts` | Add per-API-key screenshot generation throttle |
| `functions/src/lib/api-key-auth.ts` | Expose authenticated API key identity for rate limiting |
| `functions/src/endpoints/documents.ts` | Add `generateFromScreenshot` callable function |
| `functions/src/endpoints/external-api.ts` | Add `POST /documents/generate-from-screenshot` route |
| `functions/src/index.ts` | Export `generateFromScreenshot` |
| `package.json` | Add `@crxjs/vite-plugin`, `@types/chrome` dev deps |
| `docs/EXTERNAL_API.md` | Document screenshot generation endpoint and current `sf-` key prefix |

---

## Risks & Tradeoffs

| Risk | Mitigation |
|------|------------|
| Gemini multimodal quality varies with screenshot content | Keep MVP silent, but inject directory prompt rules through `RuleApplicability.PROMPT`; API type keeps optional `prompt` for future/manual calls |
| 5MB Firebase callable payload limit (screenshots can hit this) | Extension uses the external API route; cap screenshot payloads at 10MB base64 and stay below Gemini's 20MB inline request limit |
| `chrome.tabs.captureVisibleTab()` can fail on chrome:// pages, file:// URLs | Error handling in service worker shows notification explaining the limitation |
| API key stored in plaintext in `chrome.storage.local` | Acceptable risk for MVP; keys can be revoked; extension permissions are minimal |
| Hotkey conflicts with other extensions or browser shortcuts | Show the actual assigned shortcut via `chrome.commands.getAll()` and tell users to remap in `chrome://extensions/shortcuts` |
| Repeated hotkey presses can trigger costly Gemini calls | Firestore-backed per-API-key cooldown and hourly limit before generation starts |
| API base URL is editable but host permissions are static | Include known production/local hosts in `host_permissions`; custom API domains require a manifest update before packaging |

---

## Future Enhancements (out of scope)

- **Full-page capture:** Scroll + stitch for long pages (adds complexity, user chose viewport-only)
- **Multiple hotkeys:** Support for more than one command with different directories (requires additional static manifest `commands` entries)
- **Area selection:** Crop/select region before capture (requires content script + canvas)
- **Firebase Auth in extension:** OAuth flow instead of API key (more secure, much more complex)
- **Offline queue:** Queue captures when offline, retry on connectivity
- **Rich notification with preview thumbnail**
