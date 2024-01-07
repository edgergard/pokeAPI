import { useEffect, useState } from 'react';
import CardList from './CardList/CardList';
import Form from './Form';
import { getAllPokemonURL } from '../api/api';
import { PokemonURL } from '../types/PokemonURL';
import { PokemonData } from '../types/PokemonData';

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
              {`Name: ${firstName} ${lastName}`}
              </p>

              <button
                onClick={() => reset()}
                className={` flex gap-2 px-4 py-2 rounded-lg mt-3
                  bg-button-submit hover:bg-button-submit-hover active:bg-button-submit-active
                  text-white font-semibold transition-all
                `}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-6">
                  <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                </svg>
                Reset
              </button>
            </>
          ) : (
            <p className="text-6xl font-bold">
              Name: ?
            </p>
          )}
        </div>


        <CardList pokemonList={pagePokemonList}/>

    </div>
  </div>
  );
};

export default Page;