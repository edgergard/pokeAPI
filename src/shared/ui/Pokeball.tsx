/** Pokéball outline (decorative). Hook-free, so Server Components can render it too. */
export function Pokeball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="4" />
      <path d="M3 32h20M41 32h20" stroke="currentColor" strokeWidth="4" />
      <circle cx="32" cy="32" r="8" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}
