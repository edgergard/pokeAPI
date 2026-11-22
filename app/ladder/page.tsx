import type { Metadata } from 'next';
import { LadderPage } from '@/views/ladder';

export const metadata: Metadata = { title: 'Ladder' };

export default function Page() {
  return <LadderPage />;
}
