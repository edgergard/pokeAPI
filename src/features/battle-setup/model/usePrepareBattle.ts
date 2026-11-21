import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { pokemonQuery } from '@/entities/pokemon';
import { loadMovesets, type BattleTeam, type TeamChoice } from '@/entities/battle';
import { prepareErrorMessage } from './prepareError';
import { prepareTeams } from './prepareTeams';

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
        const teams = await prepareTeams(red, blue, fetchPokemon, loadMovesets);
        setStatus('idle');
        return teams;
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
