/**
 * Looks of an `aria-disabled` control: dimmed like a disabled one, but still focusable, so pressing a
 * button that disables itself (or a dialog closing) never drops keyboard focus to <body>.
 */
export const unavailableClass =
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:shadow-none aria-disabled:active:scale-100';
