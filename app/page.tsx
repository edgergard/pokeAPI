import { LegacyHashRedirect } from '@/app/LegacyHashRedirect';
import { HomePage } from '@/views/home/HomePage';

export default function Page() {
  return (
    <>
      <LegacyHashRedirect />
      <HomePage />
    </>
  );
}
