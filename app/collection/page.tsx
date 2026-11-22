import type { Metadata } from 'next';
import { CollectionPage } from '@/views/collection';

export const metadata: Metadata = { title: 'Collection' };

export default function Page() {
  return <CollectionPage />;
}
