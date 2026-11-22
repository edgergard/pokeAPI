import { describe, expect, it } from 'vitest';
import { slotPosition } from './layout';

describe('slotPosition', () => {
  it('places actives facing each other and benches behind their side', () => {
    const ra = slotPosition('red', 'active', 16 / 9),
      ba = slotPosition('blue', 'active', 16 / 9);
    expect(ra.x).toBeLessThan(0);
    expect(ba.x).toBeGreaterThan(0);
    expect(ra.x).toBeCloseTo(-ba.x);
    expect(Math.abs(slotPosition('red', { bench: 0 }, 16 / 9).x)).toBeGreaterThan(Math.abs(ra.x));
  });

  it('pulls benches closer on portrait', () => {
    expect(Math.abs(slotPosition('red', { bench: 0 }, 9 / 16).x)).toBeLessThan(
      Math.abs(slotPosition('red', { bench: 0 }, 16 / 9).x),
    );
  });

  it('keeps every bench slot distinct and behind the active line', () => {
    for (const aspect of [16 / 9, 1, 9 / 16]) {
      const active = slotPosition('blue', 'active', aspect);
      const bench = [0, 1, 2].map((i) => slotPosition('blue', { bench: i }, aspect));
      for (const b of bench) expect(b.z).toBeLessThan(active.z);
      expect(new Set(bench.map((b) => `${b.x.toFixed(3)},${b.z.toFixed(3)}`)).size).toBe(3);
    }
  });

  it('returns a fresh vector each call (safe to mutate)', () => {
    const a = slotPosition('red', 'active', 1);
    a.x = 99;
    expect(slotPosition('red', 'active', 1).x).not.toBe(99);
  });
});
