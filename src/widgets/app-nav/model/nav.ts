import type { Save } from '@/entities/save';
import { CAPSULE_TIERS } from '@/shared/config/economy';

/** Main sections in tab order. Literal trailing-slash paths (static export, `trailingSlash: true`). */
export const NAV_LINKS = [
  { key: 'home', href: '/', label: 'Home' },
  { key: 'ladder', href: '/ladder/', label: 'Ladder' },
  { key: 'collection', href: '/collection/', label: 'Collection' },
  { key: 'capsules', href: '/capsules/', label: 'Capsules' },
  { key: 'trainer', href: '/trainer/', label: 'Trainer' },
] as const;

export type NavKey = (typeof NAV_LINKS)[number]['key'];

export const SETTINGS_HREF = '/settings/';

/** "/ladder/" and "/ladder" → "/ladder"; the root stays "/". */
export function normalizePath(path: string | null | undefined): string {
  if (!path) return '/';
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** Whether `href` is the page at `pathname` (trailing slashes ignored). */
export function isCurrent(pathname: string | null | undefined, href: string): boolean {
  return normalizePath(pathname) === normalizePath(href);
}

/** Pages a player in onboarding may open directly: home, the intro battle and Settings (save rescue). */
const ONBOARDING_PATHS = new Set(['/', '/battle', '/settings']);

/** During onboarding every other deep link goes back to `/`. */
export function redirectDuringOnboarding(pathname: string | null | undefined): boolean {
  return !ONBOARDING_PATHS.has(normalizePath(pathname));
}

/** Unopened capsules of every tier (Capsules badge). */
export function unopenedCapsules(save: Pick<Save, 'capsules'>): number {
  return CAPSULE_TIERS.reduce((sum, tier) => sum + save.capsules[tier], 0);
}
