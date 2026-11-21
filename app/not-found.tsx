import Link from 'next/link';
import { Pokeball } from '@/shared/ui/Pokeball';
import { href } from '@/shared/lib/router';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <Pokeball className="size-12 text-accent" />
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">This page fled the battle</h1>
        <p className="text-ink-300">The link may be old or mistyped.</p>
        <Link
          href={href('/')}
          className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-bold text-ink-950 transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          Back to Trainer Studio
        </Link>
      </div>
    </main>
  );
}
