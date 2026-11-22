import { describe, expect, it } from 'vitest';
import { applyBattleResult } from '@/entities/progression';
import { createNewSave, registerGameEventReducer, type Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { claimQuest } from './claim';
import { questEventReducer } from './reducer';
import { refreshQuests } from './refresh';

// What SaveProvider does after merge; this file's module registry is isolated from other test files.
registerGameEventReducer(questEventReducer);

const now = new Date(2026, 10, 22, 12).getTime();

function hubSave(): Save {
  const save = createNewSave({ seed: 3, now: now - 1000, name: 'Ash' });
  return {
    ...save,
    trainer: { ...save.trainer, level: economy.trainer.unlocks.dailyQuests },
    collection: {
      '25': {
        speciesId: 25,
        level: 1,
        xp: 0,
        stars: 1,
        dupes: 0,
        ivs: { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
        nature: 'neutral',
        talents: [],
        obtainedAt: 0,
      },
    },
    team: [25],
  };
}

describe('battle → quest progress → claim', () => {
  it('folds battle events into every quest kind and lets a finished quest be claimed', () => {
    let save = refreshQuests(hubSave(), now);
    // Force a known quest set: one quest of every pool kind.
    save = {
      ...save,
      quests: {
        ...save.quests,
        active: economy.quests.pool.map((p) => ({
          id: p.id,
          progress: 0,
          target: p.target,
          day: '2026-11-22',
          claimed: false,
        })),
      },
    };
    const { save: after, summary } = applyBattleResult(save, {
      stage: 1,
      won: true,
      damageDealt: 180,
      teamIds: [25],
      now: now + 1000,
    });
    const progress = Object.fromEntries(after.quests.active.map((q) => [q.id, q.progress]));
    const levels = summary.pokemon.reduce((n, p) => n + p.levelsGained, 0);
    expect(progress).toEqual({
      'win-battles': 1,
      'open-capsules': 0,
      'deal-damage': 180,
      'clear-stage': 1,
      'level-up': Math.min(levels, 2),
    });

    const claimed = claimQuest(after, 'clear-stage', '2026-11-22');
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    // first-clear capsule + quest capsule
    expect(claimed.save.capsules.basic).toBe(2);
  });
});
