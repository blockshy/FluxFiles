import type { AdminUser } from '../../api/types';

const storageKey = 'fluxfiles-admin-session';

export interface StoredSession {
  token: string;
  user: AdminUser;
  expiresAt: string;
}

export function readStoredSession(): StoredSession | null {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function writeStoredSession(session: StoredSession) {
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearStoredSession() {
  window.localStorage.removeItem(storageKey);
}

