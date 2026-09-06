import { io, type Socket } from 'socket.io-client';

import { API_URL } from './api';
import { storage } from './storage';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, { autoConnect: false });
  }
  return socket;
}

export async function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token: await storage.getToken() };
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
