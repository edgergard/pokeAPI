import { Dispatch, SetStateAction } from "react";
import { FieldValues, useForm } from "react-hook-form";

type Props = {
  onFirstNameChange: Dispatch<SetStateAction<string>>;
  onLastNameChange: Dispatch<SetStateAction<string>>;
};

const Form: React.FC<Props> = ({ onFirstNameChange, onLastNameChange }) => {
  const { handleSubmit, register, formState: { errors }, reset } = useForm();

  const onSubmit = (data: FieldValues) => {
    onFirstNameChange(data.fname);
    onLastNameChange(data.lname);

    reset();
  };

  return (
    <div className="flex px-12">
      <form 
        onSubmit={handleSubmit(onSubmit)} 
        className="flex items-center gap-4 mr-16"
      >
        <div className="flex flex-col">
          <label className="mb-2 font-semibold flex gap-1">
            First name

            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
          </label>

          <input
            {...register("fname", {
              required: true, 
              minLength: 2, 
              maxLength: 12,
              pattern: /^[A-Za-z]+$/i,
            })}
            id="fname"
            placeholder="Enter your first name"
            className={`
              rounded-lg px-4 py-2 w-64 hover:outline hover:outline-2 focus:outline focus:outline-2
              ${errors.fname ? 'outline-label-error' : 'outline-button-submit'}
            `}
          />

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

          <input 
            {...register("lname", {
              required: true, 
              minLength: 2, 
              maxLength: 12,
              pattern: /^[A-Za-z]+$/,
            })}
            id="lname"
            placeholder="Enter your last name"
            className={`
              rounded-lg px-4 py-2 w-64 hover:outline hover:outline-2 focus:outline focus:outline-2
              ${errors.lname ? 'outline-label-error' : 'outline-button-submit'}
            `}
          />
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
  
        <button 
          type="submit" 
          className="flex gap-2 h-10 px-4 py-2 text-center rounded-lg bg-button-submit hover:bg-button-submit-hower active:bg-button-submit-active text-white font-semibold transition-all"
        >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-6">
          <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
        </svg>
          Submit
        </button>
      </form>

      <div className="relative flex flex-col">
        <label htmlFor="" className="mb-2 font-semibold">
          Select your pokemon:
        </label>
        <select className="appearance-none rounded px-4 py-2 w-64 h-10 hover:outline hover:outline-2 outline-button-submit focus:outline focus:outline-2 cursor-pointer">
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>

        <div className="absolute top-11 right-0 flex items-center pr-4 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default Form;