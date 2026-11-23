import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardBadgeText, cardTalentText, loadImage, resolveArtwork } from './cardTexture';

describe('resolveArtwork', () => {
  it('resolveArtwork returns null on missing url or failed load', async () => {
    expect(await resolveArtwork(null, vi.fn())).toBeNull();
    expect(await resolveArtwork('x.png', () => Promise.reject(new Error('404')))).toBeNull();
  });

  it('does not call the loader without a url and passes the url through otherwise', async () => {
    const img = {} as HTMLImageElement;
    const load = vi.fn(() => Promise.resolve(img));
    expect(await resolveArtwork(null, load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect(await resolveArtwork('a.png', load)).toBe(img);
    expect(load).toHaveBeenCalledWith('a.png');
  });
});

describe('loadImage', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('gives up on a stalled artwork request after the timeout, so the card gets its placeholder', async () => {
    vi.useFakeTimers();
    class StalledImage {
      crossOrigin = '';
      decoding = '';
      src = '';
      decode() {
        return new Promise<void>(() => {});
      }
    }
    vi.stubGlobal('Image', StalledImage);
    const pending = resolveArtwork('https://example.test/stalled.png', loadImage);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await pending).toBeNull();
  });

  it('still uses an image that arrived when a late timer fires (main thread was stalled)', async () => {
    vi.useFakeTimers();
    class ArrivedImage {
      crossOrigin = '';
      decoding = '';
      src = '';
      complete = true;
      naturalWidth = 475;
      decode() {
        return new Promise<void>(() => {});
      }
    }
    vi.stubGlobal('Image', ArrivedImage);
    const pending = loadImage('https://example.test/arrived.png');
    await vi.advanceTimersByTimeAsync(4000);
    expect((await pending).naturalWidth).toBe(475);
  });
});

describe('card footer badges', () => {
  it('shows the level and the star count only when there are stars', () => {
    expect(cardBadgeText({ level: 5, badges: { stars: 3, talentIcons: [] } })).toBe('LV 5 · ★3');
    expect(cardBadgeText({ level: 50, badges: { stars: 0, talentIcons: [] } })).toBe('LV 50');
  });

  it('tallies learned talents per branch in a fixed order', () => {
    expect(cardTalentText(['tempo', 'offense', 'offense'])).toBe('OFF 2 · TMP 1');
    expect(cardTalentText([])).toBe('');
  });
});
