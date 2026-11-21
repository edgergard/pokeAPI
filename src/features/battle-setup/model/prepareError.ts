import { HttpError } from '@/shared/api/http';

/** A short, human message for a failed team preparation (raw `fetch` errors read as "Failed to fetch"). */
export function prepareErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    return error.status === 404
      ? 'One of these Pokémon couldn’t be found.'
      : 'PokeAPI didn’t answer just now.';
  }
  // fetch() rejects with a TypeError when offline or blocked; a failed chunk import does the same.
  if (error instanceof TypeError) return 'Couldn’t reach the network — check your connection.';
  return 'Couldn’t load the teams.';
}
