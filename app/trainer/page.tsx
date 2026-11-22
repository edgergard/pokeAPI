import type { Metadata } from 'next';
import { TrainerPage } from '@/views/trainer';

export const metadata: Metadata = { title: 'Trainer' };

export default function Page() {
  return <TrainerPage />;
}
