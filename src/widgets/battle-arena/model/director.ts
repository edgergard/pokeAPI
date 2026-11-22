import type { Effectiveness, Move, Side } from '@/entities/battle';
import type { gsap } from '@/shared/lib/gsap';

export type Tier = 'full' | 'short';

type Timeline = ReturnType<typeof gsap.timeline>;

export type ImpactInfo = { damage: number; effectiveness: Effectiveness; critical: boolean };

/** The stage the choreographer drives: each beat returns a GSAP timeline the choreographer places. */
export interface StageDirector {
  intro(): Timeline;
  dealIn(fighterId: string): Timeline;
  anticipate(attackerId: string, move: Move, tier: Tier): Timeline;
  lunge(attackerId: string, targetId: string, move: Move, tier: Tier): Timeline;
  impact(
    targetId: string,
    result: 'hit' | 'miss' | 'noEffect',
    info: ImpactInfo | null,
    tier: Tier,
  ): Timeline;
  knockOut(fighterId: string): Timeline;
  victory(winner: Side): Timeline;
}
