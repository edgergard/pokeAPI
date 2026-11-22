/**
 * Talent definitions (contract shape; content filled in by stream 1-progression).
 * Pokémon talents: 3 branches × 4 tiers (design.md creature). Trainer talents: ~15 nodes that change rules.
 */
export type TalentBranch = 'offense' | 'defense' | 'tempo';

/** What a talent does, as data the battle engine and progression code interpret. */
export type TalentEffect =
  | {
      kind: 'statPercent';
      stat: 'hp' | 'attack' | 'defense' | 'specialAttack' | 'specialDefense' | 'speed';
      percent: number;
    }
  | { kind: 'critChance'; percent: number }
  | { kind: 'firstStrike' }
  | { kind: 'xpPercent'; percent: number }
  | { kind: 'dustPercent'; percent: number }
  | { kind: 'benchXpPercent'; percent: number }
  | { kind: 'capsuleChance'; percent: number };

export type PokemonTalent = {
  id: string;
  branch: TalentBranch;
  /** 1–4; tier N needs tier N−1 of the same branch. */
  tier: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  effects: TalentEffect[];
};

export type TrainerTalent = {
  id: string;
  name: string;
  description: string;
  /** Trainer level needed to learn it. */
  requiresLevel: number;
  /** Talent ids that must be learned first. */
  requires: string[];
  effects: TalentEffect[];
};

export const POKEMON_TALENTS: PokemonTalent[] = [];
export const TRAINER_TALENTS: TrainerTalent[] = [];
