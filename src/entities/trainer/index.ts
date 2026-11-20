import { useLocalStorage } from '@/shared/hooks/useLocalStorage';
import { swapSlots } from './model/swapSlots';

export { swapSlots };

export const TEAM_SIZE = 4;

export type Trainer = {
  firstName: string;
  lastName: string;
  /** Pokémon slugs, in slot order. Details are re-fetched (and cached) by name. */
  team: string[];
  savedAt: string;
};

const STORAGE_KEY = 'trainer-studio:trainer:v1';

/** The saved trainer, persisted across reloads. */
export function useTrainer() {
  const [trainer, setTrainer] = useLocalStorage<Trainer | null>(STORAGE_KEY, null);

  return {
    trainer,
    save: (data: Omit<Trainer, 'savedAt'>) => setTrainer({ ...data, savedAt: new Date().toISOString() }),
    /** Swaps two slots. `savedAt` is kept: reordering is not a new save (no lock-in replay). */
    swap: (from: number, to: number) =>
      setTrainer((current) => {
        if (!current) return current;
        const team = swapSlots(current.team, from, to);
        return team === current.team ? current : { ...current, team: [...team] };
      }),
    reset: () => setTrainer(null),
  };
}
