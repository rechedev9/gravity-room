# Mobile native builds

The Android project is generated, not tracked. `apps/frontend/mobile/android`
and `ios` are git-excluded; `app.json` plus the files under
`apps/frontend/mobile/assets` (icon, adaptive icon, splash mark) are the source
of truth. Regenerate the native project whenever `app.json`, a plugin or an Expo
dependency changes. Never edit files under `android/` by hand: the next
`--clean` prebuild discards them.

`expo prebuild` also rewrites the `android` and `ios` scripts in
`apps/frontend/mobile/package.json` to `expo run:android` and `expo run:ios`.
Those values are committed, so a prebuild leaves the tree clean.

## Prerequisites

- JDK 17 on `JAVA_HOME`.
- Android SDK with platforms 35 and 36, build-tools, and NDK 27.x. Set
  `ANDROID_HOME` (Windows default: `%LOCALAPPDATA%\Android\Sdk`).
- `pnpm install` at the repo root. A fresh install must pass React Native
  codegen: `pnpm-workspace.yaml` pins `brace-expansion` per `minimatch` major
  because `brace-expansion` 5 no longer exports a function and breaks
  `minimatch` 3, 5 and 9.

## Generate the native project

From `apps/frontend/mobile` (Git Bash):

```sh
export ANDROID_HOME='C:\Users\<you>\AppData\Local\Android\Sdk'
npx expo prebuild --platform android --clean
```

The manifest follows `app.json` (`usesCleartextTraffic` false, adaptive icon,
dark `#111110` splash). `gradle.properties` is generated with
`reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`, so the default build
already includes `arm64-v8a` for real phones. Do not edit that line to narrow it;
pass `-PreactNativeArchitectures` per build instead.

## Debug build for the emulator

```sh
cd android
./gradlew --no-daemon assembleDebug -PreactNativeArchitectures=x86_64
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. Use
`arm64-v8a` instead of `x86_64` for a debug build on a phone or an arm64
emulator. A multi-ABI build is slow; list only what you need.

The debug app loads its bundle from Metro. Run Metro in watch mode (do not set
`CI=1`: it disables reloads and the device keeps serving a stale bundle):

```sh
cd apps/frontend/mobile
npx expo start --port 8099 --host localhost
adb reverse tcp:8099 tcp:8099
adb reverse tcp:3001 tcp:3001
```

If another project's Metro owns port 8081, point the app at 8099 by writing the
`debug_http_host` preference (`localhost:8099`) into
`shared_prefs/com.gravityroom.mobile_preferences.xml` with
`adb shell run-as com.gravityroom.mobile`. Use `MSYS_NO_PATHCONV=1` for adb
paths in Git Bash.

## Release APK for real phones

`EXPO_PUBLIC_API_URL` is inlined at bundle time and must be an `https` URL in a
release build. `EXPO_NO_METRO_WORKSPACE_ROOT=1` is required in this monorepo:
without it `expo export:embed` resolves the entry file relative to the workspace
root and fails with `Unable to resolve module ./index.js`.

```sh
cd apps/frontend/mobile
npx expo prebuild --platform android --clean
cd android
EXPO_NO_METRO_WORKSPACE_ROOT=1 EXPO_PUBLIC_API_URL=https://gravityroom.app \
  ./gradlew --no-daemon assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Output: `android/app/build/outputs/apk/release/app-release.apk`. For older 32 bit
phones use `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a`. Check the ABIs
with `unzip -l app-release.apk | grep "lib/"`.

The release build is signed with the generated debug keystore, which is fine
for sideloading and not for a store upload. A store build needs its own keystore
and a signing config in a config plugin.

There is no OTA channel (`expo.modules.updates` is disabled), so every change
ships as a new APK; bump `expo.version` and `android.versionCode` in `app.json`.

## Icon and splash artwork

`assets/icon.png`, `adaptive-icon-foreground.png`, `adaptive-icon-monochrome.png`
and `splash-mark.png` are 1024 px renders of the web brand mark
(`apps/frontend/web/public/logo-maskable.webp`) on `#111110`. The adaptive icon
keeps the mark inside the 66 percent safe zone. Replace the PNGs and re-run
prebuild to change them.
