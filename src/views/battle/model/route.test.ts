import { describe, expect, it } from 'vitest';
import { makeSave } from '@/entities/ladder/testing/testSave';
import { economy } from '@/shared/config/economy';
import { parseStage, resolveBattleRoute } from './route';

const STAGES = economy.battle.ladderStages;

describe('battle route', () => {
  it('parses ?stage as 1..ladderStages only', () => {
    expect(parseStage('1')).toBe(1);
    expect(parseStage(String(STAGES))).toBe(STAGES);
    for (const bad of [
      null,
      '',
      '0',
      String(STAGES + 1),
      '1.5',
      '-1',
      '2e1',
      ' 3',
      'abc',
      '0003x',
    ]) {
      expect(parseStage(bad)).toBeNull();
    }
  });

  it('opens stages up to ladder.cleared + 1', () => {
    const save = makeSave({ ladder: { cleared: 6 } });
    expect(resolveBattleRoute(save, '7')).toEqual({ kind: 'stage', stage: 7 });
    expect(resolveBattleRoute(save, '3')).toEqual({ kind: 'stage', stage: 3 });
  });

  it('sends a locked stage to the ladder with ?locked=N', () => {
    const save = makeSave({ ladder: { cleared: 6 } });
    expect(resolveBattleRoute(save, '8')).toEqual({ kind: 'redirect', to: '/ladder/?locked=8' });
  });

  it('sends an invalid stage to the ladder with ?invalid=1, a missing one to the ladder', () => {
    const save = makeSave();
    expect(resolveBattleRoute(save, '99')).toEqual({ kind: 'redirect', to: '/ladder/?invalid=1' });
    expect(resolveBattleRoute(save, 'abc')).toEqual({ kind: 'redirect', to: '/ladder/?invalid=1' });
    expect(resolveBattleRoute(save, null)).toEqual({ kind: 'redirect', to: '/ladder/' });
    // The old ?red= setup link has no stage.
    expect(resolveBattleRoute(save, null).kind).toBe('redirect');
  });

  it('sends every deep link home before onboarding is done', () => {
    for (const step of ['hero', 'dealt', 'fought', 'capsule'] as const) {
      const save = makeSave({
        onboarding: { step, loanerSpeciesId: 25, rivalSpeciesId: 19 },
      });
      expect(resolveBattleRoute(save, '1')).toEqual({ kind: 'redirect', to: '/' });
    }
  });

  it('opens the intro only at dealt (with both species), fought or capsule', () => {
    const at = (step: 'hero' | 'dealt' | 'fought' | 'capsule' | 'done', ids = true) =>
      makeSave({
        onboarding: {
          step,
          loanerSpeciesId: ids ? 25 : null,
          rivalSpeciesId: ids ? 19 : null,
        },
      });
    expect(resolveBattleRoute(at('dealt'), 'intro')).toEqual({ kind: 'intro' });
    expect(resolveBattleRoute(at('fought'), 'intro')).toEqual({ kind: 'intro' });
    expect(resolveBattleRoute(at('capsule'), 'intro')).toEqual({ kind: 'intro' });
    expect(resolveBattleRoute(at('dealt', false), 'intro')).toEqual({ kind: 'redirect', to: '/' });
    expect(resolveBattleRoute(at('hero'), 'intro')).toEqual({ kind: 'redirect', to: '/' });
    expect(resolveBattleRoute(at('done'), 'intro')).toEqual({ kind: 'redirect', to: '/' });
  });
});
