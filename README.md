# Hush — messaging, voice, and video

A React + TypeScript app with a responsive Tailwind CSS glass interface.
Express handles authentication and history, Socket.IO handles live messages and
call signaling, PostgreSQL stores conversations, and LiveKit carries audio/video.

## Run locally

Use Node.js 22.12+ (Node 24 works), npm, and a running PostgreSQL development database.

### Backend

```bash
cd backend
npm ci
# On first setup only, if .env does not exist:
cp -n .env.example .env
# Edit DATABASE_URL and JWT_SECRET in .env.
npm run prisma:migrate
npm run dev
```

Backend: http://localhost:4000. `/health` checks the HTTP server, not the database.
Prisma migration is needed for initial setup or schema/migration changes,
not every restart.

### Frontend — another terminal

```bash
cd frontend
npm ci
cp -n .env.example .env
npm run dev -- --port 5173 --strictPort
```

Open http://localhost:5173. Set `VITE_API_URL=http://localhost:4000` in
`frontend/.env` and `CORS_ORIGIN=http://localhost:5173` in `backend/.env`.
Restart the relevant development server after changing its environment file.

## Voice and video calls

Both call types require LiveKit. The phone button starts a microphone-only call;
the camera button starts a video call. Voice calls do not request camera access.
Call errors are displayed in the app.

### Local development on Linux

The included Docker Compose service runs LiveKit on your machine using
[LiveKit's development credentials](https://docs.livekit.io/transport/self-hosting/local/).
From the project root:

```bash
docker compose up -d livekit
```

Set these values in `backend/.env`, then restart the backend:

```dotenv
LIVEKIT_API_KEY="devkey"
LIVEKIT_API_SECRET="secret"
LIVEKIT_URL="ws://localhost:7880"
```

The Compose file uses Linux host networking and binds signaling to loopback.
These public development credentials are for local testing only.
Stop the local service with `docker compose stop livekit`.

### LiveKit Cloud / calls from other devices

Create a project at https://cloud.livekit.io and set its URL, API key, and secret
in `backend/.env`. Use all three values from the same project. Restart the backend.
Cloud credentials stay on the backend.

Browser camera/microphone access requires localhost or HTTPS. A phone opening
plain HTTP at your computer's LAN IP will not have the same permissions as localhost.
For calls across devices, use HTTPS for the frontend and a reachable secure backend
and LiveKit endpoint; update `VITE_API_URL` and `CORS_ORIGIN` accordingly.
The included local loopback setup is intended for two browser profiles on one machine.

### Try a call

1. Create two accounts in separate browser profiles (or a normal and incognito window).
2. Start a conversation using the other account's email.
3. Keep both users connected, select the conversation, and choose voice or video.
4. Allow the requested device access and accept on the other account.
5. Use microphone/camera controls or End call. Ringing calls time out after 30 seconds.

An offline contact, busy participant, missing configuration, blocked device permission,
or connection failure produces a visible message. Call sessions are tracked separately
from the selected chat, so hanging up targets the correct call.

## Frontend styling

Tailwind CSS v4 is integrated through `@tailwindcss/vite`.

- `frontend/src/index.css`: theme tokens, base styles, decorative keyframes, and scoped LiveKit overrides.
- `frontend/src/components/ui.tsx`: shared glass panels, buttons, inputs, notices, and branding.
- Page/component layouts use Tailwind utilities, including responsive and focus states.
- The call interface and LiveKit dependencies load when needed.
- Fonts use Google Fonts with local system-font fallbacks.

## Verification

```bash
cd backend
npm test
npm run build
```

```bash
cd frontend
npm run lint
npm run build
```

The backend regression suite covers call modes, authorization, multi-tab ownership,
busy participants, hangup/disconnect, ringing timeout, and media token authorization.

## Current scope

Implemented: signup/login, conversations by email, persisted messages, typing indicators,
unread badges, reconnect history refresh, new-conversation notifications, voice/video calls,
ring/accept/decline/cancel/end states, and responsive chat navigation.

Call state and presence live in one backend process; multi-instance deployment needs
shared signaling state and a Socket.IO adapter. Persistent call history, stronger
production session management, and rate limits remain future work.
