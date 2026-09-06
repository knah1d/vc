import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../lib/auth.js";

export const devicesRouter = Router();
devicesRouter.use(requireAuth);

const registerSchema = z.object({ token: z.string().min(1), platform: z.enum(["ios", "android"]) });

// Registers (or re-owns) a device's push token, called once the mobile app
// has permission and an Expo push token. Re-registering an existing token
// under a different user (e.g. someone logged out and a different account
// logged in on the same device) transfers ownership rather than erroring.
devicesRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { token, platform } = parsed.data;
  await prisma.deviceToken.upsert({
    where: { token },
    update: { userId: req.userId!, platform },
    create: { token, platform, userId: req.userId! },
  });
  res.status(201).json({ ok: true });
});

// Called on logout so a shared/borrowed device stops receiving this user's push.
devicesRouter.delete("/:token", async (req: AuthedRequest, res) => {
  await prisma.deviceToken.deleteMany({ where: { token: req.params.token, userId: req.userId! } });
  res.json({ ok: true });
});
