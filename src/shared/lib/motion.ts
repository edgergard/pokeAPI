import { useSyncExternalStore } from 'react';

/** JS twins of the CSS motion tokens in app/styles.css — for WAAPI and rAF-driven effects. */
export const EASE = {
  outExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

export const DUR = { xs: 120, sm: 200, md: 320, lg: 500, xl: 700, xxl: 900 } as const;

/*
 * Motion preference.
 * 'system' follows the OS reduced-motion setting; 'on' / 'off' override it.
 * The resolved result is mirrored to <html data-motion="full|reduced">, which every CSS motion rule keys off.
 * index.html sets that attribute before first paint with the same logic (keep the key in sync).
 */
export type MotionPreference = 'system' | 'on' | 'off';

export const MOTION_STORAGE_KEY = 'trainer-studio:motion';
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

const canMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';
const systemReduced = () => canMatchMedia() && window.matchMedia(REDUCED_QUERY).matches;

const isPreference = (value: unknown): value is MotionPreference =>
  value === 'system' || value === 'on' || value === 'off';

function readStoredPreference(): MotionPreference {
  try {
    const raw = window.localStorage.getItem(MOTION_STORAGE_KEY);
    return isPreference(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

let preference: MotionPreference = typeof window === 'undefined' ? 'system' : readStoredPreference();
const listeners = new Set<() => void>();

const resolveReduced = () => preference === 'off' || (preference === 'system' && systemReduced());

function syncDocument() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.motion = resolveReduced() ? 'reduced' : 'full';
}

function notify() {
  syncDocument();
  listeners.forEach((listener) => listener());
}

// One module-level listener forwards OS changes; it lives for the page's lifetime.
if (canMatchMedia()) window.matchMedia(REDUCED_QUERY).addEventListener('change', notify);

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setMotionPreference(next: MotionPreference) {
  preference = next;
  try {
    if (next === 'system') window.localStorage.removeItem(MOTION_STORAGE_KEY);
    else window.localStorage.setItem(MOTION_STORAGE_KEY, next);
  } catch {
    /* storage unavailable — keep in-memory preference */
  }
  notify();
}

export const getMotionPreference = () => preference;

export function useMotionPreference(): MotionPreference {
  return useSyncExternalStore(subscribe, getMotionPreference, () => 'system');
}

/** Snapshot read — use inside event handlers, effects, WAAPI and GSAP code paths. */
export function prefersReducedMotion(): boolean {
  return resolveReduced();
}

/** Reactive version — re-renders when the OS setting or the in-app toggle flips. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}

syncDocument();

/** Same curve as --ease-out-expo, for numbers that must stay in sync with CSS. */
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
