import { describe, expect, it } from 'vitest';
import { HttpError } from '@/shared/api/http';
import { prepareErrorMessage } from './prepareError';

describe('prepareErrorMessage', () => {
  it('explains a network failure instead of echoing "Failed to fetch"', () => {
    expect(prepareErrorMessage(new TypeError('Failed to fetch'))).toBe('Couldn’t reach the network — check your connection.');
  });

  it('distinguishes a missing Pokémon from a server error', () => {
    expect(prepareErrorMessage(new HttpError(404, 'Request failed: 404'))).toBe('One of these Pokémon couldn’t be found.');
    expect(prepareErrorMessage(new HttpError(503, 'Request failed: 503'))).toBe('PokeAPI didn’t answer just now.');
  });

  it('falls back to a generic message for anything else', () => {
    expect(prepareErrorMessage(new Error('boom'))).toBe('Couldn’t load the teams.');
    expect(prepareErrorMessage('nope')).toBe('Couldn’t load the teams.');
  });
});
