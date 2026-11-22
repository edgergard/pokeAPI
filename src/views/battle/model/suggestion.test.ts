import { describe, expect, it } from 'vitest';
import { makeOwned, makeSave } from '@/entities/ladder/testing/testSave';
import { lossSuggestion, questLabel, resultPhrase, trainerLabel } from './suggestion';

describe('trainer label', () => {
  it('does not repeat "Trainer" for a default name', () => {
    expect(trainerLabel('Trainer 2311')).toBe('Trainer 2311');
    expect(trainerLabel('Rowan')).toBe('Trainer Rowan');
    expect(trainerLabel('Trainerella')).toBe('Trainer Trainerella');
  });
});

describe('loss suggestion', () => {
  it('suggests the strongest bench Pokémon above the weakest team member', () => {
    const save = makeSave({
      owned: [
        makeOwned(25, { level: 6 }),
        makeOwned(1, { level: 12 }),
        makeOwned(4, { level: 9 }),
        makeOwned(7, { level: 3 }),
      ],
      team: [25],
    });
    expect(lossSuggestion(save)).toEqual({
      kind: 'bench',
      speciesId: 1,
      name: 'Bulbasaur',
      level: 12,
    });
  });

  it('else points at unspent talent points of a team member', () => {
    const save = makeSave({
      owned: [makeOwned(25, { level: 10 }), makeOwned(1, { level: 4 })],
      team: [25],
    });
    expect(lossSuggestion(save)).toEqual({
      kind: 'talent',
      speciesId: 25,
      name: 'Pikachu',
      points: 2,
    });
  });

  it('has nothing to say when neither applies', () => {
    const save = makeSave({ owned: [makeOwned(25, { level: 4 })], team: [25] });
    expect(lossSuggestion(save)).toBeNull();
    expect(lossSuggestion(makeSave({ owned: [makeOwned(25)], team: [] }))).toBeNull();
  });
});

describe('result copy', () => {
  it('announces the result in one phrase', () => {
    expect(resultPhrase({ won: true, capsules: 1, trainerLevel: null })).toBe(
      'Victory. 1 capsule earned.',
    );
    expect(resultPhrase({ won: true, capsules: 2, trainerLevel: 3 })).toBe(
      'Victory. 2 capsules earned. Trainer Lv 3.',
    );
    expect(resultPhrase({ won: true, capsules: 0, trainerLevel: null })).toBe('Victory.');
    expect(resultPhrase({ won: false, capsules: 0, trainerLevel: null })).toBe(
      'Defeated. Try a stronger lineup.',
    );
    expect(resultPhrase(null)).toBe('');
  });

  it('names quests by kind and target', () => {
    expect(questLabel('battleWon', 3)).toBe('Win 3 battles');
    expect(questLabel('stageCleared', 1)).toBe('Clear 1 ladder stage');
    expect(questLabel('damageDealt', 500)).toBe('Deal 500 damage');
    expect(questLabel('capsuleOpened', 2)).toBe('Open 2 capsules');
    expect(questLabel('pokemonLeveled', 2)).toBe('Level up Pokémon 2 times');
  });
});
