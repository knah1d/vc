import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type AuthResponse } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";

interface AuthState {
  user: AuthResponse["user"] | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse["user"] | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (user) connectSocket();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function persist(auth: AuthResponse) {
    localStorage.setItem("token", auth.token);
    localStorage.setItem("user", JSON.stringify(auth.user));
    setUser(auth.user);
    connectSocket();
  }

  async function login(email: string, password: string) {
    persist(await api.login(email, password));
  }

  async function signup(email: string, password: string, displayName: string) {
    persist(await api.signup(email, password, displayName));
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    disconnectSocket();
  }

  return <AuthContext.Provider value={{ user, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
