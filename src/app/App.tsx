import { lazy, Suspense, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from '@/pages/home/HomePage';
import { useHashRoute } from '@/shared/lib/router';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { Spinner } from '@/shared/ui/Spinner';

const BattlePage = lazy(() => import('@/pages/battle/BattlePage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  const route = useHashRoute();

  // A new route starts at the top, like a page load.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <QueryClientProvider client={queryClient}>
      {route === '/battle' ? (
        <ErrorBoundary title="The battle arena couldn’t load" className="mx-auto my-[20dvh] max-w-md">
          <Suspense
            fallback={
              <div className="grid min-h-dvh place-items-center">
                <Spinner className="size-8" label="Loading battle arena" />
              </div>
            }
          >
            <BattlePage />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <HomePage />
      )}
    </QueryClientProvider>
  );
}
