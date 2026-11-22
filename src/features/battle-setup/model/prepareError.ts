import { HttpError } from '@/shared/api/http';
import { isChunkLoadError } from '@/shared/lib/chunkError';

/** Messages browsers use when fetch() or a dynamic import() fails at the network level. */
const NETWORK_FAILURE =
  /failed to fetch|networkerror|load failed|error loading dynamically imported module/i;

const isNetworkFailure = (error: unknown, online: boolean) =>
  !online || (error instanceof TypeError && NETWORK_FAILURE.test(error.message));

/**
 * A short, human message for a failed team preparation. Only a real fetch / chunk failure (or an
 * offline browser) is blamed on the connection; an in-code TypeError gets the generic copy.
 */
export function prepareErrorMessage(
  error: unknown,
  online: boolean = typeof navigator === 'undefined' || navigator.onLine !== false,
): string {
  // Online, yet Next's chunk loader can't find a chunk: the site was redeployed under this tab, and only a reload
  // brings it back. (A browser-level "dynamically imported module" TypeError stays a network problem below.)
  if (
    online &&
    error instanceof Error &&
    error.name === 'ChunkLoadError' &&
    isChunkLoadError(error)
  )
    return 'A new version of the site is available — reload the page.';
  if (isNetworkFailure(error, online)) return 'Couldn’t reach the network — check your connection.';
  if (error instanceof HttpError) {
    return error.status === 404
      ? 'One of these Pokémon couldn’t be found.'
      : 'PokeAPI didn’t answer just now.';
  }
  return 'Something went wrong preparing the battle.';
}
