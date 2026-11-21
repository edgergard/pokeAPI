'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { legacyHashTarget } from '@/shared/lib/router';

/** Sends old hash-routed links (`/#/battle?red=<id>`) to their real page, replacing the history entry. */
export function LegacyHashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const target = legacyHashTarget(window.location.hash);
    if (target && target !== '/') router.replace(target);
    else if (target === '/') window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [router]);
  return null;
}
