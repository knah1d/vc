import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../lib/auth.js";

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth);

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// Start (or fetch existing) 1:1 conversation with another user by email.
const startSchema = z.object({ otherEmail: z.string().email() });

conversationsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const other = await prisma.user.findUnique({ where: { email: parsed.data.otherEmail } });
  if (!other) {
    return res.status(404).json({ error: "No user with that email" });
  }
  if (other.id === req.userId) {
    return res.status(400).json({ error: "Cannot start a conversation with yourself" });
  }

  const [userAId, userBId] = orderedPair(req.userId!, other.id);
  const conversation = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    update: {},
    create: { userAId, userBId },
  });
  req.app.get("io")?.to(`user:${other.id}`).emit("conversation:new", { conversationId: conversation.id });
  res.status(201).json({ conversation });
});

conversationsRouter.get("/", async (req: AuthedRequest, res) => {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: req.userId }, { userBId: req.userId }] },
    include: { userA: true, userB: true },
    orderBy: { createdAt: "desc" },
  });

  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      senderId: { not: req.userId },
      readAt: null,
    },
    _count: { _all: true },
  });
  const unreadByConversation = new Map(unreadCounts.map((u) => [u.conversationId, u._count._all]));

  res.json({
    conversations: conversations.map((c) => {
      const other = c.userAId === req.userId ? c.userB : c.userA;
      return {
        id: c.id,
        other: { id: other.id, displayName: other.displayName, avatarUrl: other.avatarUrl },
        createdAt: c.createdAt,
        unreadCount: unreadByConversation.get(c.id) ?? 0,
      };
    }),
  });
});

async function assertParticipant(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || (conversation.userAId !== userId && conversation.userBId !== userId)) {
    return null;
  }
  return conversation;
}

conversationsRouter.get("/:id/messages", async (req: AuthedRequest, res) => {
  const conversation = await assertParticipant(req.params.id, req.userId!);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const cursor = typeof req.query.before === "string" ? req.query.before : undefined;

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  res.json({ messages: messages.reverse() });
});

conversationsRouter.post("/:id/read", async (req: AuthedRequest, res) => {
  const conversation = await assertParticipant(req.params.id, req.userId!);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  await prisma.message.updateMany({
    where: { conversationId: conversation.id, senderId: { not: req.userId }, readAt: null },
    data: { readAt: new Date() },
  });

  res.json({ ok: true });
});
