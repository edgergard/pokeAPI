import { memo, useRef } from 'react';
import { GSAP_EASE, SplitText, gsap, useGSAP } from '@/shared/lib/gsap';
import { usePrefersReducedMotion } from '@/shared/lib/motion';

/** Matches the old CSS curtain-up slot of the heading: 80ms + 2 × --stagger. */
const START_DELAY = 0.2;

/**
 * `background-clip: text` on the gradient span cannot reach characters that sit on their own
 * compositing layer (each animated char does), so every char inside the gradient paints the
 * gradient itself. Each one gets the span's full run width and its own offset into it, so the
 * colours line up exactly as on the unsplit span — across line breaks too. All reads, then all writes.
 */
function paintGradientChars(heading: HTMLElement, chars: Element[]) {
  const runs = Array.from(heading.querySelectorAll<HTMLElement>('.text-gradient'));
  if (runs.length === 0) return;
  const fragments = runs.flatMap((run) => Array.from(run.getClientRects()));
  const total = fragments.reduce((sum, rect) => sum + rect.width, 0);

  const writes: [HTMLElement, number][] = [];
  for (const char of chars) {
    if (!(char instanceof HTMLElement) || !char.closest('.text-gradient')) continue;
    const box = char.getBoundingClientRect();
    const middle = box.top + box.height / 2;
    let offset = 0;
    for (const fragment of fragments) {
      if (middle >= fragment.top && middle <= fragment.bottom && box.left >= fragment.left - 1) {
        offset += box.left - fragment.left;
        break;
      }
      offset += fragment.width;
    }
    writes.push([char, offset]);
  }

  for (const [char, offset] of writes) {
    char.classList.add('hero-char-gradient');
    char.style.setProperty('--grad-w', `${total.toFixed(1)}px`);
    char.style.setProperty('--grad-x', `${(-offset).toFixed(1)}px`);
  }
}

/**
 * The hero headline (an h2 under the page's "Trainer Studio" h1). Memoised with no props so React never
 * re-renders its children: SplitText rewrites them while the intro runs and restores the original
 * markup when it is done.
 */
export const HeroHeading = memo(function HeroHeading() {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduced = usePrefersReducedMotion();
  /** The intro is a one-shot: once it has finished, turning motion back on leaves the heading as it is. */
  const played = useRef(false);

  useGSAP(
    () => {
      const heading = ref.current;
      // reduced: the plain heading is the end state. Marked on completion (not at start) so StrictMode's
      // mount-unmount-mount, or a flip to reduced mid-intro, still lets the intro play through once.
      if (!heading || reduced || played.current) return;

      // autoSplit (lines only) re-splits after web fonts load or the width changes, and hands the
      // returned tween's progress over to the new split, so wrapping is always measured in the real font.
      const split = SplitText.create(heading, {
        type: 'lines,words,chars',
        tag: 'span',
        mask: 'chars',
        aria: 'auto', // aria-label = original text; the split pieces are aria-hidden
        linesClass: 'hero-line',
        wordsClass: 'hero-word',
        charsClass: 'hero-char',
        autoSplit: true,
        onSplit(self: SplitText) {
          paintGradientChars(heading, self.chars);
          return gsap.from(self.chars, {
            yPercent: 115,
            rotate: 7,
            transformOrigin: '0% 100%',
            duration: 0.6,
            ease: GSAP_EASE.outExpo,
            stagger: { amount: 0.3 },
            delay: START_DELAY,
            // Back to the original markup: one text node again, the gradient span repaints as before.
            onComplete: () => {
              played.current = true;
              self.revert();
            },
          });
        },
      });

      return () => split.revert();
    },
    { scope: ref, dependencies: [reduced], revertOnUpdate: true },
  );

  return (
    <h2
      ref={ref}
      className="hero-heading font-display text-5xl leading-[0.95] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl"
    >
      Your collection <span className="text-gradient">fights for you.</span>
    </h2>
  );
});
