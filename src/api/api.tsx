import axios from 'axios';

const POKEMONS_URL = 'https://pokeapi.co/api/v2/pokemon?limit=10000';

export const getAllPokemonURL = () => {
  return axios.get(POKEMONS_URL);
};