import { io, type Socket } from "socket.io-client";
import { API_URL, getToken } from "./api";

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

// React's external-store subscription also checks changes between render and
// effect attachment, which is essential when login connects the socket quickly.
export function isSocketConnected() { return getSocket().connected; }
export function subscribeConnection(listener: () => void) {
  const current = getSocket();
  current.on("connect", listener);
  current.on("disconnect", listener);
  current.on("connect_error", listener);
  return () => {
    current.off("connect", listener);
    current.off("disconnect", listener);
    current.off("connect_error", listener);
  };
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
