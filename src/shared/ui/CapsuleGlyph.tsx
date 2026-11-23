/**
 * Capsule outline (decorative): the game's own container shape, used instead of any official ball art
 * (idea.md Never: no Poke Ball art). Hook-free, so Server Components can render it too.
 */
export function CapsuleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <rect x="6" y="6" width="52" height="52" rx="16" stroke="currentColor" strokeWidth="4" />
      <path d="M6 32h52" stroke="currentColor" strokeWidth="4" />
      <rect x="24" y="24" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}
