import { describe, expect, it } from 'vitest';
import type { MoveType } from '@/entities/battle';
import { Points, Scene, Vector3 } from 'three';
import { FX_SECONDS, FxPool, fxFamily } from './fx';

describe('fxFamily', () => {
  it.each([
    ['fire', 'fire'],
    ['dragon', 'fire'],
    ['water', 'water'],
    ['ice', 'water'],
    ['electric', 'electric'],
    ['grass', 'nature'],
    ['bug', 'nature'],
    ['psychic', 'mystic'],
    ['fairy', 'mystic'],
    ['ghost', 'mystic'],
    ['fighting', 'impact'],
    ['normal', 'impact'],
    ['rock', 'impact'],
    ['ground', 'impact'],
    ['steel', 'impact'],
    ['typeless', 'impact'],
    ['poison', 'toxic'],
    ['dark', 'toxic'],
    ['flying', 'air'],
  ])('fxFamily(%s) = %s', (t, f) => expect(fxFamily(t as MoveType)).toBe(f));
});

describe('FxPool', () => {
  const points = (scene: Scene) => scene.children.filter((c): c is Points => c instanceof Points);

  it('borrows an emitter only while a shot is in flight and returns it at the end', () => {
    const scene = new Scene();
    const pool = new FxPool(scene);
    const shot = pool.shot('fire', new Vector3(-2, 2, 0), new Vector3(2, 2, 0), '#ff6a3d', 'full');
    expect(points(scene).some((p) => p.visible)).toBe(false);
    shot.progress = 0.3;
    expect(points(scene).filter((p) => p.visible)).toHaveLength(1);
    shot.progress = 1;
    expect(points(scene).some((p) => p.visible)).toBe(false);
    pool.dispose();
    expect(points(scene)).toHaveLength(0);
  });

  it('allocates no scene objects per hit and steals the oldest emitter when all are busy', () => {
    const scene = new Scene();
    const pool = new FxPool(scene);
    const before = scene.children.length;
    const shots = Array.from({ length: 5 }, () =>
      pool.shot('water', new Vector3(), new Vector3(1, 0, 0), '#4a90e2', 'short'),
    );
    for (const s of shots) s.progress = 0.5;
    expect(scene.children.length).toBe(before);
    expect(points(scene).filter((p) => p.visible).length).toBeLessThanOrEqual(before);
    for (const s of shots) s.progress = 1;
    expect(points(scene).some((p) => p.visible)).toBe(false);
  });

  it('play() runs travel then burst for the tier length', () => {
    const pool = new FxPool(new Scene());
    const tl = pool.play('electric', new Vector3(), new Vector3(1, 0, 0), '#f5c518', 'full');
    expect(tl.duration()).toBeCloseTo(FX_SECONDS.full.travel + FX_SECONDS.full.burst);
    tl.kill();
  });
});
