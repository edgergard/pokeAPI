import { describe, expect, it } from 'vitest';
import { HttpError } from '@/shared/api/http';
import { prepareErrorMessage } from './prepareError';

const OFFLINE = 'Couldn’t reach the network — check your connection.';
const GENERIC = 'Something went wrong preparing the battle.';

describe('prepareErrorMessage', () => {
  it.each([
    'Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'Load failed',
    'Failed to fetch dynamically imported module: http://x/movesets.js',
    'error loading dynamically imported module: http://x/movesets.js',
  ])('labels the fetch / chunk failure "%s" as a network problem', (message) => {
    expect(prepareErrorMessage(new TypeError(message), true)).toBe(OFFLINE);
  });

  it('asks for a reload when a lazy chunk is gone while online (stale tab after a redeploy)', () => {
    const error = new Error('Failed to load chunk /_next/static/chunks/abc.js from module 42');
    error.name = 'ChunkLoadError';
    expect(prepareErrorMessage(error, true)).toBe(
      'A new version of the site is available — reload the page.',
    );
    expect(prepareErrorMessage(error, false)).toBe(OFFLINE);
  });

  it('treats any failure while the browser is offline as a network problem', () => {
    expect(prepareErrorMessage(new Error('boom'), false)).toBe(OFFLINE);
  });

  it('does not blame the connection for an in-code TypeError', () => {
    expect(
      prepareErrorMessage(
        new TypeError('Cannot read properties of undefined (reading "stats")'),
        true,
      ),
    ).toBe(GENERIC);
  });

  it('distinguishes a missing Pokémon from a server error', () => {
    expect(prepareErrorMessage(new HttpError(404, 'Request failed: 404'), true)).toBe(
      'One of these Pokémon couldn’t be found.',
    );
    expect(prepareErrorMessage(new HttpError(503, 'Request failed: 503'), true)).toBe(
      'PokeAPI didn’t answer just now.',
    );
  });

  it('falls back to a generic message for anything else', () => {
    expect(prepareErrorMessage(new Error('boom'), true)).toBe(GENERIC);
    expect(prepareErrorMessage('nope', true)).toBe(GENERIC);
  });
});
