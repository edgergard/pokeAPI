import { gsap } from '@/shared/lib/gsap';
import type { StageDirector, Tier } from './director';

const DEFAULTS: Record<keyof StageDirector, number> = {
  intro: 2,
  dealIn: 0.9,
  anticipate: 0.4,
  lunge: 0.5,
  impact: 0.6,
  knockOut: 1.2,
  victory: 2,
};

/** Short-tier lunge + impact together last ~0.7 s against ~1.1 s for the full tier. */
const SHORT_FACTOR = 0.64;

/** A director whose beats are empty timelines of fixed length: for tests and the no-WebGL fallback. */
export function createNullDirector(durations: Partial<Record<keyof StageDirector, number>> = {}): StageDirector {
  const d = { ...DEFAULTS, ...durations };
  const beat = (seconds: number) => gsap.timeline().to({}, { duration: seconds });
  const tiered = (seconds: number, tier: Tier) => beat(tier === 'short' ? seconds * SHORT_FACTOR : seconds);
  return {
    intro: () => beat(d.intro),
    dealIn: () => beat(d.dealIn),
    anticipate: (_a, _m, tier) => tiered(d.anticipate, tier),
    lunge: (_a, _t, _m, tier) => tiered(d.lunge, tier),
    impact: (_t, _r, _i, tier) => tiered(d.impact, tier),
    knockOut: () => beat(d.knockOut),
    victory: () => beat(d.victory),
  };
}
