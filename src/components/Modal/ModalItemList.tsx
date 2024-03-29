import { PokemonData } from '../../types/PokemonData';
import ModalItem from './ModalItem';

type Props = {
  modalPokemonList: PokemonData[];
};

const ModalItemList: React.FC<Props> = ({ modalPokemonList }) => {
  return (
    <div className="flex flex-col gap-y-2">
      {modalPokemonList.map((pokemon, index) => (
        <ModalItem pokemon={pokemon} key={index} />
      ))}
  </div>
  );
};

export default ModalItemList;