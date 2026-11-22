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
