import { useState } from 'react';
import CardList from './CardList';
import Form from './Form';

const Page = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  return (
    <div className="bg-page-background">
      <div className="mx-auto min-h-screen max-w-screen-xl">
        <h1 className="px-12 py-12 text-6xl font-bold">
          PokeAPI task
        </h1>

        <Form onFirstNameChange={setFirstName} onLastNameChange={setLastName}/>

        <p className="px-12 py-12 h-36 text-6xl font-bold">
          {firstName ? `${firstName} ${lastName} team` : 'Enter your name'}
        </p>

        <CardList />
    </div>
  </div>
  );
};

export default Page;