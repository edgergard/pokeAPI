import type { PokemonType } from '@/entities/pokemon';

export type Side = 'red' | 'blue';

export type MoveType = PokemonType | 'typeless';

export type Move = {
  name: string;
  type: MoveType;
  power: number;
  accuracy: number | null;
  damageClass: 'physical' | 'special';
};

export type BattleStats = {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
};

export type Fighter = {
  /** `${side}-${slot}` */
  id: string;
  side: Side;
  slot: number;
  name: string;
  pokemonId: number;
  types: PokemonType[];
  artwork: string | null;
  stats: BattleStats;
  moves: Move[];
};

export type BattleTeam = {
  side: Side;
  trainerName: string;
  fighters: Fighter[];
};

export type Effectiveness = 0 | 0.25 | 0.5 | 1 | 2 | 4;
