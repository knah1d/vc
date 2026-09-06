import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

// userId -> connected socket ids (a user could have multiple tabs open)
const onlineUsers = new Map<string, Set<string>>();

export function createWsServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN ?? "*" },
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

    socket.on("typing", ({ conversationId, isTyping }) => {
      socket.broadcast.emit("typing", { conversationId, userId, isTyping });
    });

    // --- Call signaling (ring/accept/decline; media itself goes over LiveKit) ---
    socket.on("call:invite", ({ conversationId, calleeId }) => {
      for (const socketId of onlineUsers.get(calleeId) ?? []) {
        io.to(socketId).emit("call:incoming", { conversationId, callerId: userId });
      }
    });

    socket.on("call:accept", ({ conversationId, callerId }) => {
      for (const socketId of onlineUsers.get(callerId) ?? []) {
        io.to(socketId).emit("call:accepted", { conversationId });
      }
    });

    socket.on("call:decline", ({ conversationId, callerId }) => {
      for (const socketId of onlineUsers.get(callerId) ?? []) {
        io.to(socketId).emit("call:declined", { conversationId });
      }
    });

    socket.on("call:hangup", ({ conversationId, otherUserId }) => {
      for (const socketId of onlineUsers.get(otherUserId) ?? []) {
        io.to(socketId).emit("call:ended", { conversationId });
      }
    });

    socket.on("disconnect", () => {
      const sockets = onlineUsers.get(userId);
      sockets?.delete(socket.id);
      if (sockets && sockets.size === 0) {
        onlineUsers.delete(userId);
        socket.broadcast.emit("presence:offline", { userId });
      }
    });
  });

  return io;
}
