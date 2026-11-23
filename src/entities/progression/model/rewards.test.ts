import { describe, expect, it } from 'vitest';
import { effectiveReward, grantReward } from './rewards';
import { makeSave } from './testSaves';

describe('grantReward', () => {
  it('adds capsules per tier and dust', () => {
    const save = makeSave();
    const next = grantReward(save, { capsules: { basic: 2, great: 1 }, dust: 30 });
    expect(next.capsules).toEqual({ basic: 2, great: 1 });
    expect(next.dust).toBe(30);
    expect(save.capsules).toEqual({ basic: 0, great: 0 });
    expect(save.dust).toBe(0);
  });

  it('applies the trainer dust bonus, floored', () => {
    const save = makeSave({ trainer: { level: 3, talents: ['dust-collector'] } });
    expect(grantReward(save, { dust: 20 }).dust).toBe(22);
    expect(grantReward(save, { dust: 25 }).dust).toBe(27); // 27.5 → 27
    expect(effectiveReward(save, { dust: 25, capsules: { basic: 1 } })).toEqual({
      capsules: { basic: 1, great: 0 },
      dust: 27,
    });
  });

  it('returns the same save for an empty reward', () => {
    const save = makeSave();
    expect(grantReward(save, {})).toBe(save);
  });
});
