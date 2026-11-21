import type { Metadata } from 'next';
import BattlePage from '@/views/battle/BattlePage';

export const metadata: Metadata = {
  title: 'Battle arena',
  description: 'Pick two Pokémon teams and watch them battle as holographic 3D cards.',
  // openGraph merges shallowly: without this, shares of /battle/ would carry the home page's card.
  openGraph: {
    title: 'Battle arena · Trainer Studio',
    description: 'Pick two Pokémon teams and watch them battle as holographic 3D cards.',
    type: 'website',
    url: '/battle/',
  },
};

export default function Page() {
  return <BattlePage />;
}
