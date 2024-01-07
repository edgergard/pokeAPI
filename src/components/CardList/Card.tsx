import PokemonImage from '../../public/pokemon-image.png';
import { PokemonData } from '../../types/PokemonData';
import { capitalize } from '../../utils/functions';

type Props = {
  pokemon: PokemonData;
};

const Card: React.FC<Props> = ({ pokemon }) => {
  const { id, name, types, stats, sprites, base_experience } = pokemon;

  return (
      <div className="w-64 rounded-2xl flex flex-col"> 
        <div className="relative bg-white border-t-8 border-l-8 border-r-8 border-card-border rounded-t-2xl">
          <img 
            src={sprites.other['official-artwork'].front_default}
            alt="pokemon-image"
            className="w-96 "
          />

          <div className="absolute top-2 right-2 w-12 h-12 bg-card-type-badge rounded-full flex justify-center items-center ">
            <p className="text-base font-bold text-white">
              {id}
            </p>
          </div>
        </div>

        <div className="flex-1 p-3.5 rounded-b-2xl bg-card-background border-b-8 border-l-8 border-r-8 border-card-border">
          <div className="flex items-center gap-x-2">
            <p className="text-2xl font-extrabold text-card-text-bold">
              {capitalize(name)}
            </p>

            <div className="h-8 px-2.5 py-0.5 rounded-full bg-card-type-badge flex items-center">
              <p className="text-base font-bold text-white">
              {capitalize(types[0].type.name)}
              </p>
            </div>
          </div>

          <ul className="flex flex-wrap gap-1 mt-4">
            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">EXP</p>
              <p className="text-card-type-badge font-bold text-xs">{base_experience}</p>
            </li>
    
            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">HP</p>
              <p className="text-card-type-badge font-bold text-xs">{stats[0].base_stat}</p>
            </li>
            
            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">Attack</p>
              <p className="text-card-type-badge font-bold text-xs">{stats[1].base_stat}</p>
            </li>

            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">Defense</p>
              <p className="text-card-type-badge font-bold text-xs">{stats[2].base_stat}</p>
            </li>

            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">Speed</p>
              <p className="text-card-type-badge font-bold text-xs">{stats[5].base_stat}</p>
            </li>
          </ul>
        </div>
      </div>
  );
};

export default Card;