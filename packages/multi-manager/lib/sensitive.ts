/**
 * Mask absolute user/home paths for UI display.
 * Keeps enough structure for debugging without leaking usernames.
 */

export function maskPath(input?: string | null): string {
  if (!input) return '-';
  let value = String(input);

  value = value.replace(/^\/Users\/[^/]+/i, '~');
  value = value.replace(/^\/home\/[^/]+/i, '~');
  value = value.replace(/^\/private\/var\/folders\/[^/]+\/[^/]+\/[^/]+\/T/i, '~/tmp');

  // Any remaining absolute user segments
  value = value.replace(/\/Users\/[^/]+/gi, '/Users/***');
  value = value.replace(/\/home\/[^/]+/gi, '/home/***');

  return value;
}

export function maskPathShort(input?: string | null, max = 56): string {
  const masked = maskPath(input);
  if (masked === '-' || masked.length <= max) return masked;
  const head = Math.max(14, Math.floor(max * 0.45));
  const tail = Math.max(14, max - head - 1);
  return `${masked.slice(0, head)}…${masked.slice(-tail)}`;
}

export function basenamePath(input?: string | null): string {
  if (!input) return '-';
  const value = String(input).replace(/\\/g, '/');
  const parts = value.split('/').filter(Boolean);
  return parts[parts.length - 1] || value;
}
