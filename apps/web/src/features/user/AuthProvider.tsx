import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchCurrentUser } from '../../api/user';
import type { UserAccount, UserLoginPayload } from '../../api/types';
import {
  clearStoredUserSession,
  readStoredUserSession,
  writeStoredUserSession,
} from './storage';

interface UserAuthContextValue {
  ready: boolean;
  token: string | null;
  user: UserAccount | null;
  login: (payload: UserLoginPayload) => void;
  updateUser: (user: UserAccount) => void;
  logout: () => void;
}

const UserAuthContext = createContext<UserAuthContextValue | null>(null);

export function UserAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(() => readStoredUserSession());
  const [ready, setReady] = useState(() => !readStoredUserSession()?.token);

  useEffect(() => {
    let active = true;

    if (!session?.token) {
      setReady(true);
      return () => {
        active = false;
      };
    }

    setReady(false);
    void fetchCurrentUser()
      .then((user) => {
        if (!active) {
          return;
        }
        const nextSession = { ...session, user };
        setSession(nextSession);
        writeStoredUserSession(nextSession);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setSession(null);
        clearStoredUserSession();
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [session?.token]);

  const value: UserAuthContextValue = {
    ready,
    token: session?.token ?? null,
    user: session?.user ?? null,
    login: (payload) => {
      const nextSession = {
        token: payload.token,
        user: payload.user,
        expiresAt: payload.expiresAt,
      };
      setReady(true);
      setSession(nextSession);
      writeStoredUserSession(nextSession);
    },
    updateUser: (user) => {
      if (!session) {
        return;
      }
      const nextSession = { ...session, user };
      setSession(nextSession);
      writeStoredUserSession(nextSession);
    },
    logout: () => {
      setReady(true);
      setSession(null);
      clearStoredUserSession();
    },
  };

  return <UserAuthContext.Provider value={value}>{ready ? children : null}</UserAuthContext.Provider>;
}

export function useUserAuth() {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error('useUserAuth must be used within UserAuthProvider');
  }
  return context;
}
