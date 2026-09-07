# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## User's phone-preview workflow

- Do not run tests or builds unless the user requests them; implement and let the user review on their phone.
- After JS/style-only changes, use the existing Metro connection. Fast Refresh normally applies saved edits; the user can shake the phone and choose Reload. Do not rebuild or restart a healthy Metro server.
- If the app cannot reach Metro, check `adb devices`. If unauthorized, ask the user to accept the phone's USB debugging prompt. Start `npx expo start --dev-client` from `mobile` only if Metro is not running. Restore `adb reverse tcp:8081 tcp:8081` after USB reconnects or adb restarts, then reopen/reload the app. Select the explicit device if more than one is connected.
- Native dependency or app.json changes require a new development APK (`eas build --profile development --platform android`). Tell the user clearly when a rebuild is required; after installation, ensure Metro and USB forwarding are available again.
