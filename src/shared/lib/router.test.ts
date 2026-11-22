import { describe, expect, it } from 'vitest';
import { href, legacyHashTarget } from './router';

describe('href', () => {
  it('builds trailing-slash paths', () => {
    expect(href('/battle')).toBe('/battle/');
    expect(href('/')).toBe('/');
  });

  it('appends encoded query params', () => {
    expect(href('/battle', { red: 't-1' })).toBe('/battle/?red=t-1');
    expect(href('/battle', { red: 'a b&c' })).toBe('/battle/?red=a+b%26c');
    expect(href('/battle', {})).toBe('/battle/');
  });

  it('round-trips params through URLSearchParams', () => {
    const url = new URL(
      href('/battle', { red: 'legacy-2026-11-20T19:55:33.096Z' }),
      'https://x.test',
    );
    expect(url.searchParams.get('red')).toBe('legacy-2026-11-20T19:55:33.096Z');
  });
});

describe('legacyHashTarget', () => {
  it.each([
    ['#/battle', '/battle/'],
    ['#/battle/', '/battle/'],
    ['#/battle?red=t-1', '/battle/?red=t-1'],
    [
      '#/battle?red=legacy-2026-11-20T19%3A55%3A33.096Z',
      '/battle/?red=legacy-2026-11-20T19%3A55%3A33.096Z',
    ],
    ['#/', '/'],
  ])('maps %j to %j', (hash, target) => expect(legacyHashTarget(hash)).toBe(target));

  it.each(['', '#', '#battle', '#/nope', '#/battlefield', '#main'])('ignores %j', (hash) =>
    expect(legacyHashTarget(hash)).toBeNull(),
  );
});
