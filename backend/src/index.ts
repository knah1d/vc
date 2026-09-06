import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { authRouter } from "./routes/auth.js";
import { conversationsRouter } from "./routes/conversations.js";
import { videoRouter } from "./routes/video.js";
import { createWsServer } from "./ws/index.js";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
app.use("/conversations", conversationsRouter);
app.use("/video", videoRouter);

const httpServer = createServer(app);
app.set("io", createWsServer(httpServer));

const port = Number(process.env.PORT) || 4000;
httpServer.listen(port, () => {
  console.log(`Backend listening on :${port}`);
});
