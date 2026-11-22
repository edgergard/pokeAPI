import type { PokemonType } from '@/entities/pokemon';
import type { TalentBranch } from '@/entities/progression';

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

/** What the HUD and the card show next to a fighter's name (Must #7): stars and learned talent branches. */
export type FighterBadges = {
  /** Star count (0 = no star badge, e.g. the legacy watch-only battle). */
  stars: number;
  /** One icon per learned talent, by branch (offense / defense / tempo). */
  talentIcons: TalentBranch[];
};

export type Fighter = {
  /** `${side}-${slot}` */
  id: string;
  side: Side;
  slot: number;
  /** Display name, ready to show ("Mr. Mime", "Ho-Oh"). */
  name: string;
  pokemonId: number;
  types: PokemonType[];
  artwork: string | null;
  level: number;
  badges: FighterBadges;
  /** Final battle stats (level, IVs, nature and talents already applied by the caller). */
  stats: BattleStats;
  moves: Move[];
  /** Talent modifier (`critChance`): percentage points added to the base critical-hit chance. */
  critChanceBonus?: number;
  /**
   * Talent modifier (`firstStrike`): acts first in its first turn on the field, whatever the
   * speeds. When both actives have it that turn, the normal speed order decides.
   */
  firstStrike?: boolean;
};

export type BattleTeam = {
  side: Side;
  trainerName: string;
  fighters: Fighter[];
};

export type Effectiveness = 0 | 0.25 | 0.5 | 1 | 2 | 4;
