// Public API of the pokemon-search feature.
export { PokemonSearch, type PokemonSearchProps } from './ui/PokemonSearch';
export {
  inSearchMode,
  matchesSpeciesQuery,
  normalizeQuery,
  ownedSpeciesCount,
  searchSpecies,
  type SearchMode,
} from './model/search';
