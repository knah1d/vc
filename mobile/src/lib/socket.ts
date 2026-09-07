import { io, type Socket } from 'socket.io-client';

import { API_URL } from './api';
import { storage } from './storage';

let socket: Socket | null = null;
let generation = 0;
let accountId: string | null = null;
export function socketBelongsTo(userId: string) { return accountId === userId; }

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, { autoConnect: false });
  }
  return socket;
}

export async function connectSocket(userId: string) {
  const attempt = generation;
  const s = getSocket();
  if (!s.connected) {
    const token = await storage.getToken();
    if (attempt !== generation || !token) return s;
    accountId = userId;
    s.auth = { token };
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  generation++;
  accountId = null;
  socket?.disconnect();
  socket = null;
}
