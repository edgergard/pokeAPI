import { useState } from 'react';
import { BattleSetup, type Picks } from '@/features/battle-setup';
import type { BattleTeam } from '@/entities/battle';
import { href } from '@/shared/lib/router';
import { Button } from '@/shared/ui/Button';
import { StagePreview } from './StagePreview'; // TEMPORARY (Task 8) — Task 10 mounts the arena widget

type State =
  | { phase: 'setup' }
  | { phase: 'battle'; red: BattleTeam; blue: BattleTeam; seed: number };

/** Setup, then (for now) a placeholder listing the fighters; the arena replaces it later. */
export default function BattlePage() {
  const [state, setState] = useState<State>({ phase: 'setup' });
  const [picks, setPicks] = useState<Picks>({ red: null, blue: null });

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-3">
        <a
          href={href('/')}
          className="-ml-3 w-fit rounded-lg px-3 py-2 text-sm text-ink-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-accent"
        >
          ← Back to Trainer Studio
        </a>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Battle arena</h1>
      </header>

      {state.phase === 'setup' ? (
        <BattleSetup
          picks={picks}
          onPicksChange={setPicks}
          onReady={(red, blue) => setState({ phase: 'battle', red, blue, seed: Math.floor(Math.random() * 2 ** 31) })}
        />
      ) : (
        <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-ink-900/70 p-5" aria-label="Battle">
          {/* TEMPORARY (Task 8): bare stage preview until the arena widget lands in Task 10. */}
          <StagePreview red={state.red} blue={state.blue} />
          <p className="text-ink-300">Arena coming soon. Fighters ready:</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[state.red, state.blue].map((team) => (
              <div key={team.side}>
                <h2 className="font-semibold">{team.trainerName}</h2>
                <p className="text-sm text-ink-300">{team.fighters.map((f) => f.name).join(', ')}</p>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={() => setState({ phase: 'setup' })} className="w-fit">
            New battle
          </Button>
        </section>
      )}
    </main>
  );
}
