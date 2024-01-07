import axios from 'axios';

const POKEMONS_URL = 'https://pokeapi.co/api/v2/pokemon?limit=10000';

export const getAllPokemonURL = async () => {
  const response = await axios.get(POKEMONS_URL);

  return response;
};

export const getSinglePokemonData = async (pokemonName: string) => {
  const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);

  return response;
};
