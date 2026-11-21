import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { pokemonQuery } from '@/entities/pokemon';
import { loadMovesets, prepareTeam, type BattleTeam, type TeamChoice } from '@/entities/battle';
import { prepareErrorMessage } from './prepareError';

type Status = 'idle' | 'loading' | 'error';

/** Fetches both teams (cache-first) and the moveset data in parallel. */
export function usePrepareBattle() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const prepare = useCallback(
    async (red: TeamChoice, blue: TeamChoice): Promise<{ red: BattleTeam; blue: BattleTeam }> => {
      setStatus('loading');
      setError(null);
      try {
        const fetchPokemon = (name: string) => queryClient.fetchQuery(pokemonQuery(name));
        const data = await loadMovesets();
        const [r, b] = await Promise.all([
          prepareTeam(red, 'red', fetchPokemon, data),
          prepareTeam(blue, 'blue', fetchPokemon, data),
        ]);
        setStatus('idle');
        return { red: r, blue: b };
      } catch (e) {
        // The UI shows a friendly line; keep the real cause (503, failed chunk, bug) in the console.
        console.error('[battle] prepare failed', e);
        setStatus('error');
        setError(prepareErrorMessage(e));
        throw e;
      }
    },
    [queryClient],
  );

  return { prepare, status, error } as const;
}
