import { PokemonData } from '../../types/PokemonData';
import Card from './Card';

type Props = {
  pokemonList: PokemonData[] | null[];
};

const CardList:React.FC<Props> = ({ pokemonList }) => {
  return (
    <div className="flex px-12 justify-between">
      {pokemonList.map((pokemon, index) => (
        <Card pokemon={pokemon} key={index} />
      ))}
    </div>
  );
};

export default CardList;