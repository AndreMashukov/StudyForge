---
name: mobile-e2e-expo-go
description: Run an end-to-end test of the mobile-capture app in Expo Go on the Android emulator against the local Firebase emulators, driving the UI with the android-emulator MCP tools. Use when asked to e2e-test, click through or verify a mobile change on a device without building a dev client. Covers the temporary App Check patch, env switch, Metro on 8082, sign-in through adb, debugging stale bundles, and cleanup. Points to the dev-client path for what Expo Go cannot run (background/lock-screen audio, native modules).
---

# Mobile e2e in Expo Go (Android emulator + Firebase emulators)

Expo Go runs the app's JavaScript without a native build, so a JS-only change can be checked on a device in minutes. The app is **not officially supported in Expo Go** (see `mobile-capture/README.md` → *Expo Go troubleshooting*); this recipe makes it run well enough for e2e of JS flows.

## What Expo Go can and cannot verify

| Works in Expo Go | Needs a dev client (see last section) |
|---|---|
| Sign-in, library, reader, Home/assistant UI | Background audio, lock-screen controls, foreground services |
| Callables and Firestore listeners against the emulators | React Native Firebase (native App Check) |
| Layout, keyboard handling, navigation | Scanner, OCR, MMKV (falls back to AsyncStorage) |
| Expo SDK modules bundled in Expo Go (e.g. `expo-audio` foreground playback, `expo-file-system`) | Anything behind a config plugin (`app.config.ts` plugins are not applied) |

Expo Go must match the app's Expo SDK (55). Check what Expo Go serves first if the SDK was just bumped: `curl -s https://api.expo.dev/v2/versions/latest`.

## Ground rules

- Every change below is **temporary**. Back up first, restore byte-for-byte at the end, and say so in the report.
- Never read production secrets or data to make the emulators work without the user's explicit OK. If a flow needs a production secret (see *Known blockers*), stop and ask.
- Leave other projects' Metro (often on 8081) alone. Use **port 8082**.
- Use the scratchpad for backups and logs; `$S` below is the session scratchpad.

## 1. Point the app at the emulators (temporary)

The app reads the workspace-root env files in this order, last wins: `.env`, `.env.mobile`, `.env.dev`, **`.env.local`** (`mobile-capture/app.config.ts`). Edit only `.env.local`:

```bash
cd <repo-root>
cp -p .env.local "$S/env.local.backup" && chmod 600 "$S/env.local.backup"
sed -i '' 's/^NX_PUBLIC_USE_FIREBASE_EMULATOR=.*/NX_PUBLIC_USE_FIREBASE_EMULATOR=true/' .env.local
# The seed and the Functions emulator use the appspot.com bucket; the app's
# default (firebasestorage.app) makes document files "not found".
sed -i '' 's#^NX_PUBLIC_FIREBASE_STORAGE_BUCKET=.*#NX_PUBLIC_FIREBASE_STORAGE_BUCKET=study-forge-202604.appspot.com#' .env.local
diff "$S/env.local.backup" .env.local   # only those two lines may differ
```

With emulator mode on, the app connects to `10.0.2.2` (Android host alias) on 9099/8080/5001/9199 (`src/lib/firebase/config.ts`, `index.ts`).

## 2. Temporary Expo Go patch for App Check

`mobile-capture/src/lib/firebase/appCheck.ts` imports `@react-native-firebase/*` at the top of the file. Expo Go has no `RNFBAppModule`, so the bundle crashes on start. Make the imports lazy (types stay static imports), so they are only required outside emulator mode:

```ts
import type {
  initializeAppCheck as initializeNativeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from '@react-native-firebase/app-check';

// TEMPORARY (Expo Go e2e, revert with git checkout)
const rnfbApp = () => require('@react-native-firebase/app');
const rnfbAppCheck = () => require('@react-native-firebase/app-check');
```

Then replace each use: `new (rnfbAppCheck().ReactNativeFirebaseAppCheckProvider)()`, `rnfbAppCheck().initializeAppCheck(rnfbApp().getApp(), …)`, `rnfbAppCheck().getToken(…)`. Do not commit this; revert with `git checkout -- mobile-capture/src/lib/firebase/appCheck.ts`.

## 3. Start the Android emulator

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk; ADB=$ANDROID_HOME/platform-tools/adb
$ANDROID_HOME/emulator/emulator -list-avds            # Pixel_7_API_35 was used
nohup $ANDROID_HOME/emulator/emulator -avd Pixel_7_API_35 -no-snapshot-save -no-audio -no-boot-anim > "$S/avd.log" 2>&1 &
for i in $(seq 1 90); do [ "$($ADB -s emulator-5554 shell getprop sys.boot_completed | tr -d '\r')" = 1 ] && break; sleep 2; done
```

Check the device reaches the host emulators. If ports show closed or there is no IP, toggle Wi-Fi (a cold boot sometimes comes up without a network):

```bash
for p in 9099 8080 5001 9199; do $ADB -s emulator-5554 shell "nc -z -w3 10.0.2.2 $p && echo $p open || echo $p closed"; done
$ADB -s emulator-5554 shell svc wifi disable; sleep 3; $ADB -s emulator-5554 shell svc wifi enable
```

Use `-no-audio` unless the test is about sound; playback state can be read from the system instead (see *Verifying*).

## 4. Firebase emulators and seed data

The `--project` must match `NX_PUBLIC_FIREBASE_PROJECT_ID` (see the `firebase-emulators` skill). Build functions first so new code is loaded:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run functions:build
NX_PUBLIC_FIREBASE_PROJECT_ID=study-forge-202604 yarn -s firebase emulators:start --project study-forge-202604   # run in background
npx tsx scripts/seed-setup/setup-seed-data.ts    # creates the test user and data; re-run after every emulator restart
```

