import {Dispatch, SetStateAction, useState } from "react";
import { FieldValues, useForm } from "react-hook-form";
import Loader from "./Loader";
import { PokemonURL } from "../types/PokemonURL";
import { capitalize, filterPokemons } from "../utils/functions";
import Modal from "./Modal/Modal";
import ModalContent from "./Modal/ModalContent";
import { FormData } from "../types/FormData";
import { PokemonData } from "../types/PokemonData";

import CloseIcon from "./Icons/CloseIcon";
import LabelIcon from "./Icons/LabelIcon";
import DropdownIcon from "./Icons/DropdownIcon";
import CheckIcon from "./Icons/CheckIcon";

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
    console.log("Form submitted:", data);
    setIsModalOpened(true);
  };

  const checkKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') event.preventDefault();
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
        onKeyDown={(event) => checkKeyDown(event)}
        className="flex gap-4"
      >
        <div className="flex flex-col">
          <label className="mb-2 font-semibold flex gap-1">
            First name

            <LabelIcon size={6} />
          </label>

          <div
            className={` flex bg-white gap-6
              rounded-lg px-4 py-2 w-64 hover:outline hover:outline-2 focus:outline focus:outline-2
              ${errors.fname ? 'outline-label-error' : 'outline-button-submit'}
            `}
          >
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
                <CloseIcon size={5} />
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
    
            <LabelIcon size={6} />
          </label>

          <div
            className={` flex bg-white gap-6
              rounded-lg px-4 py-2 w-64 hover:outline hover:outline-2 focus:outline focus:outline-2
              ${errors.lname ? 'outline-label-error' : 'outline-button-submit'}
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
                <CloseIcon size={5} />
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

              <LabelIcon size={6} />
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
                    
                    <button onClick={() => handleRemovePokemon(index)}>
                      <CloseIcon size={5} />
                    </button>
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
                    <CloseIcon size={5} />
                  </button>
                ) : (
                  <DropdownIcon size={5} />
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
          <CheckIcon size={6} />

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