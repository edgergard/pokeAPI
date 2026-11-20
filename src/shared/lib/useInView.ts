import { useEffect, useState, type RefObject } from 'react';

type Options = {
  rootMargin?: string;
  threshold?: number;
};

/**
 * True once the element has scrolled into view; stays true afterwards.
 * Defaults to any visible pixel: an area ratio is unreachable for tall targets in short
 * viewports (e.g. 400% zoom), which would leave paused entrances invisible for good.
 */
export function useInView(
  ref: RefObject<Element | null>,
  { rootMargin = '0px 0px -10% 0px', threshold = 0 }: Options = {},
): boolean {
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin, threshold, inView]);

  return inView;
}
