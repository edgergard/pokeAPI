import React, { useEffect, useState } from 'react';
import ModalItemList from './ModalItemList';
import { FormData } from '../../types/FormData';
import { getSinglePokemonData } from '../../api/api';
import Loader from '../Loader';
import { PokemonData } from '../../types/PokemonData';
import CloseModalIcon from '../Icons/CloseIconModal';

type Props = {
  onClose: () => void;
  onCancel: () => void;
  onSave: (data: FormData, pokemonList: PokemonData[]) => void;
  formData: FormData;
  selectedPokemons: string[];
};

const ModalContent:React.FC<Props> = ({ 
  onClose,
  onCancel,
  onSave,
  formData,
  selectedPokemons,
}) => {
  const [modalPokemonList, setModalPokemonList] = useState<PokemonData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);

    const promises = selectedPokemons.map((pokemonName) => {
      return getSinglePokemonData(pokemonName)
        .then(response => response.data)
        .catch(error => {
          throw new Error(`Error fetching data for ${pokemonName}`, error);
        });
    });

    Promise.all(promises)
      .then(pokemonData => {
        setModalPokemonList(pokemonData);
      })
      .catch(error => {
        throw new Error('Error fetching Pokemon data:', error);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="w-6/12 bg-white rounded-lg py-8 px-8">
      <div className="flex justify-between items-center mb-8">
        <p className="text-4xl font-bold">
          {`Trainer name: ${formData.fname} ${formData.lname}`}
        </p>

        <button 
          onClick={onClose} 
          className="p-2 rounded-full text-black hover:bg-card-background active:bg-button-submit-active transition-all"
        >
          <CloseModalIcon />
        </button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-96 mb-8">
          <Loader />
        </div>
      ) : (
        <div className="mb-8">
          <ModalItemList modalPokemonList={modalPokemonList} />
        </div>
      )}

      <div className="flex justify-end gap-x-6 text-3xl font-semibold">
        <button 
          onClick={() => onCancel()}
          className="px-4 pb-1 rounded-lg hover:bg-card-background transition-all active:bg-button-submit-active"
        >
          Cancel
        </button>

        <button 
          onClick={() => onSave(formData, modalPokemonList)}
          className="px-4 pb-1 rounded-lg bg-button-submit hover:bg-button-submit-hover active:bg-button-submit-active text-white font-semibold transition-all"
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default ModalContent;