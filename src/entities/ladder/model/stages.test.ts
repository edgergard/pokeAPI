import { describe, expect, it } from 'vitest';
import { statsAtLevel } from '@/entities/battle';
import { getSpecies } from '@/entities/pokemon';
import { levelCap } from '@/entities/progression';
import { economy } from '@/shared/config/economy';
import { RIVAL_FIRST_NAMES, RIVAL_LAST_NAMES } from './names';
import { statPower } from './power';
import {
  allStages,
  generateLadder,
  rivalLevel,
  rivalRarities,
  rivalTeamSize,
  stageInfo,
  stageWinXp,
  starsForLevel,
} from './stages';

const STAGES = economy.battle.ladderStages;

/** Canon trainer names (protagonists, rivals, gym leaders, champions, professors, villains). */
const CANON = new Set(
  `Ash Misty Brock Gary Red Blue Green Leaf Ethan Lyra Kris Silver May Brendan Wally Dawn Lucas Barry
  Hilbert Hilda Cheren Bianca Nate Rosa Hugh Calem Serena Shauna Tierno Trevor Elio Selene Hau
  Gladion Lillie Victor Gloria Hop Marnie Bede Florian Juliana Nemona Arven Penny Kieran Carmine Oak
  Elm Birch Rowan Juniper Sycamore Kukui Burnet Magnolia Sonia Sada Turo Willow Laventon Cynthia
  Lance Steven Wallace Alder Iris Diantha Leon Geeta Giovanni Surge Erika Koga Janine Sabrina Blaine
  Falkner Bugsy Whitney Morty Chuck Jasmine Pryce Clair Roxanne Brawly Wattson Flannery Norman
  Winona Tate Liza Juan Roark Gardenia Maylene Wake Fantina Byron Candice Volkner Cilan Chili Cress
  Lenora Burgh Elesa Clay Skyla Brycen Drayden Marlon Viola Grant Korrina Ramos Clemont Valerie
  Olympia Wulfric Milo Nessa Kabu Bea Allister Opal Gordie Melony Piers Raihan Katy Brassius Iono
  Kofu Larry Ryme Tulip Grusha Archie Maxie Cyrus Ghetsis Lysandre Guzma Lusamine Rose Jessie James
  Tracey Max Bonnie Goh Chloe Liko Roy Friede Lorelei Bruno Agatha Karen Will Sidney Phoebe Glacia
  Drake Aaron Bertha Flint Lucian Shauntal Grimsley Caitlin Marshal Malva Siebold Wikstrom Drasna
  Hala Olivia Acerola Kahili Molayne Rika Poppy Hassel`
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => name.toLowerCase()),
);

