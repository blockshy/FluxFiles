function normalizeBaseUrl(baseUrl: string) {
  const trimmed = (baseUrl || '/').trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export const appBaseUrl = normalizeBaseUrl(import.meta.env.BASE_URL || '/fluxfiles/');
export const appBasename = appBaseUrl === '/' ? '/' : appBaseUrl.replace(/\/$/, '');

export function withAppBase(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (appBasename === '/') {
    return normalizedPath;
  }
  return `${appBasename}${normalizedPath}`;
}