The emulators can die between steps (data is lost). If sign-in suddenly fails with a network error, check the ports with `lsof -nP -iTCP:9099 -sTCP:LISTEN` before debugging the app.

## 5. Metro in Expo Go mode, then open the app

From `mobile-capture/`, in the background:

```bash
lsof -nP -iTCP:8082 -sTCP:LISTEN                      # must be free
CI=1 EXPO_NO_TELEMETRY=1 npx expo start --go --clear --port 8082 2>&1 | grep -vE '^\[dotenv'
```

Open the app with an intent, not with `--android` or the `a` key. Those open Expo's loading page in Chrome, which covers Expo Go. The first cold start often bounces back to the launcher, so launch twice:

```bash
$ADB -s emulator-5554 shell am force-stop host.exp.exponent
$ADB -s emulator-5554 shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8082" host.exp.exponent
sleep 4
$ADB -s emulator-5554 shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8082" host.exp.exponent
```

Wait for Metro's `Android Bundled … ms` line before looking at the screen. If Expo Go is not installed, `npx expo start --go --android` once installs it; then go back to the intent.

## 6. Drive the UI

Use the `android-emulator` MCP tools: `screenshot` to look, `get_all_text` / `get_clickable_elements` to find targets, `tap_element` / `tap`, `wait_for_element`, `swipe`/`scroll`, `press_key`.

- **Typing:** the MCP `type_text` URL-encodes `@`, which breaks email addresses. Type through adb instead, escaping shell characters:
  ```bash
  $ADB -s emulator-5554 shell input tap <x> <y>          # focus the field
  $ADB -s emulator-5554 shell input keyevent KEYCODE_MOVE_END
  for i in $(seq 1 45); do $ADB -s emulator-5554 shell input keyevent KEYCODE_DEL; done
  $ADB -s emulator-5554 shell input text "test@example.com"
  $ADB -s emulator-5554 shell input text 'Password\!'    # escape !
  $ADB -s emulator-5554 shell input keyevent KEYCODE_BACK  # close the keyboard
  ```
- **Credentials:** sign in with the seeded user (`TEST_EMAIL` / password in `scripts/seed-setup/setup-seed-data.ts`).
- **Back at the app root** minimises the app. Navigate with the app's own controls instead.
- The emulator shows a floating IME, so "composer above a full-height keyboard" cannot be judged here. Say so rather than claiming it.

## 7. Verifying beyond the screen

```bash
# App JS logs (errors, warnings, console)
$ADB -s emulator-5554 logcat -d -v time | grep ReactNativeJS | tail -20
# Which config Metro serves (check emulator flag / bucket without printing secrets)
curl -s -H "expo-platform: android" -H "Accept: application/expo+json,application/json" http://127.0.0.1:8082/
# Does the served bundle contain your edit? (stale-bundle check)
curl -s "http://127.0.0.1:8082/node_modules/expo-router/entry.bundle?platform=android&dev=true&minify=false" -o "$S/bundle.js"; grep -c '<marker from your edit>' "$S/bundle.js"
# Audio playing? Rate? (works with -no-audio)
$ADB -s emulator-5554 shell "dumpsys media_session | grep -E 'state=PlaybackState|active=true' | head -3"
```

Also read the Functions emulator output for the callables the flow hit, and the Firestore emulator UI (port 4000) for the written data.

**Stale code:** Fast Refresh and plain reloads often keep serving old modules after edits from the shell. When behaviour doesn't match the code, restart Metro with `--clear` and relaunch through the intent, then confirm with the bundle grep above.

## 8. Clean up (always, and report it)

```bash
cd <repo-root>
cp -p "$S/env.local.backup" .env.local && cmp "$S/env.local.backup" .env.local && echo restored
git checkout -- mobile-capture/src/lib/firebase/appCheck.ts
rm -f "$S/env.local.backup" "$S/bundle.js"
git status --short          # nothing from this recipe may remain
```

Stop the Metro you started. Report what is still running (Firebase emulators, Android emulator) and whether you restarted or re-seeded the emulators, since that wipes their data.

## Known blockers

- **LLM calls that need a provider key stored in the emulator.** The seed encrypts connections with the key in `functions/.env`. Without `functions/.secret.local`, the Functions emulator reads `LLM_SETTINGS_ENCRYPTION_KEY` from production Secret Manager. Decryption then fails ("Unsupported state or unable to authenticate data"). Fix locally by creating `functions/.secret.local` with the same key as `functions/.env` and re-seeding (OpenRouter needs `OPENROUTER_API_KEY` in the environment). Copying a production connection needs the user's approval.
- **Host under heavy load** (Gradle, several emulators) can make ExoPlayer's decoder fail or trigger ANR dialogs. Check `uptime` and the top processes before blaming the app.

## When Expo Go is not enough: dev client

For native behaviour (background or lock-screen audio, config plugins, RN Firebase App Check), build and install the dev client. Do not apply the patch or the env switch for production runs:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false yarn nx run mobile-capture:android   # Gradle build + install
cd mobile-capture && CI=1 EXPO_NO_TELEMETRY=1 npx expo start --dev-client --clear --port 8082
```

Reload the dev client with the double-R key: `adb shell input keyevent 46` twice. Against production, the user signs in themselves; ask them to and wait. Check background playback with `dumpsys media_session` and `dumpsys activity services io.studyforge.capture` (foreground service) while the app is in the background or the screen is off (`input keyevent KEYCODE_POWER`).
