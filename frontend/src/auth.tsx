import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler, type User } from './api';

interface AuthState {
  user: User | null;
  unread: number;
  ready: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [unread, setUnread] = useState(0);
  const [ready, setReady] = useState(!getToken());

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    setUnread(0);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    try {
      const r = await api.get<{ user: User; unread: number }>('/auth/me');
      setUser(r.user);
      setUnread(r.unread);
    } catch {
      /* 401 já desloga pelo handler; erro de rede mantém a sessão */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    refresh();
  }, [refresh, signOut]);

  const signIn = useCallback((token: string, u: User) => {
    setToken(token);
    setUser(u);
    setReady(true);
  }, []);

  const value = useMemo(() => ({ user, unread, ready, signIn, signOut, refresh, setUser }), [user, unread, ready, signIn, signOut, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
