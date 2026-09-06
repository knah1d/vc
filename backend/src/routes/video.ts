import { Router } from "express";
import { AccessToken } from "livekit-server-sdk";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../lib/auth.js";

export const videoRouter = Router();
videoRouter.use(requireAuth);

// Issue a LiveKit room token for a given conversation. Room name = conversationId,
// so both participants join the same 1:1 room. Called after the callee accepts.
videoRouter.post("/token/:conversationId", async (req: AuthedRequest, res) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.conversationId },
  });
  if (!conversation || (conversation.userAId !== req.userId && conversation.userBId !== req.userId)) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: "Video calling is not configured" });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: req.userId!,
    ttl: "10m",
  });
  at.addGrant({
    room: conversation.id,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  res.json({ token: await at.toJwt(), url: process.env.LIVEKIT_URL });
});
