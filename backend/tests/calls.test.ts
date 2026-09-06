import { test } from "node:test";
import assert from "node:assert/strict";
import { CallRegistry, livekitConfig } from "../src/lib/calls.js";

const input = { conversationId: "conversation-a", callerId: "alice", calleeId: "bob", callerSocketId: "alice-tab", mode: "voice" as const };

test("voice and video calls preserve mode and end both sides independently of the selected chat", () => {
  for (const mode of ["voice", "video"] as const) {
    const events: Array<{ user: string; event: string; payload: any }> = [];
    const calls = new CallRegistry((user, event, payload) => events.push({ user, event, payload }));
    const { callId } = calls.invite({ ...input, mode });
    assert.equal(events[0].user, "bob");
    assert.equal(events[0].payload.mode, mode);
    calls.accept(callId, "bob", "bob-tab");
    assert.equal(calls.get(callId, "alice")?.status, "active");
    assert.ok(events.some((event) => event.user === "alice" && event.event === "call:accepted"));
    calls.end(callId, "bob", "bob-tab");
    assert.equal(calls.get(callId, "alice"), undefined);
    assert.deepEqual(events.filter((event) => event.event === "call:ended").map((event) => event.user), ["alice", "bob"]);
  }
});

test("nonparticipants and the caller cannot accept an incoming call", () => {
  const calls = new CallRegistry(() => {});
  const { callId } = calls.invite(input);
  try {
    assert.equal(calls.get(callId, "mallory"), undefined);
    assert.throws(() => calls.accept(callId, "mallory", "other-tab"));
    assert.throws(() => calls.end(callId, "mallory", "other-tab"));
    assert.throws(() => calls.accept(callId, "alice", "alice-tab"));
    assert.throws(() => calls.end(callId, "alice", "alice-tab", true));
  } finally { calls.end(callId, "alice", "alice-tab"); }
});

test("only the accepting tab can end the callee's active call", () => {
  const calls = new CallRegistry(() => {});
  const { callId } = calls.invite(input);
  calls.accept(callId, "bob", "bob-tab");
  try {
    assert.throws(() => calls.accept(callId, "bob", "bob-other-tab"));
    assert.throws(() => calls.end(callId, "bob", "bob-other-tab"));
    calls.disconnect("bob-other-tab", "bob", true);
    assert.ok(calls.get(callId, "alice"));
  } finally { calls.end(callId, "bob", "bob-tab"); }
});

test("busy participants cannot join overlapping calls; a fresh attempt has a fresh room ID", () => {
  const calls = new CallRegistry(() => {});
  const first = calls.invite(input);
  try {
    assert.throws(() => calls.invite({ ...input, conversationId: "another-chat", callerId: "charlie" }), /already in a call/);
    assert.throws(() => calls.invite({ ...input, callerId: "bob", calleeId: "alice" }), /already in a call/);
  } finally { calls.end(first.callId, "bob", "bob-tab", true); }
  const second = calls.invite(input);
  assert.notEqual(first.callId, second.callId);
  calls.end(second.callId, "alice", "alice-tab");
});

test("disconnecting the caller or accepted callee ends the call", () => {
  for (const user of ["alice", "bob"]) {
    const calls = new CallRegistry(() => {});
    const { callId } = calls.invite(input);
    calls.accept(callId, "bob", "bob-tab");
    calls.disconnect(`${user}-tab`, user, true);
    assert.equal(calls.get(callId, "alice"), undefined);
  }
});

test("an unanswered call expires and releases both participants", async () => {
  const events: string[] = [];
  const calls = new CallRegistry((_user, event) => events.push(event), 10);
  const { callId } = calls.invite(input);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(calls.get(callId, "alice"), undefined);
  assert.equal(events.filter((event) => event === "call:ended").length, 2);
  assert.throws(() => calls.accept(callId, "bob", "bob-tab"));
});

test("LiveKit configuration rejects missing credentials and placeholder or invalid URLs", () => {
  const keys = ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_URL"];
  const previous = keys.map((key) => process.env[key]);
  try {
    process.env.LIVEKIT_API_KEY = "devkey";
    process.env.LIVEKIT_API_SECRET = "secret";
    for (const url of ["", "wss://your-project.livekit.cloud", "https://example.com", "invalid"]) {
      process.env.LIVEKIT_URL = url;
      assert.equal(livekitConfig(), null);
    }
    process.env.LIVEKIT_URL = "ws://localhost:7880";
    assert.ok(livekitConfig());
    process.env.LIVEKIT_API_SECRET = "";
    assert.equal(livekitConfig(), null);
  } finally { keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; }); }
});
