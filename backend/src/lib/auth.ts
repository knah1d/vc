import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export interface AuthPayload {
  userId: string;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
