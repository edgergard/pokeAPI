import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { createShards } from './shards';

/** Sum of the triangle areas of a geometry's position attribute. */
function area(geometry: BufferGeometry): number {
  const pos = geometry.getAttribute('position');
  let sum = 0;
  for (let i = 0; i + 2 < pos.count; i += 3) {
    const abx = pos.getX(i + 1) - pos.getX(i), aby = pos.getY(i + 1) - pos.getY(i), abz = pos.getZ(i + 1) - pos.getZ(i);
    const acx = pos.getX(i + 2) - pos.getX(i), acy = pos.getY(i + 2) - pos.getY(i), acz = pos.getZ(i + 2) - pos.getZ(i);
    sum += Math.hypot(aby * acz - abz * acy, abz * acx - abx * acz, abx * acy - aby * acx) / 2;
  }
  return sum;
}

describe('createShards', () => {
  it('createShards is deterministic and covers the card area', () => {
    const a = createShards(2.5, 3.5, 24, 9), b = createShards(2.5, 3.5, 24, 9);
    expect(a).toHaveLength(24);
    expect(a.map(area)).toEqual(b.map(area));
    expect(a.reduce((s, g) => s + area(g), 0)).toBeCloseTo(2.5 * 3.5, 1);
  });

  it('different seeds give different fractures', () => {
    expect(createShards(2.5, 3.5, 24, 9).map(area)).not.toEqual(createShards(2.5, 3.5, 24, 10).map(area));
  });

  it('honours the requested count, stays inside the card and has no empty shards', () => {
    for (const count of [1, 7, 24, 40]) {
      const shards = createShards(2.5, 3.5, count, 3);
      expect(shards).toHaveLength(count);
      expect(shards.reduce((s, g) => s + area(g), 0)).toBeCloseTo(2.5 * 3.5, 6);
      for (const g of shards) {
        g.computeBoundingBox();
        const box = g.boundingBox!;
        expect(box.min.x).toBeGreaterThanOrEqual(-1.25 - 1e-6);
        expect(box.max.x).toBeLessThanOrEqual(1.25 + 1e-6);
        expect(box.min.y).toBeGreaterThanOrEqual(-1.75 - 1e-6);
        expect(box.max.y).toBeLessThanOrEqual(1.75 + 1e-6);
        expect(area(g)).toBeGreaterThan(0.01);
      }
    }
  });

  it('winds every triangle counter-clockwise (front faces towards +z) and maps UVs to the card', () => {
    for (const g of createShards(2.5, 3.5, 24, 5)) {
      const pos = g.getAttribute('position');
      const uv = g.getAttribute('uv');
      for (let i = 0; i < pos.count; i += 3) {
        const cross = (pos.getX(i + 1) - pos.getX(i)) * (pos.getY(i + 2) - pos.getY(i))
          - (pos.getY(i + 1) - pos.getY(i)) * (pos.getX(i + 2) - pos.getX(i));
        expect(cross).toBeGreaterThan(0);
      }
      for (let i = 0; i < uv.count; i++) {
        expect(uv.getX(i)).toBeCloseTo(pos.getX(i) / 2.5 + 0.5);
        expect(uv.getY(i)).toBeCloseTo(pos.getY(i) / 3.5 + 0.5);
      }
    }
  });
});
