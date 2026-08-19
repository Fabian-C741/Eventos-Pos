import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api, getToken, setToken, setUserCache, getUserCache } from '../api/client';
import type { SessionUser } from '../../shared/types';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  needsSetup: boolean;
  login: (username: string, password: string) => Promise<SessionUser>;
  loginPin: (username: string, pin: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => {
    const cached = getUserCache() as SessionUser | null;
    return cached && getToken() ? cached : null;
  });
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const loadUser = useCallback(() => {
    const cached = getUserCache() as SessionUser | null;
    if (cached && getToken()) {
      setUser(cached);
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const st = await api.get<{ setup: boolean }>('/auth/status', { silent: true });
        setNeedsSetup(st.setup);
        if (getToken()) {
          try {
            const me = await api.get<SessionUser>('/auth/me', { silent: true });
            setUserCache(me);
            setUser(me);
          } catch {
            setToken(null);
            setUserCache(null);
            setUser(null);
          }
        }
      } catch {
        setNeedsSetup(true);
      }
      setLoading(false);
    };
    bootstrap();
    const onLogout = () => setUser(null);
    window.addEventListener('epos:logout', onLogout);
    return () => window.removeEventListener('epos:logout', onLogout);
  }, []);

  const applyAuth = (token: string, u: SessionUser) => {
    setToken(token);
    setUserCache(u);
    setUser(u);
  };

  const login = async (username: string, password: string) => {
    const r = await api.post<{ token: string; user: SessionUser }>('/auth/login', { username, password });
    applyAuth(r.token, r.user);
    return r.user;
  };

  const loginPin = async (username: string, pin: string) => {
    const r = await api.post<{ token: string; user: SessionUser }>('/auth/login/pin', { username, pin });
    applyAuth(r.token, r.user);
    return r.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      /* noop */
    }
    setToken(null);
    setUserCache(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, login, loginPin, logout, refresh: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}