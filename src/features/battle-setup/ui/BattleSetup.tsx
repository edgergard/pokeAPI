import { Swords } from 'lucide-react';
import { usePokemonIndex } from '@/entities/pokemon';
import { randomRival, useRoster, type Trainer } from '@/entities/trainer';
import type { BattleTeam } from '@/entities/battle';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { cn } from '@/shared/lib/cn';
import { defaultPicks } from '../model/defaultPicks';
import { usePrepareBattle } from '../model/usePrepareBattle';
import { TeamPicker, trainerName } from './TeamPicker';

export type Picks = { red: Trainer | null; blue: Trainer | null };

type Props = {
  onReady: (red: BattleTeam, blue: BattleTeam) => void;
  /** Picks kept by the parent so "New battle" returns to the same choices. */
  picks?: Picks;
  /** Trainer to start in Red (e.g. the team shown on home); ignored when unknown. */
  preferredRedId?: string | null;
  onPicksChange?: (picks: Picks) => void;
};

export function BattleSetup({
  onReady,
  picks = { red: null, blue: null },
  preferredRedId,
  onPicksChange,
}: Props) {
  const { trainers } = useRoster();
  const index = usePokemonIndex();
  const { prepare, status, error } = usePrepareBattle();

  const defaults = defaultPicks(trainers, preferredRedId);
  const red = picks.red ?? defaults.red;
  const blue = picks.blue ?? defaults.blue;
  const loading = status === 'loading';

  const set = (next: Partial<Picks>) => onPicksChange?.({ red, blue, ...next });
  const rival = (side: 'red' | 'blue') => {
    if (index.data) set({ [side]: randomRival(index.data) });
  };

  const fight = () => {
    prepare(
      { trainerName: trainerName(red), team: red.team },
      { trainerName: trainerName(blue), team: blue.team },
    ).then(
      (teams) => onReady(teams.red, teams.blue),
      () => undefined, // surfaced through `status` / `error`
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="relative grid gap-4 md:grid-cols-2 md:gap-6">
        <TeamPicker
          side="red"
          trainer={red}
          own={trainers}
          onChange={(t) => set({ red: t })}
          onRandom={() => rival('red')}
          randomReady={Boolean(index.data)}
          disabled={loading}
        />
        <TeamPicker
          side="blue"
          trainer={blue}
          own={trainers}
          onChange={(t) => set({ blue: t })}
          onRandom={() => rival('blue')}
          randomReady={Boolean(index.data)}
          disabled={loading}
        />
        {/* Sits on the seam between the corners; the corners carry their own labels for assistive tech. */}
        <span
          aria-hidden
          className="vs-badge pointer-events-none absolute top-1/2 left-1/2 z-10 hidden size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-ink-950 font-display text-base font-extrabold tracking-tight text-white md:grid"
        >
          VS
        </span>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          onClick={fight}
          disabled={loading}
          className={cn('relative w-full justify-center sm:w-64', !loading && 'fight-ready')}
        >
          {loading ? (
            <Spinner label="Preparing teams" className="size-4" />
          ) : (
            <Swords className="size-4" aria-hidden />
          )}
          {loading ? 'Preparing…' : 'Fight'}
        </Button>
        <div role="alert" className="min-h-5 text-center text-[13px]">
          {status === 'error' && (
            <span className="text-danger">
              {error ?? 'Could not load the teams.'}{' '}
              <button
                type="button"
                onClick={fight}
                className="tap-target rounded font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Retry
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
