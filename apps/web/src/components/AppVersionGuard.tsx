import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { withAppBase } from '../lib/base';

declare const __APP_VERSION__: string;

const VERSION_CHECK_INTERVAL_MS = 60_000;
const MIN_CHECK_GAP_MS = 5_000;
const RELOAD_MARKER_KEY = 'fluxfiles-app-version-reload';

async function fetchRemoteVersion() {
  const response = await fetch(`${withAppBase('/version.json')}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  if (!response.ok) {
    throw new Error(`version check failed: ${response.status}`);
  }
  const data = await response.json() as { version?: string };
  return data.version?.trim() || '';
}

function reloadIntoLatestVersion(nextVersion: string) {
  const marker = `${__APP_VERSION__}->${nextVersion}`;
  if (window.sessionStorage.getItem(RELOAD_MARKER_KEY) === marker) {
    return;
  }
  window.sessionStorage.setItem(RELOAD_MARKER_KEY, marker);
  window.location.reload();
}

function shouldForceReloadForImportError(reason: unknown) {
  const text = reason instanceof Error ? reason.message : String(reason ?? '');
  return text.includes('Failed to fetch dynamically imported module')
    || text.includes('Importing a module script failed')
    || text.includes('Loading chunk')
    || text.includes('ChunkLoadError');
}

export function AppVersionGuard() {
  const location = useLocation();
  const lastCheckedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function checkVersion(force = false) {
      const now = Date.now();
      if (!force && now - lastCheckedAtRef.current < MIN_CHECK_GAP_MS) {
        return;
      }
      lastCheckedAtRef.current = now;
      try {
        const remoteVersion = await fetchRemoteVersion();
        if (!cancelled && remoteVersion && remoteVersion !== __APP_VERSION__) {
          reloadIntoLatestVersion(remoteVersion);
        }
      } catch {
        // Keep the guard silent when version manifest is temporarily unavailable.
      }
    }

    void checkVersion(true);

    const intervalId = window.setInterval(() => {
      void checkVersion();
    }, VERSION_CHECK_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkVersion();
      }
    };

    const handleFocus = () => {
      void checkVersion();
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (shouldForceReloadForImportError(event.reason)) {
        reloadIntoLatestVersion('chunk-recovery');
      }
    };

    const handleError = (event: ErrorEvent) => {
      if (shouldForceReloadForImportError(event.error ?? event.message)) {
        reloadIntoLatestVersion('chunk-recovery');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  useEffect(() => {
    void fetchRemoteVersion().then((remoteVersion) => {
      if (remoteVersion && remoteVersion !== __APP_VERSION__) {
        reloadIntoLatestVersion(remoteVersion);
      }
    }).catch(() => {});
  }, [location.pathname, location.search, location.hash]);

  return null;
}
