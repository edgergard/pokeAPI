import type { PokemonType } from './types';

/** Accent colour per elemental type — drives card gradients and badges. */
export const TYPE_COLORS: Record<PokemonType, string> = {
  normal: '#a8a29e',
  fire: '#ff7a3d',
  water: '#4aa3ff',
  electric: '#facc15',
  grass: '#4ade80',
  ice: '#67e8f9',
  fighting: '#f0544f',
  poison: '#c084fc',
  ground: '#d6a35c',
  flying: '#93b4ff',
  psychic: '#ff6fa8',
  bug: '#a3c93a',
  rock: '#c2a878',
  ghost: '#8b7cf6',
  dragon: '#7c6cff',
  dark: '#8a7f78',
  steel: '#9fb4c7',
  fairy: '#f7a8e0',
};

export const typeColor = (type: PokemonType | undefined) => (type ? TYPE_COLORS[type] : '#71717a');

/** Small pixel sprite for list items — available without fetching the full record. */
export const spriteUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
