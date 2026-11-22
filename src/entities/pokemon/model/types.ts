// ---------- Raw PokeAPI DTOs (only the fields we actually read) ----------

export type NamedResource = { name: string; url: string };

export type PokemonListResponse = {
  count: number;
  results: NamedResource[];
};

export type PokemonResponse = {
  id: number;
  name: string;
  base_experience: number | null;
  height: number;
  weight: number;
  types: { slot: number; type: NamedResource }[];
  stats: { base_stat: number; stat: NamedResource }[];
  sprites: {
    front_default: string | null;
    other?: {
      'official-artwork'?: { front_default: string | null };
      home?: { front_default: string | null };
    };
  };
};

// ---------- Domain model used by the UI ----------

export const POKEMON_TYPES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

export type StatKey = 'hp' | 'attack' | 'defense' | 'specialAttack' | 'specialDefense' | 'speed';

export type PokemonListItem = {
  id: number;
  name: string;
};

export type Pokemon = {
  id: number;
  name: string;
  types: PokemonType[];
  artwork: string | null;
  sprite: string | null;
  baseExperience: number | null;
  /** metres */
  height: number;
  /** kilograms */
  weight: number;
  stats: Record<StatKey, number>;
  totalStats: number;
};
