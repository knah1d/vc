import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { calls, setCallEmitter, livekitConfig } from "../lib/calls.js";
import { pushToUser } from "../lib/push.js";

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
    socket.join(`user:${userId}`);

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId)!.add(socket.id);
    socket.broadcast.emit("presence:online", { userId });

    // Explicit recovery also covers clients whose listeners mount after connect.
    socket.on("call:sync", (_payload, ack) => {
      if (typeof ack === "function") ack({ calls: calls.pending(userId) });
    });

    // --- Messaging ---
    socket.on("message:send", async (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        const { conversationId, body, clientId } = z
          .object({ conversationId: z.string().min(1), body: z.string().min(1), clientId: z.string().min(1).optional() })
          .parse(payload);

        const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conversation || (conversation.userAId !== userId && conversation.userBId !== userId)) {
          return reply({ error: "Conversation not found" });
        }

        // A resend (e.g. a mobile client retrying after a dropped ack) carries
        // the same clientId — recognize it instead of creating a duplicate.
        const existing = clientId ? await prisma.message.findUnique({ where: { clientId } }) : null;
        if (existing && (existing.senderId !== userId || existing.conversationId !== conversationId)) {
          return reply({ error: "Invalid message identifier." });
        }
        const message = existing ?? (await prisma.message.create({ data: { conversationId, senderId: userId, body, clientId } }));

        if (!existing) {
          const otherId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
          const otherSockets = onlineUsers.get(otherId) ?? new Set<string>();
          for (const socketId of otherSockets) {
            io.to(socketId).emit("message:new", { message });
          }
          if (otherSockets.size === 0) {
            const sender = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
            void pushToUser(otherId, {
              title: sender?.displayName ?? "New message",
              body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
              sound: "default",
              data: { type: "message:new", conversationId },
            });
          }
        }
        reply({ message });
      } catch (error) {
        reply({ error: error instanceof z.ZodError ? "Invalid message." : "Could not send the message." });
      }
    });

    // Reacting again with the same emoji removes it; a different emoji replaces it.
    socket.on("message:react", async (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        const { messageId, emoji } = z.object({ messageId: z.string().min(1), emoji: z.string().min(1).max(8) }).parse(payload);
        const message = await prisma.message.findUnique({ where: { id: messageId }, include: { conversation: true } });
        if (!message) return reply({ error: "Message not found" });
        const conversation = message.conversation;
        if (conversation.userAId !== userId && conversation.userBId !== userId) return reply({ error: "Message not found" });

        const existing = await prisma.messageReaction.findUnique({ where: { messageId_userId: { messageId, userId } } });
        if (existing && existing.emoji === emoji) {
          await prisma.messageReaction.delete({ where: { id: existing.id } });
        } else {
          await prisma.messageReaction.upsert({
            where: { messageId_userId: { messageId, userId } },
            update: { emoji },
            create: { messageId, userId, emoji },
          });
        }

        const reactions = await prisma.messageReaction.findMany({ where: { messageId }, select: { userId: true, emoji: true } });
        const otherId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
        const out = { messageId, conversationId: conversation.id, reactions };
        for (const participantId of [userId, otherId]) {
          for (const socketId of onlineUsers.get(participantId) ?? []) io.to(socketId).emit("message:reaction", out);
        }
        reply({ ok: true });
      } catch (error) {
        reply({ error: error instanceof z.ZodError ? "Invalid reaction." : "Could not react to the message." });
      }
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

        const calleeOnline = Boolean(onlineUsers.get(calleeId)?.size);
        if (!calleeOnline) {
          const hasDevice = (await prisma.deviceToken.count({ where: { userId: calleeId } })) > 0;
          if (!hasDevice) throw new Error("This person is offline. Try again when they're connected.");
        }

        const call = calls.invite({ conversationId, callerId: userId, calleeId, callerSocketId: socket.id, mode });
        reply({ call });

        // The socket-based call:incoming above only reaches an open app. A
        // backgrounded or killed one needs a push to know to ring at all.
        if (!calleeOnline) {
          const caller = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
          void pushToUser(calleeId, {
            title: `Incoming ${mode} call`,
            body: caller ? `${caller.displayName} is calling…` : "Someone is calling…",
            sound: "default",
            priority: "high",
            data: { type: "call:incoming", ...call },
          });
        }
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
