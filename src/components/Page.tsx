import CardList from './CardList';
import Form from './Form';

const Page = () => {
  return (
    <div className="bg-page-background">
      <div className="mx-auto min-h-screen max-w-screen-xl">
        <h1 className="px-12 py-12 text-6xl font-bold">
          PokeAPI task
        </h1>

        <Form />

        <p className="px-12 py-12 h-36 text-6xl font-bold">
          A A team
        </p>

        <CardList />
    </div>
  </div>
  );
};

export default Page;