import { io, type Socket } from "socket.io-client";
import { getToken } from "./api";

const API_URL = import.meta.env.VITE_API_URL as string;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      auth: { token: getToken() },
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token: getToken() };
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
