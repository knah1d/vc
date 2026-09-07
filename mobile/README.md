# Hush mobile

Expo SDK 57 / React Native messaging, voice, and video app. Shared native styles
provide lavender accents, translucent cards, light/dark palettes, and avatars.

## Run locally

Use Node 22.13+ (Node 24 recommended for SQLite regression tests).

```bash
cd mobile
npm install
```

Create `.env` from `.env.example`. On a physical phone, set
`EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:4000` and use the same network.
Leaving it blank in local development uses the Expo Metro host on port 4000.
Android emulators can use `http://10.0.2.2:4000`.
Production builds require an explicit public HTTPS backend URL.

Start the backend using the repository's root README. The backend's LiveKit URL
must also be reachable **from the phone**: localhost refers to the phone, not your
computer. A public wss:// LiveKit endpoint is simplest. Self-hosted servers need
reachable media ports and appropriate firewall/TURN configuration.

Build and install a native development client (Android SDK required):

```bash
npx expo run:android
```

On macOS with Xcode, use `npx expo run:ios`. Alternatively, build/install an EAS
development client using the existing development profile. Then run:

```bash
npx expo start --dev-client
```

Rebuild the native client after native plugin changes, including the LiveKit
plugin added in this update. Expo Go cannot run the native calling SDK.
See [LiveKit's Expo setup](https://docs.livekit.io/transport/sdk-platforms/expo/).
Use the separate `frontend/` app for the supported browser experience.

## Messaging and calls

- Each account has a separate SQLite cache/outbox. Late old-session writes stay
  in that account's database.
- The old shared `hush.db` is untouched but no longer read. Server history downloads
  again. Legacy unsent messages are not automatically imported because ownership
  cannot safely be assumed.
- Client IDs reconcile sent messages and retries with server history.
- Reconnect/foreground refresh fills missed history pages and retries pending sends.
- Push requires EAS configuration, platform push credentials, and permission.
  Permission denial does not block foreground calls.
- Opening the app or tapping a call notification queries the server for a
  still-ringing invite. Ended/expired calls are not revived.
- Calls ring for 30 seconds. Controls are **in-app**. CallKeep was removed;
  OS lock-screen answering and guaranteed killed-app ringing are not implemented.
  Those require separate native calling/background delivery integration.

## Checks

```bash
npm run typecheck
npm test
npx expo export --platform android
```

Local-data tests execute production database/outbox code with in-memory SQLite.
Backend call-state tests live in `backend/tests`.
This update introduces no Prisma schema changes or migrations.

Before release, test on two devices: account switching, offline sends, more than
100 missed messages, notification taps before/after call expiry, voice microphone
access, video on both sides, mute/camera toggles, decline/cancel/hangup. Check small
screens, large text, keyboards, and both color schemes.
