import axios from 'axios';

const POKEMONS_LIMIT = 10000;

const POKEMONS_URL = `https://pokeapi.co/api/v2/pokemon?limit=${POKEMONS_LIMIT}`;

export const getAllPokemonURL = async () => {
  const response = await axios.get(POKEMONS_URL);

  return response;
};

const SINGLE_POKEMON_URL = `https://pokeapi.co/api/v2/pokemon/`;

export const getSinglePokemonData = async (pokemonName: string) => {
  const response = await axios.get(`${SINGLE_POKEMON_URL}${pokemonName}`);

  return response;
};
