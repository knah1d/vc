import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";
import { videoRouter } from "../src/routes/video.js";
import { calls } from "../src/lib/calls.js";
import { signToken } from "../src/lib/auth.js";
import { prisma } from "../src/lib/prisma.js";

test("call token API handles configuration, authorization, room isolation, and ended calls", async (t) => {
  // Prisma delegates are proxies, so Node's descriptor-based method mock cannot wrap them.
  const originalLookup = prisma.user.findUnique;
  prisma.user.findUnique = (async () => ({ displayName: "Bob Example" })) as unknown as typeof originalLookup;
  t.after(() => { prisma.user.findUnique = originalLookup; });
  const keys = ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_URL"];
  const previous = keys.map((key) => process.env[key]);
  const app = express();
  app.use(express.json());
  app.use("/video", videoRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/video`;
  const invite = calls.invite({ conversationId: "conversation", callerId: "alice", calleeId: "bob", callerSocketId: "alice-tab", mode: "voice" });
  const headers = (userId: string) => ({ Authorization: `Bearer ${signToken({ userId })}`, "Content-Type": "application/json" });
  const tokenRequest = (userId: string, conversation = "conversation") => fetch(`${base}/token/${conversation}`, { method: "POST", headers: headers(userId), body: JSON.stringify({ callId: invite.callId }) });
  try {
    await t.test("missing configuration returns status false and an actionable 503", async () => {
      delete process.env.LIVEKIT_API_KEY;
      assert.equal((await fetch(`${base}/status`, { headers: headers("alice") }).then((r) => r.json())).configured, false);
      assert.equal((await tokenRequest("alice")).status, 503);
    });
    process.env.LIVEKIT_API_KEY = "devkey";
    process.env.LIVEKIT_API_SECRET = "secret";
    process.env.LIVEKIT_URL = "ws://localhost:7880";
    await t.test("only authenticated participants can get a token for the correct conversation", async () => {
      assert.equal((await fetch(`${base}/status`)).status, 401);
      assert.equal((await tokenRequest("mallory")).status, 404);
      assert.equal((await tokenRequest("alice", "another-conversation")).status, 404);
      const response = await tokenRequest("bob");
      assert.equal(response.status, 200);
      const data = await response.json();
      const claims = jwt.verify(data.token, "secret") as jwt.JwtPayload;
      assert.equal(claims.sub, "bob");
      assert.equal(claims.name, "Bob Example");
      assert.equal(claims.video.room, `call-${invite.callId}`);
      assert.equal(data.url, "ws://localhost:7880");
    });
    await t.test("ending the call invalidates further token requests", async () => {
      calls.end(invite.callId, "alice", "alice-tab");
      assert.equal((await tokenRequest("alice")).status, 404);
    });
  } finally {
    if (calls.get(invite.callId, "alice")) calls.end(invite.callId, "alice", "alice-tab");
    await new Promise<void>((resolve) => server.close(() => resolve()));
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});
