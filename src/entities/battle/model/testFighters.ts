import type { PokemonType } from '@/entities/pokemon';
import type { BattleTeam, Fighter, Move, Side } from './types';

export const TACKLE: Move = {
  name: 'tackle',
  type: 'normal',
  power: 40,
  accuracy: 100,
  damageClass: 'physical',
};
export const SHADOW_BALL: Move = {
  name: 'shadow-ball',
  type: 'ghost',
  power: 80,
  accuracy: 100,
  damageClass: 'special',
};

/** Test fixture: a level-50 fighter with sensible defaults. */
export function makeFighter(overrides: Partial<Fighter> = {}): Fighter {
  const side = overrides.side ?? 'red';
  const slot = overrides.slot ?? 0;
  return {
    id: `${side}-${slot}`,
    side,
    slot,
    name: 'testmon',
    pokemonId: 25,
    types: ['normal'],
    artwork: null,
    level: 50,
    badges: { stars: 0, talentIcons: [] },
    stats: { hp: 110, attack: 75, defense: 60, specialAttack: 70, specialDefense: 70, speed: 100 },
    moves: [TACKLE],
    ...overrides,
  };
}

export function makeTeam(
  side: Side,
  types: PokemonType[],
  moves: Move[],
  speed = 100,
  size = 4,
): BattleTeam {
  return {
    side,
    trainerName: side,
    fighters: Array.from({ length: size }, (_, slot) =>
      makeFighter({ side, slot, types, moves, stats: { ...makeFighter().stats, speed } }),
    ),
  };
}
