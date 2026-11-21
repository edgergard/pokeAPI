import { describe, expect, it } from 'vitest';
import { href, parseHash, parseLocation } from './router';

describe('parseHash', () => {
  it.each([
    ['', '/'],
    ['#/', '/'],
    ['#/battle', '/battle'],
    ['#/nope', '/'],
    ['#battle', '/'],
    ['#/battle?red=t-1', '/battle'],
    ['#/?x=1', '/'],
    ['#/battlefield', '/'],
  ])('parseHash(%j) = %s', (h, r) => expect(parseHash(h)).toBe(r));

  it('href builds hash links', () => {
    expect(href('/battle')).toBe('#/battle');
    expect(href('/')).toBe('#/');
  });

  it('href appends query params', () => {
    expect(href('/battle', { red: 't-1' })).toBe('#/battle?red=t-1');
    expect(href('/battle', { red: 'a b&c' })).toBe('#/battle?red=a+b%26c');
    expect(href('/battle', {})).toBe('#/battle');
  });
});

describe('parseLocation', () => {
  it('returns the route and its params', () => {
    const { route, params } = parseLocation('#/battle?red=t-1');
    expect(route).toBe('/battle');
    expect(params.get('red')).toBe('t-1');
  });

  it('round-trips href params', () => {
    expect(parseLocation(href('/battle', { red: 'a b&c' })).params.get('red')).toBe('a b&c');
  });

  it('has empty params without a query', () => {
    expect(parseLocation('#/battle').params.get('red')).toBeNull();
    expect(parseLocation('').route).toBe('/');
  });
});
