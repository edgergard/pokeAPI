import { describe, expect, it } from 'vitest';
import { animatedSpriteUrl, pickSpriteSource, spriteSrc } from './sprites';
import { spriteUrl } from './typeColors';

const base = { animated: true, motion: 'full', gifFailed: false, staticFailed: false } as const;

describe('animatedSpriteUrl', () => {
  it('points at the Showdown GIF for the id', () => {
    expect(animatedSpriteUrl(25)).toBe(
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/25.gif',
    );
  });
});

describe('pickSpriteSource', () => {
  it('plays the GIF with full motion', () => {
    expect(pickSpriteSource(base)).toBe('animated');
  });

  it('falls back to the static sprite when the GIF fails', () => {
    expect(pickSpriteSource({ ...base, gifFailed: true })).toBe('static');
  });

  it('shows the static sprite under reduced motion', () => {
    expect(pickSpriteSource({ ...base, motion: 'reduced' })).toBe('static');
  });

  it('shows the static sprite when animation is not wanted', () => {
    expect(pickSpriteSource({ ...base, animated: false })).toBe('static');
  });

  it('keeps the GIF when only the static sprite failed', () => {
    expect(pickSpriteSource({ ...base, staticFailed: true })).toBe('animated');
  });

  it('shows nothing when both fail', () => {
    expect(pickSpriteSource({ ...base, gifFailed: true, staticFailed: true })).toBe('none');
  });

  it('never falls back to the GIF under reduced motion', () => {
    expect(pickSpriteSource({ ...base, motion: 'reduced', staticFailed: true })).toBe('none');
  });
});

describe('spriteSrc', () => {
  it('maps each source to its URL', () => {
    expect(spriteSrc(6, 'animated')).toBe(animatedSpriteUrl(6));
    expect(spriteSrc(6, 'static')).toBe(spriteUrl(6));
    expect(spriteSrc(6, 'none')).toBeNull();
  });
});
