import { describe, expect, it } from 'vitest';
import { href, parseHash } from './router';

describe('parseHash', () => {
  it.each([
    ['', '/'],
    ['#/', '/'],
    ['#/battle', '/battle'],
    ['#/nope', '/'],
    ['#battle', '/'],
  ])('parseHash(%j) = %s', (h, r) => expect(parseHash(h)).toBe(r));

  it('href builds hash links', () => {
    expect(href('/battle')).toBe('#/battle');
    expect(href('/')).toBe('#/');
  });
});
