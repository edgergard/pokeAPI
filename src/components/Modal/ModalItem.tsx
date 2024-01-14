import { PokemonData } from "../../types/PokemonData";

type Props = {
  pokemon: PokemonData;
};

const ModalItem: React.FC<Props> = ({ pokemon }) => {
  const { id, name, types, stats, sprites, base_experience } = pokemon;

  return (
    <div className="flex justify-around items-center bg-card-background w-full rounded-lg p-4">
    <img 
      src={sprites.front_default} 
      alt="pokemon-sprite" 
      className="bg-white rounded-lg border-4 border-card-border"
    />

    <div className="flex flex-col items-center gap-y-2 w-96">
      <p className="text-2xl font-extrabold text-card-text-bold capitalize">
        {name}
      </p>

      <div className="h-8 px-2.5 py-0.5 rounded-full bg-card-type-badge flex items-center">
        <p className="text-base font-bold text-white capitalize">
          {types[0].type.name}
        </p>
      </div>
    </div>

    <ul className="flex flex-wrap gap-2 mt-4 w-48">
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

    <div className="w-12 h-12 bg-card-type-badge rounded-full flex justify-center items-center">
      <p className="text-base font-bold text-white">
        {id}
      </p>
    </div>
  </div>
  );
};

export default ModalItem;