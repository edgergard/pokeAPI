import PokemonImage from '../../public/pokemon-image.png';

const Card = () => {
  return (
      <div className="h-96 w-64 max-w-md rounded-2xl border-8 border-card-border flex flex-col">
        <div className="relative">
          <img 
            src={PokemonImage} 
            alt="pokemon-image"
            className="w-64 rounded-t-lg"
          />

          <button className="absolute top-2 right-2 w-10 h-10 bg-card-type-badge hover:bg-card-text-bold rounded-full flex justify-center items-center transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="absolute top-2 left-2 w-10 h-10 bg-card-type-badge rounded-full flex justify-center items-center">
            <p className="text-base font-bold text-white">
              000
            </p>
          </div>
        </div>

        <div className="flex-1 p-3.5 rounded-b-lg bg-card-background">
          <div className="flex items-center gap-x-2">
            <p className="text-2xl font-extrabold text-card-text-bold">
              Venusaur
            </p>

            <div className="h-8 px-2.5 py-0.5 rounded-full bg-card-type-badge flex items-center">
              <p className="text-base font-bold text-white">
                Grass
              </p>
            </div>
          </div>

          <ul className="flex flex-wrap gap-1 mt-4">
            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">EXP</p>
              <p className="text-card-type-badge font-bold text-xs">101</p>
            </li>
    
            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">HP</p>
              <p className="text-card-type-badge font-bold text-xs">48</p>
            </li>
            
            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">Attack</p>
              <p className="text-card-type-badge font-bold text-xs">48</p>
            </li>

            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">Defense</p>
              <p className="text-card-type-badge font-bold text-xs">48</p>
            </li>

            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">Speed</p>
              <p className="text-card-type-badge font-bold text-xs">48</p>
            </li>
          </ul>
        </div>
      </div>
  );
};

export default Card;