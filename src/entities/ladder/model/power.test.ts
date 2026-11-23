import { describe, expect, it } from 'vitest';
import { statsAtLevel } from '@/entities/battle';
import { getSpecies } from '@/entities/pokemon';
import { computeStats } from '@/entities/progression';
import {
  collectionTeamPower,
  ownedPower,
  rivalStats,
  statPower,
  strongestTeam,
  teamPower,
} from './power';
import { makeOwned, makeSave } from '../testing/testSave';

const PIKACHU = 25;
const BULBASAUR = 1;
const MEWTWO = 150;

describe('team power', () => {
  it('sums the six battle stats per fighter and per team', () => {
    const a = { hp: 1, attack: 2, defense: 3, specialAttack: 4, specialDefense: 5, speed: 6 };
    expect(statPower(a)).toBe(21);
    expect(teamPower([a, a])).toBe(42);
    expect(teamPower([])).toBe(0);
  });

  it('rates rivals with the engine stats and owned Pokémon with computeStats', () => {
    const species = getSpecies(PIKACHU);
    if (!species) throw new Error('species data missing');
    expect(rivalStats({ speciesId: PIKACHU, level: 12 })).toEqual(statsAtLevel(species.stats, 12));
    expect(rivalStats({ speciesId: 99999, level: 12 })).toBeNull();
    const owned = makeOwned(PIKACHU, { level: 12, nature: 'brave' });
    expect(ownedPower(owned)).toBe(statPower(computeStats(species, owned)));
  });

  it('uses the same scale for both sides: a neutral IV 31 Pokémon equals a rival of its level', () => {
    const owned = makeOwned(BULBASAUR, { level: 20 });
    const rival = rivalStats({ speciesId: BULBASAUR, level: 20 });
    expect(rival && statPower(rival)).toBe(ownedPower(owned));
  });

  it('adds up a team from the collection and skips ids that are not owned', () => {
    const save = makeSave({
      owned: [makeOwned(PIKACHU, { level: 5 }), makeOwned(BULBASAUR, { level: 5 })],
    });
    const pika = save.collection[String(PIKACHU)];
    const bulba = save.collection[String(BULBASAUR)];
    if (!pika || !bulba) throw new Error('fixture');
    expect(collectionTeamPower(save.collection, [PIKACHU, BULBASAUR, MEWTWO])).toBe(
      ownedPower(pika) + ownedPower(bulba),
    );
  });

  it('auto-fills the strongest Pokémon first, up to the slot count', () => {
    const save = makeSave({
      owned: [
        makeOwned(PIKACHU, { level: 5 }),
        makeOwned(BULBASAUR, { level: 30 }),
        makeOwned(MEWTWO, { level: 2 }),
      ],
    });
    const team = strongestTeam(save.collection, 2);
    expect(team).toHaveLength(2);
    expect(team[0]).toBe(BULBASAUR);
    expect(strongestTeam(save.collection, 0)).toEqual([]);
    expect(strongestTeam(save.collection, 10)).toHaveLength(3);
    expect(strongestTeam(save.collection, 3)).toEqual(strongestTeam(save.collection, 3));
  });
});
