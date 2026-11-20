import { useEffect, useState } from 'react';

type GsapInteractive = typeof import('./gsap-interactive');

let loaded: GsapInteractive | null = null;
let loading: Promise<GsapInteractive> | null = null;

function loadGsapInteractive(): Promise<GsapInteractive> {
  loading ??= import('./gsap-interactive').then(
    (mod) => (loaded = mod),
    (error: unknown) => {
      loading = null; // a failed chunk load (e.g. offline) may be retried by the next caller
      throw error;
    },
  );
  return loading;
}

/**
 * Draggable, Flip and ScrambleText (registered), loaded on first need. Returns null until the chunk
 * has arrived, so callers arm their effects once it is non-null (and fall back to no animation before).
 */
export function useGsapInteractive(needed: boolean): GsapInteractive | null {
  const [mod, setMod] = useState(loaded);

  useEffect(() => {
    if (!needed || mod) return;
    let live = true;
    loadGsapInteractive().then(
      (next) => live && setMod(next),
      () => {}, // without the plugins, Alt + arrows still swap (instantly) and the name simply appears
    );
    return () => {
      live = false;
    };
  }, [needed, mod]);

  return mod;
}
