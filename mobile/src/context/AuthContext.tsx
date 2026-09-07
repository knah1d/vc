import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { api } from '@/lib/api';
import { registerForPushNotifications, unregisterForPushNotifications } from '@/lib/notifications';
import { flushOutbox } from '@/lib/outbox';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { storage, type StoredUser } from '@/lib/storage';

interface AuthState {
  user: StoredUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    let active = true;
    Promise.all([storage.getUser(), storage.getToken()])
      .then(([stored, token]) => { if (active) setUser(token ? stored : null); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    let flushing = false;
    const accountId = user.id;
    async function flush() {
      if (flushing || !active) return;
      flushing = true;
      try { await flushOutbox(accountId, () => active && userRef.current?.id === accountId); }
      catch (error) { console.warn('Outbox sync failed', error); }
      finally { flushing = false; }
    }

    // Any pending/failed outbox messages get resent as soon as the socket is
    // (re)connected — covers a dropped ack, a lost connection mid-send, or the
    // app coming back from being backgrounded.
    const socket = getSocket();
    socket.on('connect', flush);
    void connectSocket(accountId).catch(console.warn);
    void registerForPushNotifications();

    // A backgrounded RN app can have its socket silently die; reconnect the
    // instant the app is foregrounded again rather than waiting on a timeout.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && active) {
        void connectSocket(accountId).then(() => flush()).catch(console.warn);
      }
    });

    return () => {
      active = false;
      socket.off('connect', flush);
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function persist(auth: { token: string; user: StoredUser }) {
    await storage.setToken(auth.token);
    await storage.setUser(auth.user);
    setUser(auth.user);
  }

  async function login(email: string, password: string) {
    await persist(await api.login(email, password));
  }

  async function signup(email: string, password: string, displayName: string) {
    await persist(await api.signup(email, password, displayName));
  }

  async function logout() {
    userRef.current = null;
    disconnectSocket();
    await unregisterForPushNotifications();
    await storage.clearToken();
    await storage.clearUser();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
