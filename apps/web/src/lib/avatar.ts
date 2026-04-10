const palette = [
  { bg: '#1d4ed8', text: '#eff6ff' },
  { bg: '#047857', text: '#ecfdf5' },
  { bg: '#7c3aed', text: '#f5f3ff' },
  { bg: '#c2410c', text: '#fff7ed' },
  { bg: '#be123c', text: '#fff1f2' },
  { bg: '#0f766e', text: '#f0fdfa' },
];

function hashSeed(input: string) {
  let hash = 2166136261;
  for (const char of input.toLowerCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildDefaultAvatarDataUrl(username: string, displayName?: string) {
  const seed = (displayName || username || 'FluxFiles').trim();
  const initial = Array.from(seed.toUpperCase())[0] ?? 'F';
  const choice = palette[hashSeed(seed) % palette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="40" fill="${choice.bg}"/><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" fill="${choice.text}" font-family="Arial, sans-serif" font-size="72" font-weight="700">${initial}</text></svg>`;
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `data:image/svg+xml;base64,${window.btoa(binary)}`;
}
