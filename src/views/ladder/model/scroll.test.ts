import { describe, expect, it } from 'vitest';
import { centeredScrollTop } from './scroll';

/** 25 nodes of 60px in a 384px-high scroll area whose top sits at y = 200 (scrolled to the top). */
const at = (index: number, scrollTop = 0) => ({
  listTop: 200,
  nodeTop: 200 + index * 60 - scrollTop,
  nodeHeight: 56,
  scrollTop,
  clientHeight: 384,
  scrollHeight: 25 * 60,
});

describe('centeredScrollTop', () => {
  it('centres a node further down the path', () => {
    // Stage 12 (index 11): its top is 660px into the list; centred = 660 - (384 - 56) / 2.
    expect(centeredScrollTop(at(11))).toBe(496);
  });

  it('gives the same answer whatever the list is already scrolled to', () => {
    expect(centeredScrollTop(at(11, 300))).toBe(centeredScrollTop(at(11)));
  });

  it('clamps to the top and to the end of the list', () => {
    expect(centeredScrollTop(at(0))).toBe(0);
    expect(centeredScrollTop(at(24))).toBe(25 * 60 - 384);
    expect(centeredScrollTop({ ...at(3), scrollHeight: 300 })).toBe(0);
  });
});
