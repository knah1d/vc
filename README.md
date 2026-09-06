# 1:1 Video + Messaging App

## Structure
- `backend/` — Node/Express + Socket.IO + Prisma (Postgres). REST for auth/history, WS for live chat + call signaling, LiveKit for video/audio media.
- `frontend/` — React + Vite + TypeScript.

## Setup

### Backend
```
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, LIVEKIT_*
npm install
npm run prisma:migrate
npm run dev             # http://localhost:4000
```

### Frontend
```
cd frontend
cp .env.example .env    # VITE_API_URL points at the backend
npm install
npm run dev              # http://localhost:5173
```

### Video calling
Create a free project at https://cloud.livekit.io, put its API key/secret/URL
into `backend/.env`. Without these set, chat still works but call tokens will
fail with a clear error.

## What's implemented
- Signup/login (JWT), 1:1 conversation creation by email, persisted chat
  history, live messaging over WebSocket, presence, typing events (wired
  server-side, not yet shown in UI), call ring/accept/decline signaling, and
  video calls via LiveKit (`CallModal`).

## Not yet done (see plan)
- Typing indicator UI, unread counts, call history log, reconnect/backoff
  handling, rate limiting, production auth hardening (refresh tokens, etc.).
