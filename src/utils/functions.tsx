import { PokemonURL } from "../types/PokemonURL";

export const filterPokemons = (query: string, pokemons: PokemonURL[]) => {
  const filteredPokemons = pokemons.filter((pokemon) => {
    return query && pokemon.name.toLowerCase().includes(query.toLowerCase().trim());
  });

  return filteredPokemons;
};