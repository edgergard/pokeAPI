import { Draggable } from 'gsap/Draggable';
import { Flip } from 'gsap/Flip';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { gsap } from './gsap';

/*
 * The GSAP plugins that only matter once a team exists (slot reorder, name scramble).
 * Never import this statically: load it with useGsapInteractive() so it stays out of the first-paint
 * bundle. Type-only imports (`import type`) are fine — they are erased.
 */
gsap.registerPlugin(Draggable, Flip, ScrambleTextPlugin);

export type FlipState = Flip.FlipState;

export { Draggable, Flip };
