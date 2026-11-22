import type { Metadata } from 'next';
import { CreaturePage } from '@/views/creature';

export const metadata: Metadata = { title: 'Creature' };

export default function Page() {
  return <CreaturePage />;
}
