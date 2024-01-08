import { useEffect, useState } from 'react';
import CardList from './CardList/CardList';
import Form from './Form';
import { getAllPokemonURL } from '../api/api';
import { PokemonURL } from '../types/PokemonURL';
import { PokemonData } from '../types/PokemonData';

import ResetIcon from './Icons/ResetIcon';

const Page = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pokemonsURL, setPokemonsURL] = useState<PokemonURL[]>([]);
  const [selectedPokemons, setSelectedPokemons] = useState<string[]>([]);
  const [pagePokemonList, setPagePokemonList] = useState<PokemonData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);

    getAllPokemonURL()
      .then(response => {
        const pokemonsURL = response.data.results;

        setPokemonsURL(pokemonsURL);
      })
      .catch(() => {
        console.error('Error');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const reset = () => {
    setFirstName('');
    setLastName('');
    setPagePokemonList([]);
  };

  return (
    <div className="bg-page-background pb-12">
      <div className="mx-auto min-h-screen max-w-screen-xl">
        <h1 className="px-12 py-12 text-6xl font-bold">
          PokeAPI task
        </h1>

        <Form 
          onFirstNameChange={setFirstName} 
          onLastNameChange={setLastName}
          isLoading={isLoading}
          pokemonsURL={pokemonsURL}
          selectedPokemons={selectedPokemons}
          setSelectedPokemons={setSelectedPokemons}
          setPagePokemonList={setPagePokemonList}
        />
        
        <div className="flex items-center px-12 py-12 gap-12">
          {firstName && lastName ? (
            <>
              <p className="text-6xl font-bold">
              {`Trainer name: ${firstName} ${lastName}`}
              </p>

              <button
                onClick={() => reset()}
                className={` flex gap-2 px-4 py-2 rounded-lg mt-3
                  bg-button-submit hover:bg-button-submit-hover active:bg-button-submit-active
                  text-white font-semibold transition-all
                `}
              >
                <ResetIcon />

                Reset
              </button>
            </>
          ) : (
            <p className="text-6xl font-bold">
              Trainer name: ?
            </p>
          )}
        </div>

        <CardList pokemonList={pagePokemonList}/>
      </div>
    </div>
  );
};

export default Page;