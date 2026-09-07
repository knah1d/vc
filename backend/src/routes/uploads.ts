import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../lib/auth.js";
import { createUploadUrl, storageConfigured } from "../lib/storage.js";

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth);

uploadsRouter.get("/status", (_req, res) => res.json({ configured: storageConfigured() }));

const presignSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
});

uploadsRouter.post("/presign", async (req: AuthedRequest, res) => {
  const parsed = presignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const { uploadUrl, publicUrl } = await createUploadUrl(req.userId!, parsed.data.filename, parsed.data.contentType);
    res.json({ uploadUrl, publicUrl });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Uploads are unavailable." });
  }
});
