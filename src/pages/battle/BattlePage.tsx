import { Pokeball } from '@/entities/pokemon';
import { href } from '@/shared/lib/router';

/** Placeholder shell; the arena arrives in a later task. */
export default function BattlePage() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-6 px-4 text-center">
      <Pokeball className="size-12 text-accent" />
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Battle arena</h1>
      <p className="text-ink-300">Team battles are coming soon.</p>
      <a href={href('/')} className="rounded-lg px-3 py-2 text-sm text-ink-300 transition-colors hover:bg-white/5 hover:text-white">
        ← Back to Trainer Studio
      </a>
    </main>
  );
}
