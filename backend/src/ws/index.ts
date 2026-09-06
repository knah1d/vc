import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { calls, setCallEmitter, livekitConfig } from "../lib/calls.js";

// userId -> connected socket ids (a user could have multiple tabs open)
const onlineUsers = new Map<string, Set<string>>();

export function createWsServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN ?? "*" },
  });
  setCallEmitter((userId, event, payload) => {
    for (const socketId of onlineUsers.get(userId) ?? []) io.to(socketId).emit(event, payload);
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing auth token"));
    try {
      const { userId } = verifyToken(token);
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", (socket) => {
    const userId: string = socket.data.userId;

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId)!.add(socket.id);
    socket.broadcast.emit("presence:online", { userId });

    // --- Messaging ---
    socket.on("message:send", async ({ conversationId, body }, ack) => {
      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation || (conversation.userAId !== userId && conversation.userBId !== userId)) {
        return ack?.({ error: "Conversation not found" });
      }
      const message = await prisma.message.create({
        data: { conversationId, senderId: userId, body },
      });

      const otherId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
      for (const socketId of onlineUsers.get(otherId) ?? []) {
        io.to(socketId).emit("message:new", { message });
      }
      ack?.({ message });
    });

    socket.on("typing", async ({ conversationId, isTyping }) => {
      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation || (conversation.userAId !== userId && conversation.userBId !== userId)) return;
      const otherId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
      for (const socketId of onlineUsers.get(otherId) ?? []) {
        io.to(socketId).emit("typing", { conversationId, userId, isTyping });
      }
    });

    // Derive the recipient from verified conversation membership.
    socket.on("call:invite", async (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        const { conversationId, mode } = z.object({ conversationId: z.string().min(1), mode: z.enum(["voice", "video"]) }).parse(payload);
        if (!livekitConfig()) throw new Error("Calling is unavailable. The server needs LiveKit configuration.");
        const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation || ![conversation.userAId, conversation.userBId].includes(userId)) throw new Error("Conversation not found.");
        const calleeId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
        if (!socket.connected) return;
        if (!onlineUsers.get(calleeId)?.size) throw new Error("This person is offline. Try again when they're connected.");
        reply({ call: calls.invite({ conversationId, callerId: userId, calleeId, callerSocketId: socket.id, mode }) });
      } catch (error) {
        reply({ error: error instanceof z.ZodError ? "Invalid call request." : error instanceof Error ? error.message : "Could not start the call." });
      }
    });

    for (const action of ["accept", "decline", "hangup"] as const) {
      socket.on(`call:${action}`, (payload, ack) => {
        const reply = typeof ack === "function" ? ack : () => {};
        try {
          const { callId } = z.object({ callId: z.string().uuid() }).parse(payload);
          if (action === "accept") calls.accept(callId, userId, socket.id);
          else calls.end(callId, userId, socket.id, action === "decline");
          reply({ ok: true });
        } catch (error) {
          reply({ error: error instanceof z.ZodError ? "Invalid call request." : error instanceof Error ? error.message : "Could not update the call." });
        }
      });
    }

    socket.on("disconnect", () => {
      const sockets = onlineUsers.get(userId);
      sockets?.delete(socket.id);
      calls.disconnect(socket.id, userId, Boolean(sockets?.size));
      if (sockets && sockets.size === 0) {
        onlineUsers.delete(userId);
        socket.broadcast.emit("presence:offline", { userId });
      }
    });
  });

  return io;
}
