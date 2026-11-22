import type { Species, StatKey } from '@/entities/pokemon';
import type { Nature, OwnedPokemon } from '@/entities/save';
import { NATURE_MULTIPLIER } from '@/shared/config/economy';
import { floorSafe, withPercent } from './math';
import { getPokemonTalent } from './talentCatalog';

export const STAT_KEYS: readonly StatKey[] = [
  'hp',
  'attack',
  'defense',
  'specialAttack',
  'specialDefense',
  'speed',
];

/** Stats a nature can raise or lower (HP never changes). */
export type NatureStat = Exclude<StatKey, 'hp'>;

/** Gen III nature pairs for every nature in the save schema; `null` = neutral. */
export const NATURE_EFFECTS: Record<Nature, { up: NatureStat; down: NatureStat } | null> = {
  neutral: null,
  brave: { up: 'attack', down: 'speed' },
  modest: { up: 'specialAttack', down: 'attack' },
  bold: { up: 'defense', down: 'attack' },
  calm: { up: 'specialDefense', down: 'attack' },
  timid: { up: 'speed', down: 'attack' },
  adamant: { up: 'attack', down: 'specialAttack' },
};

type StatInput = Pick<OwnedPokemon, 'level' | 'ivs' | 'nature' | 'talents'>;

/** Gen III formula without EVs, then nature. No talents. */
function formulaStats(species: Pick<Species, 'stats'>, owned: StatInput): Record<StatKey, number> {
  const { level, ivs } = owned;
  const core = (stat: StatKey) => Math.floor(((2 * species.stats[stat] + ivs[stat]) * level) / 100);
  const nature = NATURE_EFFECTS[owned.nature];
  const withNature = (stat: NatureStat) => {
    const value = core(stat) + 5;
    if (nature?.up === stat) return floorSafe(value * NATURE_MULTIPLIER.up);
    if (nature?.down === stat) return floorSafe(value * NATURE_MULTIPLIER.down);
    return value;
  };
  return {
    hp: core('hp') + level + 10,
    attack: withNature('attack'),
    defense: withNature('defense'),
    specialAttack: withNature('specialAttack'),
    specialDefense: withNature('specialDefense'),
    speed: withNature('speed'),
  };
}

/** Summed `statPercent` talent effects per stat for the given learned talent ids (unknown ids ignored). */
export function talentStatPercents(talents: readonly string[]): Record<StatKey, number> {
  const sums: Record<StatKey, number> = {
    hp: 0,
    attack: 0,
    defense: 0,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0,
  };
  for (const id of talents) {
    for (const effect of getPokemonTalent(id)?.effects ?? []) {
      if (effect.kind === 'statPercent') sums[effect.stat] += effect.percent;
    }
  }
  return sums;
}

/**
 * Battle stats of an owned Pokémon: Gen III formula (level, IVs, no EVs), nature (×1.1 / ×0.9, floored,
 * never HP), then talents (`floor(stat × (1 + sum% / 100))`). Pass `talents = []` for the pre-talent value.
 * With IV 31, neutral nature and no talents it equals the battle engine's `statsAtLevel`.
 */
export function computeStats(
  species: Pick<Species, 'stats'>,
  owned: StatInput,
  talents: readonly string[] = owned.talents,
): Record<StatKey, number> {
  const base = formulaStats(species, owned);
  const percents = talentStatPercents(talents);
  const out = { ...base };
  for (const stat of STAT_KEYS) out[stat] = withPercent(base[stat], percents[stat]);
  return out;
}

export type StatLine = {
  /** Species base stat. */
  base: number;
  /** Level + IV + nature, before talents. */
  formula: number;
  /** What talents add on top of `formula`. */
  talentBonus: number;
  /** Final battle value (`formula + talentBonus`). */
  current: number;
  /** Nature effect on this stat. */
  nature: 'up' | 'down' | null;
};

/** Per-stat breakdown for the creature screen: "base → current (formula, talent contribution)". */
export function statBreakdown(
  species: Pick<Species, 'stats'>,
  owned: StatInput,
  talents: readonly string[] = owned.talents,
): Record<StatKey, StatLine> {
  const formula = computeStats(species, owned, []);
  const current = computeStats(species, owned, talents);
  const nature = NATURE_EFFECTS[owned.nature];
  const line = (stat: StatKey): StatLine => ({
    base: species.stats[stat],
    formula: formula[stat],
    talentBonus: current[stat] - formula[stat],
    current: current[stat],
    nature: nature?.up === stat ? 'up' : nature?.down === stat ? 'down' : null,
  });
  return {
    hp: line('hp'),
    attack: line('attack'),
    defense: line('defense'),
    specialAttack: line('specialAttack'),
    specialDefense: line('specialDefense'),
    speed: line('speed'),
  };
}
