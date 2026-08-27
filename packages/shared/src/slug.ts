/** Path segments reserved under /[tenantSlug]/… that cannot be usernames. */
export const RESERVED_TENANT_PATHS = [
  'videos',
  'upload',
  'users',
  'settings',
] as const;

export function slugifySegment(value: string, fallback = 'user'): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || fallback;
}
