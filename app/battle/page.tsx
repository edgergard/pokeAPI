import type { Metadata } from 'next';
import BattlePage from '@/views/battle/BattlePage';

export const metadata: Metadata = {
  title: 'Battle',
  description: 'Send your team into a 3D card battle on the ladder and collect the rewards.',
  // openGraph merges shallowly: without this, shares of /battle/ would carry the home page's card.
  openGraph: {
    title: 'Battle · Trainer Studio',
    description: 'Send your team into a 3D card battle on the ladder and collect the rewards.',
    type: 'website',
    url: '/battle/',
  },
};

export default function Page() {
  return <BattlePage />;
}
