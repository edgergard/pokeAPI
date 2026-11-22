import type { Metadata } from 'next';
import { CapsulesPage } from '@/views/capsules';

export const metadata: Metadata = { title: 'Capsules' };

export default function Page() {
  return <CapsulesPage />;
}
