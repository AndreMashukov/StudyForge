# StudyForge Mobile Capture

Expo development-build app for document scanning, on-device OCR, and upload to StudyForge via Firebase callables.

Stack aligns with [expo_app_stack_2026.md](../docs/tasks/16-mobile-ocr-app/expo_app_stack_2026.md):

- Expo SDK 55 + New Architecture (mandatory)
- Expo Router (thin routes in `src/app/`)
- TanStack Query (server state)
- Zustand (capture + preferences)
- NativeWind v4 (StudyForge design tokens)
- MMKV (default directory persistence)
- React Hook Form + Zod (sign-in, review)
- `expo-document-scanner` + `expo-ocr-kit` (scan → OCR → review form sheet)

## Environment

Mobile reads Firebase config from the **workspace root** `.env` / `.env.local` (same as web). Values are injected via `app.config.ts` → `expo-constants`.

| Mode | `.env.local` |
|---|---|
| **Local emulators** | `NX_PUBLIC_USE_FIREBASE_EMULATOR=true` and `NX_PUBLIC_FIREBASE_API_KEY=demo-api-key-for-emulator` |
| **Production Firebase** | `NX_PUBLIC_USE_FIREBASE_EMULATOR=false` and real `NX_PUBLIC_FIREBASE_API_KEY` from Firebase Console |

Production callables enforce **App Check**. Dev builds use the debug provider (`__DEV__`).

**Dev App Check setup (required when `NX_PUBLIC_USE_FIREBASE_EMULATOR=false`):**

1. Firebase Console → **App Check** → register **StudyForge Capture** Android (`io.studyforge.capture`) with the **Debug** provider (Play Integrity for release later).
2. Overflow menu → **Manage debug tokens** → **Add debug token** → Generate (or paste one).
3. Put that UUID in workspace root `.env.local`:
   `NX_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=<uuid>`
4. Restart Metro with cache clear: `yarn nx run mobile-capture:start-clear`

Without a fixed env token, grab the device UUID from logcat and register it instead:

```bash
adb logcat | grep DebugAppCheckProvider
```

Release builds need Play Integrity (Android) / App Attest (iOS) for **StudyForge Capture** (`io.studyforge.capture`).

Native config files: [`google-services.json`](./google-services.json) and [`GoogleService-Info.plist`](./GoogleService-Info.plist). After changing native Firebase/App Check setup, rebuild the dev client (`mobile-capture:android` / `mobile-capture:ios`).

`demo-api-key-for-emulator` only works with emulators enabled — not for real `@gmail.com` sign-in against production.

Restart Metro after env changes: `yarn nx run mobile-capture:start-clear`

## Prerequisites

- Firebase emulators running (`yarn nx run functions:serve`) for local dev
- Root `.env` with `NX_PUBLIC_*` Firebase values and `NX_PUBLIC_USE_FIREBASE_EMULATOR=true`
- **Development build** (not Expo Go) — OCR and scanner require native modules

## Commands

All commands run from the **workspace root** via NX:

```bash
# Dev client + Metro (required for OCR / scanner / MMKV)
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:start
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:start-clear

# Install dev build on emulator/device (after native dep changes)
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:android
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:ios

# Expo Go mode — troubleshooting only; native modules will not work (see below)
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:start-go

# Typecheck / lint
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:typecheck
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:lint
```

## Flow

1. Sign in with Firebase email/password (same project as web)
2. Choose a default directory in Settings
3. Tap **Scan document** — native scanner → on-device OCR → review form sheet
4. **Save OCR text as document** (`createDocument`) or **Send image to StudyForge AI** (`generateFromScreenshot`)

## Native rebuild

Rebuild the dev client after adding or upgrading native modules (scanner, OCR, MMKV, Nitro):

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:android
# or: yarn nx run mobile-capture:ios
```

Native Expo modules must be declared in [`package.json`](./package.json) (not only the workspace root) so autolinking includes them in the Android/iOS project. Missing modules cause startup crashes such as `Cannot find native module 'ExpoLinking'`.

Then start Metro with a clean cache:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:start-clear
```

## Expo Go troubleshooting

This app is **not supported in Expo Go** — `expo-document-scanner`, `expo-ocr-kit`, and `react-native-mmkv` require a **development build**. Use `mobile-capture:start` + `mobile-capture:android` for real testing.

If you still need to debug Metro ↔ emulator connectivity in Go mode (e.g. SDK or bundler issues):

1. Start Metro in Go mode: `yarn nx run mobile-capture:start-go`
2. Confirm the terminal says **Using Expo Go** (press **`s`** to toggle if it says dev client)
3. With the Android emulator running, press **`a`** in the Metro terminal
4. If loading hangs, from a shell: `adb reverse tcp:8081 tcp:8081`, then press **`r`** to reload
5. Try tunnel if LAN IP fails: in Metro press **`shift+m`** → tunnel, or restart with `EXPO_USE_TUNNEL=1` in the start command
6. Clear cache: `yarn nx run mobile-capture:start-clear` (dev client) or add `--clear` to the start-go command in `project.json`

**Expected in Expo Go for this project:** sign-in and settings may work (storage falls back to AsyncStorage). **Scan / OCR will still fail** — those need a dev build (`mobile-capture:android`).

### NitroModules / MMKV error

`Failed to get NitroModules` means the runtime has no native Nitro bridge — typical in **Expo Go**. After the storage fallback, reload with **`r`** in Metro. For MMKV performance and scanner/OCR, install a dev build:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:android
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:start
```

## Troubleshooting

### `google-services.json is not defined`

Set top-level paths in `app.config.ts` (not plugin options):

- `android.googleServicesFile: './google-services.json'`
- `ios.googleServicesFile: './GoogleService-Info.plist'`

### Gradle / `IBM_SEMERU` build failure

Expo SDK 55 + RN 0.83 ship Gradle 9 with `foojay-resolver-convention` 0.5.0, which breaks the build. This repo auto-patches via:

1. `mobile-capture/scripts/patch-react-native-gradle-plugin.mjs` (runs on `yarn install` in `mobile-capture/`)
2. `plugins/withAndroidGradleCompat.js` (pins Gradle 8.14.3 during prebuild)

After pulling, run from repo root:

```bash
cd mobile-capture && yarn install
npx expo prebuild --platform android --clean
```

### `ANDROID_HOME` / SDK location not found

Install Android SDK (Android Studio or `brew install --cask android-commandlinetools`), then export:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"   # Android Studio default
# or: export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
```

Create `mobile-capture/android/local.properties`:

```properties
sdk.dir=/path/to/your/android/sdk
```

(`android/` is gitignored; this file is local-only.)

### Build without emulator (APK only)

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:build-apk --configuration=debug
```

`mobile-capture:android` (`expo run:android`) requires a device. If none is connected, the script auto-starts the **StudyForgeCapture** AVD (created via `avdmanager`). First boot can take a few minutes.

Start the emulator only:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:emulator
```

### Metro 500 / `VirtualViewNativeComponent` / `onModeChange`

Expo packages out of sync with SDK 55. From the repo root:

```bash
npx expo install expo-router expo-dev-client expo-camera react-native react-native-screens react-native-reanimated --fix
yarn install --ignore-engines
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:start-clear
```

If the dev client was built against the wrong React Native version, rebuild with `yarn nx run mobile-capture:android`.

## EAS

Development build profiles are in [`eas.json`](./eas.json). Run EAS commands from `mobile-capture/`.
