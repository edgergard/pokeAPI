import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { economy } from '@/shared/config/economy';
import {
  craftPrice,
  dupesForNextStar,
  dustMissing,
  isTierUnlocked,
  pityStatus,
  speciesRarity,
  tierLockReason,
} from './helpers';
import { maxRarity, rarityRank } from './rarity';
import { testSave } from './testSave';

describe('capsule helpers', () => {
  it('reports pity progress as opens left until the guarantee', () => {
    const { opens, rarity } = economy.capsules.pity.great;
    expect(pityStatus(testSave(), 'great')).toEqual({
      tier: 'great',
      rarity,
      opens,
      count: 0,
      left: opens,
    });
    const two = testSave({ pity: { basic: 0, great: 2 } });
    expect(pityStatus(two, 'great').left).toBe(opens - 2);
    const last = testSave({ pity: { basic: 0, great: opens - 1 } });
    expect(pityStatus(last, 'great').left).toBe(1);
  });

  it('locks Great capsules below economy.trainer.unlocks.greatCapsules', () => {
    const level = economy.trainer.unlocks.greatCapsules;
    expect(isTierUnlocked(testSave({ trainer: { level: level - 1 } }), 'great')).toBe(false);
    expect(isTierUnlocked(testSave({ trainer: { level } }), 'great')).toBe(true);
    expect(isTierUnlocked(testSave(), 'basic')).toBe(true);
    expect(tierLockReason(testSave(), 'great')).toBe(
      `Great capsules unlock at Trainer Lv ${level}`,
    );
    expect(tierLockReason(testSave({ trainer: { level } }), 'great')).toBeNull();
  });

  it('prices crafts by rarity and computes the missing dust', () => {
    expect(craftPrice('epic')).toBe(economy.dust.craftPrice.epic);
    expect(dustMissing(testSave({ dust: 80 }), 120)).toBe(40);
    expect(dustMissing(testSave({ dust: 200 }), 120)).toBe(0);
    expect(speciesRarity(1)).toBe('common');
    expect(speciesRarity(999_999)).toBeUndefined();
  });

  it('reads the dupes the next star needs, 0 at max stars', () => {
    expect(dupesForNextStar(1)).toBe(economy.pokemon.dupesForNextStar[1]);
    expect(dupesForNextStar(economy.pokemon.maxStars)).toBe(0);
  });

  it('orders rarities as RARITIES', () => {
    expect(rarityRank('common')).toBe(0);
    expect(rarityRank('legendary')).toBe(4);
    expect(maxRarity('rare', 'uncommon')).toBe('rare');
    expect(maxRarity('rare', 'epic')).toBe('epic');
  });
});

describe('capsule code', () => {
  it('never uses Math.random (seeded RNG only)', () => {
    const roots = [
      'src/entities/capsule',
      'src/features/open-capsule',
      'src/widgets/capsule-reveal',
      'src/views/capsules',
    ];
    const files: string[] = [];
    const walk = (dir: string) => {
      let entries: string[] = [];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const name of entries) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path);
      }
    };
    roots.forEach(walk);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/Math\.random/);
    }
  });
});
