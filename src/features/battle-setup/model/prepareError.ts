import { HttpError } from '@/shared/api/http';

/** Messages browsers use when fetch() or a dynamic import() fails at the network level. */
const NETWORK_FAILURE = /failed to fetch|networkerror|load failed|error loading dynamically imported module/i;

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
  if (isNetworkFailure(error, online)) return 'Couldn’t reach the network — check your connection.';
  if (error instanceof HttpError) {
    return error.status === 404
      ? 'One of these Pokémon couldn’t be found.'
      : 'PokeAPI didn’t answer just now.';
  }
  return 'Something went wrong preparing the battle.';
}
