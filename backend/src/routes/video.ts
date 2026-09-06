import { Router } from "express";
import { AccessToken } from "livekit-server-sdk";
import { requireAuth, type AuthedRequest } from "../lib/auth.js";
import { calls, livekitConfig } from "../lib/calls.js";
import { prisma } from "../lib/prisma.js";

export const videoRouter = Router();
videoRouter.use(requireAuth);

videoRouter.get("/status", (_req, res) => res.json({ configured: Boolean(livekitConfig()) }));

videoRouter.post("/token/:conversationId", async (req: AuthedRequest, res) => {
  try {
    const config = livekitConfig();
    if (!config) return res.status(503).json({ error: "Calling is unavailable. The server needs a valid LiveKit URL, API key, and secret." });
    const call = typeof req.body?.callId === "string" ? calls.get(req.body.callId, req.userId!) : undefined;
    if (!call || call.conversationId !== req.params.conversationId) return res.status(404).json({ error: "This call has ended or you are not a participant." });

    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { displayName: true } });
    if (!user) return res.status(404).json({ error: "Your account could not be found." });
    const token = new AccessToken(config.key, config.secret, { identity: req.userId!, name: user.displayName, ttl: "10m" });
    token.addGrant({ room: `call-${call.id}`, roomJoin: true, canPublish: true, canSubscribe: true });
    res.json({ token: await token.toJwt(), url: config.url });
  } catch (error) {
    console.error("Could not issue call token", error instanceof Error ? error.message : "Unknown error");
    res.status(500).json({ error: "Could not connect your call. Please try again." });
  }
});
