import type { UserAccount } from '../../api/types';

const storageKey = 'fluxfiles-user-session';

export interface StoredUserSession {
  token: string;
  user: UserAccount;
  expiresAt: string;
}

export function readStoredUserSession(): StoredUserSession | null {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredUserSession;
  } catch {
    return null;
  }
}

export function writeStoredUserSession(session: StoredUserSession) {
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearStoredUserSession() {
  window.localStorage.removeItem(storageKey);
}
