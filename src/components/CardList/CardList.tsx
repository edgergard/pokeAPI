import { PokemonData } from '../../types/PokemonData';
import Card from './Card';
import CardUnknown from './CardUnknown';

type Props = {
  pokemonList: PokemonData[];
};

const CardList:React.FC<Props> = ({ pokemonList }) => {
  if (!pokemonList.length) {
    return (
      <div className="flex px-12 justify-between">
        <CardUnknown />
        <CardUnknown />
        <CardUnknown />
        <CardUnknown />
      </div>
    );
  }

  return (
    <div className="flex px-12 justify-between">
      {pokemonList.map((pokemon, index) => (
        <Card pokemon={pokemon} key={index} />
      ))}
    </div>
  );
};

export default CardList;