import { describe, expect, it } from 'vitest';
import { RARITY_LABEL } from '@/entities/capsule';
import { economy } from '@/shared/config/economy';
import {
  DONE_STAGE,
  FIRST_STAGE,
  cardAnnouncement,
  cardHeadline,
  firstCapsuleNote,
  nextStage,
  outcomeLabel,
  pityAfterReveal,
  pityFooterText,
  pityText,
  revealOrder,
  summaryAnnouncement,
  type RevealStage,
} from './reveal';
import { capsuleResult, craftResult } from './testResults';

// 133 Eevee, 25 Pikachu: names come from the baked species data.
describe('reveal order', () => {
  it('reveals the rarest card last and keeps roll order among equals', () => {
    const a = capsuleResult(1, { rarity: 'common', pullIndex: 0 });
    const b = capsuleResult(2, { rarity: 'epic', pullIndex: 1 });
    const c = capsuleResult(3, { rarity: 'common', pullIndex: 2 });
    const d = capsuleResult(4, { rarity: 'rare', pullIndex: 3 });
    expect(revealOrder([a, b, c, d])).toEqual([a, c, d, b]);
  });
});

describe('reveal stages', () => {
  const walk = (count: number, reduced: boolean) => {
    const seen: RevealStage[] = [FIRST_STAGE];
    let s: RevealStage = FIRST_STAGE;
    while (s.step !== 'done') {
      s = nextStage(s, count, reduced);
      seen.push(s);
    }
    return seen;
  };

  it('goes charge → flash → card per card, then done', () => {
    expect(walk(2, false)).toEqual([
      { step: 'reveal', index: 0, phase: 'charge' },
      { step: 'reveal', index: 0, phase: 'flash' },
      { step: 'reveal', index: 0, phase: 'card' },
      { step: 'reveal', index: 1, phase: 'charge' },
      { step: 'reveal', index: 1, phase: 'flash' },
      { step: 'reveal', index: 1, phase: 'card' },
      DONE_STAGE,
    ]);
  });

  it('skips the flash with reduced motion', () => {
    expect(walk(1, true)).toEqual([
      { step: 'reveal', index: 0, phase: 'charge' },
      { step: 'reveal', index: 0, phase: 'card' },
      DONE_STAGE,
    ]);
  });
});

describe('reveal copy', () => {
  it('announces each card as "Rarity: Name, outcome"', () => {
    expect(cardAnnouncement(capsuleResult(133, { rarity: 'rare' }))).toBe('Rare: Eevee, new');
    expect(cardHeadline(capsuleResult(25))).toBe('New! Pikachu joined your collection.');
  });

  it('labels outcomes New / ★ up / +N dust', () => {
    expect(outcomeLabel(capsuleResult(25))).toBe('New');
    expect(outcomeLabel(capsuleResult(25, { outcome: 'starUp', stars: 2 }))).toBe('★ up');
    expect(outcomeLabel(capsuleResult(25, { outcome: 'dust', dustGained: 25 }))).toBe('+25 dust');
    expect(
      outcomeLabel(capsuleResult(25, { outcome: 'dupe', stars: 2, dupes: 1, dupesForNextStar: 2 })),
    ).toBe('Dupe 1/2');
  });

  it('summarises a multi-open', () => {
    const results = [
      capsuleResult(1),
      capsuleResult(2, { outcome: 'starUp', stars: 2 }),
      capsuleResult(3, { outcome: 'dust', dustGained: 25 }),
    ];
    expect(summaryAnnouncement(results)).toBe('3 capsules opened: 1 new, 1 star up, +25 dust.');
  });
});

describe('pity copy', () => {
  it('ticks or resets', () => {
    const { opens } = economy.capsules.pity.great;
    expect(pityText('epic', 18)).toBe('Epic guaranteed within 18 opens');
    expect(pityText('rare', 1)).toBe('Rare guaranteed on the next open');
    expect(
      pityFooterText({ tier: 'great', rarity: 'epic', opens, count: 0, left: opens, reset: true }),
    ).toBe(`Pity reset · Epic within ${opens}`);
  });

  it('takes the pity after the last open of each tier and skips crafts', () => {
    const first = capsuleResult(1, {
      pity: { tier: 'basic', rarity: 'rare', opens: 10, count: 1, left: 9, reset: false },
    });
    const last = capsuleResult(2, {
      pity: { tier: 'basic', rarity: 'rare', opens: 10, count: 2, left: 8, reset: false },
    });
    expect(pityAfterReveal([first, last])).toEqual([last.pity]);
    expect(pityAfterReveal([craftResult(25)])).toEqual([]);
  });

  it('notes the first-capsule guarantee', () => {
    expect(firstCapsuleNote([capsuleResult(25, { firstCapsule: true })])).toBe(
      `First capsule · ${RARITY_LABEL[economy.capsules.firstCapsuleMinRarity]} or better guaranteed`,
    );
    expect(firstCapsuleNote([capsuleResult(25)])).toBeNull();
  });
});