describe('ladder stages', () => {
  it(`has ${STAGES} stages, numbered 1 → ${STAGES}`, () => {
    const stages = allStages();
    expect(stages).toHaveLength(STAGES);
    expect(stages.map((s) => s.stage)).toEqual(Array.from({ length: STAGES }, (_, i) => i + 1));
  });

  it('is deterministic: a fresh generation equals the shared ladder, on every call', () => {
    const fresh = generateLadder();
    expect(fresh).toEqual(generateLadder());
    expect(fresh).toEqual(allStages());
    for (let stage = 1; stage <= STAGES; stage++) {
      expect(stageInfo(stage)).toEqual(fresh[stage - 1]);
      expect(stageInfo(stage)).toBe(stageInfo(stage));
    }
  });

  it('never repeats a rival first or last name across the ladder', () => {
    const names = allStages().map((s) => s.rivalName.split(' '));
    expect(new Set(names.map(([first]) => first)).size).toBe(STAGES);
    expect(new Set(names.map(([, last]) => last)).size).toBe(STAGES);
  });

  it('grows the rival team 1 → 4 without ever shrinking', () => {
    let previous = 0;
    for (const s of allStages()) {
      expect(s.rival.length).toBeGreaterThanOrEqual(1);
      expect(s.rival.length).toBeLessThanOrEqual(4);
      expect(s.rival.length).toBeGreaterThanOrEqual(previous);
      expect(s.rival.length).toBe(rivalTeamSize(s.stage));
      previous = s.rival.length;
    }
    expect(stageInfo(1).rival).toHaveLength(1);
    expect(stageInfo(STAGES).rival).toHaveLength(4);
  });

  it('follows economy.battle.rivalTeamSize (last entry whose fromStage <= stage)', () => {
    for (const entry of economy.battle.rivalTeamSize) {
      expect(rivalTeamSize(entry.fromStage)).toBe(entry.size);
    }
  });

  it('sets rival levels from economy.battle.rivalLevel, clamped to the max level', () => {
    const { start, perStage } = economy.battle.rivalLevel;
    for (const s of allStages()) {
      const expected = Math.min(start + perStage * (s.stage - 1), economy.pokemon.maxLevel);
      expect(rivalLevel(s.stage)).toBe(expected);
      for (const m of s.rival) expect(m.level).toBe(expected);
    }
  });

  it('gives rivals the fewest stars whose level cap reaches their level', () => {
    for (const s of allStages()) {
      for (const m of s.rival) {
        expect(levelCap(m.stars)).toBeGreaterThanOrEqual(m.level);
        if (m.stars > 1) expect(levelCap(m.stars - 1)).toBeLessThan(m.level);
      }
    }
    expect(starsForLevel(1)).toBe(1);
  });

  it('draws species only from the stage rarities, with no duplicates in a team', () => {
    for (const s of allStages()) {
      const allowed = rivalRarities(s.stage);
      expect(s.rarities).toEqual(allowed);
      const ids = s.rival.map((m) => m.speciesId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        const species = getSpecies(id);
        expect(species).toBeDefined();
        expect(allowed).toContain(species?.rarity);
      }
    }
  });

  it('keeps epic and legendary rivals for late stages only', () => {
    const firstLate = economy.battle.rivalRarities.find((e) =>
      e.rarities.some((r) => r === 'epic' || r === 'legendary'),
    );
    expect(firstLate).toBeDefined();
    for (const s of allStages()) {
      if (s.stage >= (firstLate?.fromStage ?? 0)) continue;
      for (const m of s.rival)
        expect(['epic', 'legendary']).not.toContain(getSpecies(m.speciesId)?.rarity);
    }
    for (const m of stageInfo(1).rival) expect(getSpecies(m.speciesId)?.rarity).toBe('common');
  });

  it('names every rival with an original first and last name', () => {
    for (const name of [...RIVAL_FIRST_NAMES, ...RIVAL_LAST_NAMES]) {
      expect(CANON.has(name.toLowerCase())).toBe(false);
    }
    for (const s of allStages()) {
      expect(s.rivalName.trim()).not.toBe('');
      const [first, last, ...rest] = s.rivalName.split(' ');
      expect(rest).toEqual([]);
      expect(RIVAL_FIRST_NAMES).toContain(first);
      expect(RIVAL_LAST_NAMES).toContain(last);
      expect(CANON.has((first ?? '').toLowerCase())).toBe(false);
      expect(CANON.has((last ?? '').toLowerCase())).toBe(false);
    }
  });

  it('previews the first-clear reward and the win XP', () => {
    for (const s of allStages()) {
      expect(s.firstClear).toEqual(economy.battle.firstClear);
      const { trainerXp, pokemonXp } = economy.battle;
      expect(s.winXp).toEqual({
        trainer: trainerXp.base + trainerXp.perStage * s.stage,
        pokemon: pokemonXp.base + pokemonXp.perStage * s.stage,
      });
      expect(stageWinXp(s.stage)).toEqual(s.winXp);
    }
  });

  it('rates the rival with the engine stats (IV 31, no nature)', () => {
    for (const s of allStages()) {
      const expected = s.rival.reduce((sum, m) => {
        const species = getSpecies(m.speciesId);
        return species ? sum + statPower(statsAtLevel(species.stats, m.level)) : sum;
      }, 0);
      expect(s.power).toBe(expected);
      expect(s.power).toBeGreaterThan(0);
    }
  });

  it('throws a RangeError outside 1..ladderStages', () => {
    for (const bad of [0, -1, STAGES + 1, 1.5, Number.NaN]) {
      expect(() => stageInfo(bad)).toThrow(RangeError);
    }
  });
});
