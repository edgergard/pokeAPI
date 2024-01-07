import QuestionMark from '../../../public/question-icon.svg';

const CardUnknown = () => {
  return (
      <div className="w-64 rounded-2xl flex flex-col"> 
        <div className="flex justify-center relative bg-white border-t-8 border-l-8 border-r-8 border-card-border rounded-t-2xl">
          <img 
            src={QuestionMark}
            alt="pokemon-image"
            className="w-48"
          />

          <div className="absolute top-2 right-2 w-12 h-12 bg-card-type-badge rounded-full flex justify-center items-center ">
            <p className="text-base font-bold text-white">
              ???
            </p>
          </div>
        </div>

        <div className="flex-1 p-3.5 rounded-b-2xl bg-card-background border-b-8 border-l-8 border-r-8 border-card-border">
          <div className="flex items-center gap-x-2">
            <p className="text-2xl font-extrabold text-card-text-bold">
              Name
            </p>

            <div className="h-8 px-2.5 py-0.5 rounded-full bg-card-type-badge flex items-center">
              <p className="text-base font-bold text-white">
              Type
              </p>
            </div>
          </div>

          <ul className="flex flex-wrap gap-1 mt-4">
            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">EXP</p>
              <p className="text-card-type-badge font-bold text-xs">???</p>
            </li>
    
            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">HP</p>
              <p className="text-card-type-badge font-bold text-xs">???</p>
            </li>
            
            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">Attack</p>
              <p className="text-card-type-badge font-bold text-xs">???</p>
            </li>

            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">Defense</p>
              <p className="text-card-type-badge font-bold text-xs">???</p>
            </li>

            <li className="flex gap-x-1 px-2.5 py-0.5 rounded-md bg-card-stats-badge">
              <p className="text-card-type-badge text-xs">Speed</p>
              <p className="text-card-type-badge font-bold text-xs">???</p>
            </li>
          </ul>
        </div>
      </div>
  );
};

export default CardUnknown;