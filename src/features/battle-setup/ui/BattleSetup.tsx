import { Swords } from 'lucide-react';
import { usePokemonIndex } from '@/entities/pokemon';
import { randomRival, useRoster, type Trainer } from '@/entities/trainer';
import type { BattleTeam } from '@/entities/battle';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
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

export function BattleSetup({ onReady, picks = { red: null, blue: null }, preferredRedId, onPicksChange }: Props) {
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
      <div className="grid gap-4 md:grid-cols-2">
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
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button size="lg" onClick={fight} disabled={loading} className="w-full justify-center sm:w-64">
          {loading ? <Spinner label="Preparing teams" className="size-4" /> : <Swords className="size-4" aria-hidden />}
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
