import {
  POKEMON_TYPES,
  type NamedResource,
  type Pokemon,
  type PokemonListItem,
  type PokemonResponse,
  type PokemonType,
  type StatKey,
} from './types';

const STAT_MAP: Record<string, StatKey> = {
  hp: 'hp',
  attack: 'attack',
  defense: 'defense',
  'special-attack': 'specialAttack',
  'special-defense': 'specialDefense',
  speed: 'speed',
};

const isPokemonType = (value: string): value is PokemonType =>
  (POKEMON_TYPES as readonly string[]).includes(value);

/** ".../pokemon/25/" → 25 */
export const idFromUrl = (url: string): number => {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : NaN;
};

export const toListItem = ({ name, url }: NamedResource): PokemonListItem => ({
  name,
  id: idFromUrl(url),
});

export const toPokemon = (dto: PokemonResponse): Pokemon => {
  const stats: Record<StatKey, number> = {
    hp: 0,
    attack: 0,
    defense: 0,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0,
  };

  for (const { stat, base_stat } of dto.stats) {
    const key = STAT_MAP[stat.name];
    if (key) stats[key] = base_stat;
  }

  return {
    id: dto.id,
    name: dto.name,
    types: [...dto.types]
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.type.name)
      .filter(isPokemonType),
    artwork:
      dto.sprites.other?.['official-artwork']?.front_default ??
      dto.sprites.other?.home?.front_default ??
      dto.sprites.front_default,
    sprite: dto.sprites.front_default,
    baseExperience: dto.base_experience,
    height: dto.height / 10,
    weight: dto.weight / 10,
    stats,
    totalStats: Object.values(stats).reduce((sum, value) => sum + value, 0),
  };
};
