import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

/*
 * The GSAP entry point for first paint: every module imports gsap, its plugins and useGSAP from here,
 * so plugins are registered exactly once (ES modules evaluate once) before any tween runs.
 * Draggable, Flip and ScrambleText only matter once a team exists, so they live in ./gsap-interactive,
 * loaded on demand through useGsapInteractive() and kept off the critical path.
 *
 * Motion gating: GSAP effects read `usePrefersReducedMotion()` (OS setting + in-app toggle) and pass it
 * to useGSAP's dependencies with `revertOnUpdate: true`, so flipping the toggle reverts every tween,
 * ScrollTrigger and SplitText of that hook and re-arms them when it flips back.
 */
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

// Mobile URL-bar show/hide resizes the viewport constantly; it never changes our trigger positions.
ScrollTrigger.config({ ignoreMobileResize: true });

/** GSAP names for the CSS motion tokens (see app/styles.css and shared/lib/motion.ts). */
export const GSAP_EASE = {
  outExpo: 'expo.out',
  standard: 'power3.out',
  spring: 'back.out(1.5)',
  exit: 'power2.in',
} as const;

export { gsap, ScrollTrigger, SplitText, useGSAP };
