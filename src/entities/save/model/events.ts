import type { CapsuleTier, Rarity } from '@/shared/config/economy';

/**
 * Things that happened in the game (contract). Battle, capsule and progression code report them; the quest
 * logic (entities/quest) folds them into daily-quest progress. Kinds match economy.quests.pool[].kind.
 */
export type GameEvent =
  | { kind: 'battleWon'; stage: number | 'intro' }
  | { kind: 'battleLost'; stage: number | 'intro' }
  | { kind: 'stageCleared'; stage: number }
  | { kind: 'damageDealt'; amount: number }
  | {
      kind: 'capsuleOpened';
      tier: CapsuleTier;
      rarity: Rarity;
      speciesId: number;
      duplicate: boolean;
    }
  | { kind: 'pokemonLeveled'; speciesId: number; level: number }
  | { kind: 'trainerLeveled'; level: number };

export type GameEventKind = GameEvent['kind'];

/** Folds one event into the save (e.g. quest progress). Registered once at app start (SaveProvider). */
export type GameEventReducer = (
  save: import('./schema').Save,
  event: GameEvent,
) => import('./schema').Save;

const reducers: GameEventReducer[] = [];

/** Register a reducer for game events (idempotent per function). */
export function registerGameEventReducer(reducer: GameEventReducer): void {
  if (!reducers.includes(reducer)) reducers.push(reducer);
}

/** Apply events to a save with every registered reducer — pure, for use inside `updateSave(fn)`. */
export function applyGameEvents(
  save: import('./schema').Save,
  events: GameEvent[],
): import('./schema').Save {
  return events.reduce((s, e) => reducers.reduce((acc, r) => r(acc, e), s), save);
}
