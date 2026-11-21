import { describe, expect, it } from 'vitest';
import { makeParticles } from './ambient';

describe('makeParticles', () => {
  it('is deterministic for a seed', () => {
    expect(makeParticles(24)).toEqual(makeParticles(24));
    expect(makeParticles(24, 1)).not.toEqual(makeParticles(24, 2));
  });

  it('keeps every particle inside the viewport and within its motion budget', () => {
    const particles = makeParticles(28);
    expect(particles).toHaveLength(28);
    for (const p of particles) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.duration).toBeGreaterThanOrEqual(16);
      expect(p.duration).toBeLessThanOrEqual(30);
      expect(p.delay).toBeLessThanOrEqual(0);
      expect(-p.delay).toBeLessThanOrEqual(p.duration);
      expect(p.opacity).toBeGreaterThan(0);
      expect(p.opacity).toBeLessThanOrEqual(0.6);
    }
  });

  it('tints by side', () => {
    for (const p of makeParticles(40)) {
      if (p.tint === 'red') expect(p.x).toBeLessThan(50);
      if (p.tint === 'blue') expect(p.x).toBeGreaterThanOrEqual(50);
    }
  });
});
