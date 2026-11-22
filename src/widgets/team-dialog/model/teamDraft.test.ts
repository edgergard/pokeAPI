import { describe, expect, it } from 'vitest';
import { makeOwned, makeSave } from '@/entities/ladder/testing/testSave';
import {
  addToDraft,
  initialDraft,
  removeAt,
  rosterRows,
  sameTeam,
  swapAnnouncement,
  swapSlots,
} from './teamDraft';

describe('team draft', () => {
  const save = makeSave({ owned: [makeOwned(25), makeOwned(1, { level: 7 }), makeOwned(4)] });

  it('starts from the saved team: owned, unique, at most the open slots', () => {
    expect(initialDraft([25, 999, 25, 1, 4], save.collection, 2)).toEqual([25, 1]);
    expect(initialDraft([], save.collection, 2)).toEqual([]);
  });

  it('swaps and removes slots', () => {
    expect(swapSlots([25, 1, 4], 0, 2)).toEqual([4, 1, 25]);
    expect(swapSlots([25, 1], 0, 5)).toEqual([25, 1]);
    expect(removeAt([25, 1, 4], 1)).toEqual([25, 4]);
  });

  it('adds to the first empty slot or a selected one, never twice, never past the slots', () => {
    expect(addToDraft([25], 1, 2)).toEqual({ ok: true, draft: [25, 1], slot: 1 });
    expect(addToDraft([25, 1], 4, 2)).toEqual({ ok: false, reason: 'full' });
    expect(addToDraft([25, 1], 4, 2, 0)).toEqual({ ok: true, draft: [4, 1], slot: 0 });
    expect(addToDraft([25], 25, 2)).toEqual({ ok: false, reason: 'inTeam' });
  });

  it('lists the roster by level or name, filtered by name', () => {
    expect(
      rosterRows(save.collection, { filter: '', sort: 'level' }).map((r) => r.species.id),
    ).toEqual([1, 4, 25]);
    expect(
      rosterRows(save.collection, { filter: '', sort: 'name' }).map((r) => r.species.name),
    ).toEqual(['Bulbasaur', 'Charmander', 'Pikachu']);
    expect(rosterRows(save.collection, { filter: ' CHAR ', sort: 'level' })).toHaveLength(1);
  });

  it('announces a swap like the team showcase', () => {
    expect(swapAnnouncement([25, 1], 0, 1, 3)).toBe(
      'Pikachu moved to slot 2 of 3. Bulbasaur is now in slot 1.',
    );
    expect(sameTeam([1, 2], [1, 2])).toBe(true);
    expect(sameTeam([1, 2], [2, 1])).toBe(false);
  });
});
