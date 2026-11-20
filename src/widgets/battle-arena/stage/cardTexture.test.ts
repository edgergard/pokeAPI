import { describe, expect, it, vi } from 'vitest';
import { resolveArtwork } from './cardTexture';

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
