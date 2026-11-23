/** Shared class strings for Home's links that look like buttons (next/link can't use `Button`). */
const base =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export const primaryLink = `${base} h-12 bg-primary px-5 text-base text-primary-foreground shadow-glow hover:bg-primary-hover`;

export const primaryLinkLarge = `${base} h-14 bg-primary px-10 text-lg text-primary-foreground shadow-glow hover:bg-primary-hover`;

export const outlineLink = `${base} h-11 border border-input/60 px-4 text-sm text-foreground hover:border-foreground/40 hover:bg-secondary`;

export const textLink =
  'tap-target rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** Hub panels. */
export const panel = 'relative flex flex-col gap-4 rounded-3xl p-5 glass sm:p-6';

export const eyebrow =
  'font-mono text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase';
