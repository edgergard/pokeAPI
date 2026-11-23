import Link from 'next/link';

const linkClass =
  'tap-target inline-flex items-center rounded px-2 font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/** Links to the Privacy and Terms pages, for footers next to the fan-project disclaimer. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={className}>
      <ul className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <Link href="/privacy/" className={linkClass}>
            Privacy
          </Link>
        </li>
        <li>
          <Link href="/terms/" className={linkClass}>
            Terms
          </Link>
        </li>
      </ul>
    </nav>
  );
}
