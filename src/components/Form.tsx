import {Dispatch, SetStateAction, useState } from "react";
import { FieldValues, useForm } from "react-hook-form";
import Loader from "./Loader";
import { PokemonURL } from "../types/PokemonURL";
import { capitalize, filterPokemons } from "../utils/functions";
import Modal from "./Modal/Modal";
import ModalContent from "./Modal/ModalContent";
import { FormData } from "../types/FormData";
import { PokemonData } from "../types/PokemonData";

type Props = {
  onFirstNameChange: Dispatch<SetStateAction<string>>;
  onLastNameChange: Dispatch<SetStateAction<string>>;
  isLoading: boolean;
  pokemonsURL: PokemonURL[];
  selectedPokemons: string[];
  setSelectedPokemons: Dispatch<SetStateAction<string[]>>;
  setPagePokemonList: Dispatch<SetStateAction<PokemonData[]>>;
};

const Form: React.FC<Props> = ({ 
  onFirstNameChange, 
  onLastNameChange,
  isLoading,
  pokemonsURL,
  selectedPokemons,
  setSelectedPokemons,
  setPagePokemonList
}) => {
  const [isModalOpened, setIsModalOpened] = useState(false);

  const { 
    handleSubmit, 
    register, 
    formState: { errors }, 
    reset, 
    watch, 
    setValue,
  } = useForm();

  const selectQuery = watch('select');
  const fnameQuery = watch('fname');
  const lnameQuery = watch('lname');

  const filteredPokemons = filterPokemons(selectQuery, pokemonsURL);

  const isTeamFull = selectedPokemons.length === 4;

  const onSubmit = (data: FieldValues) => {
    setIsModalOpened(true);
  };

  const modalCancel = () => {
    setSelectedPokemons([]);
    reset();
    setIsModalOpened(false);
  };

  const modalSave = (data: FormData, pokemonList: PokemonData[]) => {
    onFirstNameChange(data.fname);
    onLastNameChange(data.lname);
    setSelectedPokemons([]);
    setPagePokemonList(pokemonList);
  
    reset();
  
    setIsModalOpened(false);
  };

  const handleSelecItemClick = (pokemon: PokemonURL) => {
    setSelectedPokemons(prevState => [...prevState, pokemon.name]);
    setValue('select', '');
  };

  const handleRemovePokemon = (index: number) => {
    setSelectedPokemons((prevPokemons) => {
      const newPokemons = [...prevPokemons];

      newPokemons.splice(index, 1);

      return newPokemons;
    });
  };

  return (
    <div className="flex px-12">
      <form 
        onSubmit={handleSubmit(onSubmit)} 
        className="flex gap-4"
      >
        <div className="flex flex-col">
          <label className="mb-2 font-semibold flex gap-1">
            First name

            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
          </label>

          <div
            className={` flex bg-white gap-6
              rounded-lg px-2 py-2 w-64 hover:outline hover:outline-2 focus:outline focus:outline-2
              ${errors.fname ? 'outline-label-error' : 'outline-button-submit'}
            `}>
            <input
              {...register("fname", {
                required: true, 
                minLength: 2, 
                maxLength: 12,
                pattern: /^[A-Za-z]+$/i,
              })}
              id="fname"
              placeholder="Enter your first name"
              className="outline-none w-full"
              autoComplete="off"
            />

            {fnameQuery && (
              <button onClick={() => setValue('fname', '')}>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" viewBox="0 0 24 24" 
                  strokeWidth={1.5} 
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          
          {errors.fname ? (
            <label className="mt-2 text-label-error">
              Please type a valid first name.
            </label>
          ) : (
            <label className="mt-2 text-form-required">
              This information is required.
            </label>
          )}
        </div>

        <div className="flex flex-col">
          <label className="mb-2 font-semibold flex gap-1">
            Last name
    
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
          </label>

          <div
            className={` flex bg-white gap-6
              rounded-lg px-2 py-2 w-64 hover:outline hover:outline-2 focus:outline focus:outline-2
              ${errors.fname ? 'outline-label-error' : 'outline-button-submit'}
            `}>
            <input
              {...register("lname", {
                required: true, 
                minLength: 2, 
                maxLength: 12,
                pattern: /^[A-Za-z]+$/i,
              })}
              id="fname"
              placeholder="Enter your first name"
              className="outline-none w-full"
              autoComplete="off"
            />

            {lnameQuery && (
              <button onClick={() => setValue('lname', '')}>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" viewBox="0 0 24 24" 
                  strokeWidth={1.5} 
                  stroke="currentColor"
                  className="w-5 h-5 "
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {errors.lname ? (
            <label className="mt-2 text-label-error">
              Please type a valid last name.
            </label>
          ) : (
            <label className="mt-2 text-form-required">
              This information is required.
            </label>
          )}
        </div>
        
        {isLoading ? (
          <div className="flex items-center pl-28 px-4 py-2 w-96">
            <Loader />
          </div>
        ) : (
          <div className="relative flex flex-col">
            <label className="flex gap-1 mb-2 font-semibold">
              Select your pokemons

              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              </svg>
            </label>

            <div
              className={`
                flex flex-wrap gap-y-2
                rounded-lg px-2 py-2 w-96 hover:outline hover:outline-2 focus:outline focus:outline-2 bg-white
                outline-button-submit
                ${isTeamFull && 'outline outline-2'}
              `}
            >
              <ul className="flex flex-wrap gap-1 mr-2">
                {selectedPokemons.map((pokemon, index) => (
                  <li 
                    key={index} 
                    className="flex items-center gap-1 bg-button-submit rounded-lg px-2 pb-0.5 text-white font-semibold"
                  >
                    <span>{capitalize(pokemon)}</span>

                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" viewBox="0 0 24 24" 
                      strokeWidth={1.5} 
                      stroke="currentColor" 
                      className="w-5 h-5 text-white cursor-pointer"
                      onClick={() => handleRemovePokemon(index)}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </li>
                ))}
              </ul>

              {!isTeamFull && (
                <input
                  {...register("select", { 
                    minLength: 2,
                    maxLength: 12,
                    pattern: /^[A-Za-z]+$/,
                  })}
                  id="select"
                  placeholder="Enter pokemon name"
                  disabled={isTeamFull}
                  className="outline-none"
                  autoComplete="off"
                />
              )}
        
              <div className="absolute top-11 right-0 flex items-center justify-center pr-2">
                {selectedPokemons.length ? (
                  <button 
                    onClick={() => setSelectedPokemons([])}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" viewBox="0 0 24 24" 
                      strokeWidth={1.5} 
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>

            {selectQuery && (
              <div className="relative top-2 right-0">
                {Boolean(filteredPokemons.length) ? (
                  <ul className="bg-white outline outline-2 outline-button-submit rounded-lg max-h-40 overflow-y-auto absolute w-96">
                    {filteredPokemons.map((pokemon) => (
                      <li 
                        key={pokemon.name} 
                        onClick={() => handleSelecItemClick(pokemon)}
                        className="px-4 py-2 cursor-pointer hover:bg-gray-100 hover:bg-page-background font-semibold"
                      >
                        {capitalize(pokemon.name)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="bg-white outline outline-2 outline-button-submit rounded-lg max-h-40 overflow-y-auto absolute w-96 px-4 py-2">
                    No such pokemons found
                  </div>
                )}
              </div>
            )}

            <label className="mt-2 text-form-required">
              {isTeamFull ? 'Your team is full.' : `Select ${4 - selectedPokemons.length} more pokemons to submit form.`}
            </label>
          </div>
        )}

        <button
          type="submit" 
          disabled={!isTeamFull}
          className={`
            flex gap-2 h-10 px-4 py-2 mt-8 rounded-lg bg-button-submit 
            ${!isTeamFull ? 'bg-opacity-60 cursor-not-allowed' : ' hover:bg-button-submit-hover active:bg-button-submit-active'}
            text-white font-semibold transition-all
          `}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-6">
            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
          </svg>
          Submit
        </button>
      </form>

      <Modal isOpened={isModalOpened}>
          <ModalContent 
            onClose={() => setIsModalOpened(false)}
            onCancel={modalCancel}
            onSave={modalSave}
            formData={watch() as FormData}
            selectedPokemons={selectedPokemons}
          />
      </Modal>
    </div>
  );
};

export default Form;