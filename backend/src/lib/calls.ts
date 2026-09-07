import { randomUUID } from "node:crypto";

export type CallMode = "voice" | "video";
export interface CallSession {
  id: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  callerSocketId: string;
  calleeSocketId?: string;
  mode: CallMode;
  status: "ringing" | "active";
}

/** One process owns signaling; each attempt gets a separate media room. */
export class CallRegistry {
  private sessions = new Map<string, CallSession>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private emit: (userId: string, event: string, payload: unknown) => void, private ringTimeout = 30_000) {}

  get(id: string, userId: string) {
    const call = this.sessions.get(id);
    return call && [call.callerId, call.calleeId].includes(userId) ? call : undefined;
  }

  pending(userId: string) {
    return [...this.sessions.values()]
      .filter((call) => call.calleeId === userId && call.status === "ringing")
      .map((call) => this.payload(call));
  }

  invite(input: Omit<CallSession, "id" | "status" | "calleeSocketId">) {
    for (const call of this.sessions.values()) {
      if ([call.callerId, call.calleeId].some((id) => id === input.callerId || id === input.calleeId)) {
        throw new Error("One of you is already in a call.");
      }
    }
    const call: CallSession = { ...input, id: randomUUID(), status: "ringing" };
    this.sessions.set(call.id, call);
    this.timers.set(call.id, setTimeout(() => this.finish(call, "No answer. Try again later."), this.ringTimeout));
    this.emit(call.calleeId, "call:incoming", this.payload(call));
    return this.payload(call);
  }

  accept(id: string, userId: string, socketId: string) {
    const call = this.get(id, userId);
    if (!call || call.calleeId !== userId || call.status !== "ringing") throw new Error("This call is no longer ringing.");
    call.status = "active";
    call.calleeSocketId = socketId;
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.emit(call.callerId, "call:accepted", this.payload(call));
    this.emit(call.calleeId, "call:answered", { ...this.payload(call), socketId });
  }

  end(id: string, userId: string, socketId: string, decline = false) {
    const call = this.get(id, userId);
    if (!call) throw new Error("This call has already ended.");
    const ownerSocket = userId === call.callerId ? call.callerSocketId : call.calleeSocketId;
    if (ownerSocket && ownerSocket !== socketId) throw new Error("This call is open in another tab.");
    if (decline && (call.calleeId !== userId || call.status !== "ringing")) throw new Error("This call cannot be declined.");
    this.finish(call, decline ? "Call declined." : call.status === "ringing" ? "Call cancelled." : "Call ended.");
  }

  disconnect(socketId: string, userId: string, stillOnline: boolean) {
    for (const call of this.sessions.values()) {
      if (call.callerSocketId === socketId || call.calleeSocketId === socketId || (!stillOnline && call.calleeId === userId)) {
        this.finish(call, "The other person disconnected.");
      }
    }
  }

  private payload(call: CallSession) {
    return { callId: call.id, conversationId: call.conversationId, callerId: call.callerId, calleeId: call.calleeId, mode: call.mode };
  }

  private finish(call: CallSession, reason: string) {
    clearTimeout(this.timers.get(call.id));
    this.timers.delete(call.id);
    this.sessions.delete(call.id);
    for (const id of [call.callerId, call.calleeId]) this.emit(id, "call:ended", { callId: call.id, reason });
  }
}

let sendEvent: (userId: string, event: string, payload: unknown) => void = () => {};
export const calls = new CallRegistry((...args) => sendEvent(...args));
export function setCallEmitter(emit: typeof sendEvent) { sendEvent = emit; }

export function livekitConfig() {
  const key = process.env.LIVEKIT_API_KEY?.trim();
  const secret = process.env.LIVEKIT_API_SECRET?.trim();
  const url = process.env.LIVEKIT_URL?.trim();
  if (!key || !secret || !url || url.includes("your-project")) return null;
  try {
    if (!["ws:", "wss:"].includes(new URL(url).protocol)) return null;
  } catch { return null; }
  return { key, secret, url };
}
