import {
  RARITY_LABEL,
  rarityRank,
  type CapsuleResult,
  type PityAfter,
  type RevealResult,
} from '@/entities/capsule';
import { getSpecies } from '@/entities/pokemon';
import { economy, type CapsuleTier, type Rarity } from '@/shared/config/economy';
import { DUR } from '@/shared/lib/motion';

/* ---------- Order ---------- */

/** Reveal order: rarity ascending (stable), so the rarest card always comes last. */
export function revealOrder<T extends RevealResult>(results: readonly T[]): T[] {
  return results
    .map((result, i) => ({ result, i }))
    .sort((a, b) => rarityRank(a.result.rarity) - rarityRank(b.result.rarity) || a.i - b.i)
    .map(({ result }) => result);
}

/* ---------- Stages ---------- */

/** charge: the capsule shakes · flash: rarity colour bursts · card: the card is face up. */
export type RevealPhase = 'charge' | 'flash' | 'card';
export type RevealStage = { step: 'reveal'; index: number; phase: RevealPhase } | { step: 'done' };

export const FIRST_STAGE: RevealStage = { step: 'reveal', index: 0, phase: 'charge' };
export const DONE_STAGE: RevealStage = { step: 'done' };

/** Reduced motion skips the shake and the flash: the capsule crossfades into the card. */
export function nextStage(stage: RevealStage, count: number, reduced: boolean): RevealStage {
  if (stage.step === 'done') return stage;
  if (stage.phase === 'charge') return { ...stage, phase: reduced ? 'card' : 'flash' };
  if (stage.phase === 'flash') return { ...stage, phase: 'card' };
  return stage.index + 1 < count
    ? { step: 'reveal', index: stage.index + 1, phase: 'charge' }
    : DONE_STAGE;
}

/** How long each stage lasts before `nextStage` (ms). UI motion timings, not game numbers. */
export const REVEAL_MS = {
  charge: DUR.xl + DUR.sm, // shake
  flash: DUR.md,
  /** Card on screen before the next one (multi) or the result (single). */
  hold: DUR.xl,
  /** The rarest (last) card of a multi-open stays a little longer. */
  holdLast: DUR.xxl + DUR.md,
  reducedCharge: DUR.md,
} as const;

export function stageDuration(stage: RevealStage, count: number, reduced: boolean): number {
  if (stage.step === 'done') return 0;
  switch (stage.phase) {
    case 'charge':
      return reduced ? REVEAL_MS.reducedCharge : REVEAL_MS.charge;
    case 'flash':
      return REVEAL_MS.flash;
    case 'card':
      return count > 1 && stage.index === count - 1 ? REVEAL_MS.holdLast : REVEAL_MS.hold;
  }
}

/* ---------- Copy ---------- */

export function speciesName(speciesId: number): string {
  return getSpecies(speciesId)?.name ?? `#${speciesId}`;
}

/** Short badge: New / ★ up / +N dust / Dupe 1/2. */
export function outcomeLabel(result: RevealResult): string {
  switch (result.outcome) {
    case 'new':
      return 'New';
    case 'starUp':
      return '★ up';
    case 'dust':
      return `+${result.dustGained} dust`;
    case 'dupe':
      return `Dupe ${result.dupes}/${result.dupesForNextStar}`;
  }
}

/** Spoken outcome for the live region. */
function outcomeSpoken(result: RevealResult): string {
  switch (result.outcome) {
    case 'new':
      return 'new';
    case 'starUp':
      return `star up, now ${result.stars} stars`;
    case 'dust':
      return `duplicate at max stars, plus ${result.dustGained} dust`;
    case 'dupe':
      return `duplicate, ${result.dupes} of ${result.dupesForNextStar} towards ${result.stars + 1} stars`;
  }
}

/** "Rare: Eevee, new" — announced when a card flips. */
export function cardAnnouncement(result: RevealResult): string {
  return `${RARITY_LABEL[result.rarity]}: ${speciesName(result.speciesId)}, ${outcomeSpoken(result)}`;
}

/** The big line next to a single card once it is revealed. */
export function cardHeadline(result: RevealResult): string {
  const name = speciesName(result.speciesId);
  switch (result.outcome) {
    case 'new':
      return `New! ${name} joined your collection.`;
    case 'starUp':
      return `★ up! ${name} reached ${result.stars} stars.`;
    case 'dust':
      return `${name} is at max stars: +${result.dustGained} dust.`;
    case 'dupe':
      return `${name} duplicate: ${result.dupes} of ${result.dupesForNextStar} towards ${result.stars + 1} stars.`;
  }
}

export type RevealTotals = { cards: number; fresh: number; starUps: number; dust: number };

export function revealTotals(results: readonly RevealResult[]): RevealTotals {
  return {
    cards: results.length,
    fresh: results.filter((r) => r.outcome === 'new').length,
    starUps: results.filter((r) => r.outcome === 'starUp').length,
    dust: results.reduce((sum, r) => sum + r.dustGained, 0),
  };
}

/** "5 capsules opened: 2 new, 1 star up, +25 dust." */
export function summaryAnnouncement(results: readonly RevealResult[]): string {
  const t = revealTotals(results);
  const parts = [
    t.fresh > 0 && `${t.fresh} new`,
    t.starUps > 0 && `${t.starUps} star up`,
    t.dust > 0 && `+${t.dust} dust`,
  ].filter(Boolean);
  const head = `${t.cards} ${t.cards === 1 ? 'capsule' : 'capsules'} opened`;
  return parts.length ? `${head}: ${parts.join(', ')}.` : `${head}.`;
}

/* ---------- Pity ---------- */

/** "Epic guaranteed within 18 opens" (or "on the next open"). */
export function pityText(rarity: Rarity, left: number): string {
  const label = RARITY_LABEL[rarity];
  return left <= 1
    ? `${label} guaranteed on the next open`
    : `${label} guaranteed within ${left} opens`;
}

/** Footer line after a reveal: "Pity reset · Epic within 20" or "Rare guaranteed within 9 opens". */
export function pityFooterText(pity: PityAfter): string {
  return pity.reset
    ? `Pity reset · ${RARITY_LABEL[pity.rarity]} within ${pity.opens}`
    : pityText(pity.rarity, pity.left);
}

/** The pity of each tier after the last open of that tier, in roll order. */
export function pityAfterReveal(results: readonly RevealResult[]): PityAfter[] {
  const byTier = new Map<CapsuleTier, PityAfter>();
  for (const r of results) if (r.kind === 'capsule') byTier.set(r.tier, r.pity);
  return [...byTier.values()];
}

/** "First capsule · Uncommon or better guaranteed" when the first capsule ever was among the results. */
export function firstCapsuleNote(results: readonly RevealResult[]): string | null {
  const first = results.some((r): r is CapsuleResult => r.kind === 'capsule' && r.firstCapsule);
  return first
    ? `First capsule · ${RARITY_LABEL[economy.capsules.firstCapsuleMinRarity]} or better guaranteed`
    : null;
}
