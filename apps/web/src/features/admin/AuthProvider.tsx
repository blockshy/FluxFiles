import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { AdminUser, LoginPayload } from '../../api/types';
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from './storage';

interface AuthContextValue {
  token: string | null;
  user: AdminUser | null;
  login: (payload: LoginPayload) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(() => readStoredSession());

  const value: AuthContextValue = {
    token: session?.token ?? null,
    user: session?.user ?? null,
    login: (payload) => {
      const nextSession = {
        token: payload.token,
        user: payload.user,
        expiresAt: payload.expiresAt,
      };
      setSession(nextSession);
      writeStoredSession(nextSession);
    },
    logout: () => {
      setSession(null);
      clearStoredSession();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

