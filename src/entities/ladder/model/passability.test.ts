import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildTeam,
  loadMovesets,
  movesFor,
  simulateBattle,
  statsAtLevel,
  type MovesetData,
  type TeamMemberSpec,
} from '@/entities/battle';
import { rollCapsule } from '@/entities/capsule';
import { getSpecies, speciesOfRarity, type Species } from '@/entities/pokemon';
import {
  addTrainerXp,
  applyBattleResult,
  computeStats,
  learnedTalentBranches,
  levelCap,
  pokemonTalentPointsAt,
  POKEMON_TALENTS,
  talentModifiers,
  teamSlots,
} from '@/entities/progression';
import { createNewSave, type OwnedPokemon } from '@/entities/save';
import { economy, RARITIES, type Rarity } from '@/shared/config/economy';
import { hashSeed } from '@/shared/lib/rng';
import { makeOwned } from '../testing/testSave';
import { statPower } from './power';
import { rivalRarities, stageInfo, stageWinXp, type RivalMember } from './stages';

/**
 * Must #6: every ladder stage is winnable. For each stage we build the strongest team a dedicated
 * player can reach by then and fight the stage's rival with the real engine over several seeds.
 *
 * Assumptions (a dedicated, not a perfect, player):
 * - Stars grow 1 → `maxStars` evenly over the ladder (duplicates from capsules and quests);
 *   stage s has `1 + floor((maxStars − 1) × (s − 1) / (stages − 1))` stars.
 * - Pokémon are at the level cap those stars allow (replays give unlimited XP).
 * - Average IVs (15) and a neutral nature: no lucky rolls.
 * - Pokémon talents learned with every point the level gives, offense → defense → tempo.
 * - No trainer talents (conservative).
 * - Trainer level only from the intro win and one first clear of every earlier stage (no quests,
 *   no replays), so team slots are the fewest a player at that stage can have.
 * - Species: the best (highest stat power) of the rarities the stage's rival is drawn from, never
 *   legendary (0.2–2% odds; at a stage drawing only legendaries, the tier below).
 * - Lineup: the strongest Pokémon; when they lose, the player counter-picks from their
 *   `CANDIDATES` strongest (scouted on separate seeds, so the reported rate isn't fitted to them).
 *
 * Stage 1 is checked separately with the real first capsule of many new saves (Lv 1, rolled IVs and
 * nature). Rivals have IV 31 and the stage-1 rival is already at the lowest level (1), so a fresh
 * Lv 1 Pokémon wins its first try only ~38% of the time; a loss still pays XP, and with the Retry
 * the stage is won ~85% of the time — that is what the check asserts.
 *
 * Win rates per stage: `PASSABILITY_DEBUG=1 npx vitest run passability --silent=false`.
 */

const STAGES = economy.battle.ladderStages;
const SEEDS = 24;
const SCOUT_SEEDS = 8;
const FRESH_SAVES = 64;
const FRESH_SEEDS = 8;
/** Strongest Pokémon a player tries lineups from when the default team loses. */
const CANDIDATES = 10;
const MIN_WIN_RATE = 0.5;
const AVERAGE_IV = 15;
const TALENT_ORDER = ['offense', 'defense', 'tempo'].flatMap((branch) =>
  POKEMON_TALENTS.filter((t) => t.branch === branch)
    .sort((a, b) => a.tier - b.tier)
    .map((t) => t.id),
);

let movesets: MovesetData;
beforeAll(async () => {
  movesets = await loadMovesets();
});

function starsAt(stage: number): number {
  const max = economy.pokemon.maxStars;
  return 1 + Math.floor(((max - 1) * (stage - 1)) / (STAGES - 1));
}

/** Trainer level from the intro XP plus the first clear of stages 1..stage−1. */
function trainerLevelAt(stage: number): number {
  let save = createNewSave({ seed: 1, now: 0, name: 'Test' });
  save = addTrainerXp(save, economy.onboarding.introTrainerXp).save;
  for (let s = 1; s < stage; s++) save = addTrainerXp(save, stageWinXp(s).trainer).save;
  return save.trainer.level;
}

function playerRarities(stage: number): Rarity[] {
  const rarities = rivalRarities(stage).filter((r) => r !== 'legendary');
  if (rarities.length > 0) return rarities;
  return [RARITIES[RARITIES.indexOf('legendary') - 1] ?? 'epic'];
}

function owned(species: Species, level: number, stars: number): OwnedPokemon {
  const iv = AVERAGE_IV;
  const ivs = { hp: iv, attack: iv, defense: iv, specialAttack: iv, specialDefense: iv, speed: iv };
  const talents = TALENT_ORDER.slice(0, pokemonTalentPointsAt(level));
  return makeOwned(species.id, { level, stars, ivs, talents });
}

function playerMember(species: Species, pokemon: OwnedPokemon): TeamMemberSpec {
  const modifiers = talentModifiers(pokemon, []);
  return {
    species,
    level: pokemon.level,
    stats: computeStats(species, pokemon),
    badges: { stars: pokemon.stars, talentIcons: learnedTalentBranches(pokemon.talents) },
    critChanceBonus: modifiers.critChance,
    firstStrike: modifiers.firstStrike,
  };
}

function rivalMember(member: RivalMember): TeamMemberSpec {
  const species = getSpecies(member.speciesId);
  if (!species) throw new Error(`Unknown rival species ${member.speciesId}`);
  return {
    species,
    level: member.level,
    stats: statsAtLevel(species.stats, member.level),
    badges: { stars: member.stars, talentIcons: [] },
  };
}

/** Every Pokémon of the player's rarities at the given level and stars, strongest first. */
function roster(stage: number, level: number, stars: number): TeamMemberSpec[] {
  return playerRarities(stage)
    .flatMap((r) => speciesOfRarity(r))
    .filter((s) => movesFor(movesets, s.slug).length > 0)
    .map((s) => ({ member: playerMember(s, owned(s, level, stars)), power: 0 }))
    .map((x) => ({ ...x, power: statPower(x.member.stats) }))
    .sort((a, b) => b.power - a.power || a.member.species.id - b.member.species.id)
    .map((x) => x.member);
}

function combinations<T>(list: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  return list.flatMap((item, i) =>
    combinations(list.slice(i + 1), k - 1).map((rest) => [item, ...rest]),
  );
}

function winRate(stage: number, red: TeamMemberSpec[], seeds: readonly number[]): number {
  const info = stageInfo(stage);
  const size = Math.min(red.length, info.rival.length);
  const redTeam = buildTeam({
    side: 'red',
    trainerName: 'Player',
    members: red.slice(0, size),
    movesets,
  });
  const blueTeam = buildTeam({
    side: 'blue',
    trainerName: info.rivalName,
    members: info.rival.slice(0, size).map(rivalMember),
    movesets,
  });
  let wins = 0;
  for (const seed of seeds) {
    if (simulateBattle(redTeam, blueTeam, seed).result.winner === 'red') wins++;
  }
  return wins / seeds.length;
}

const seedsFor = (stage: number, kind: string, count: number) =>
  Array.from({ length: count }, (_, i) => hashSeed('passability', kind, stage, i));

/**
 * The team a dedicated player fields: the strongest `size`; when that loses, they look at the rival
 * and try every lineup of their `CANDIDATES` strongest (counter-picking types), picked on scouting
 * seeds. The returned rate is measured on separate seeds, so the pick isn't fitted to them.
 */
function bestWinRate(stage: number, size: number, level: number, stars: number) {
  const pool = roster(stage, level, stars);
  const fight = seedsFor(stage, 'fight', SEEDS);
  const strongest = pool.slice(0, size);
  const base = winRate(stage, strongest, fight);
  if (base >= MIN_WIN_RATE) return { rate: base, team: strongest };
  const scout = seedsFor(stage, 'scout', SCOUT_SEEDS);
  let best = { team: strongest, rate: -1 };
  for (const team of combinations(pool.slice(0, CANDIDATES), size)) {
    const rate = winRate(stage, team, scout);
    if (rate > best.rate) best = { team, rate };
  }
  return { rate: Math.max(base, winRate(stage, best.team, fight)), team: best.team };
}

describe('ladder passability', () => {
  it('a dedicated player wins every stage at least half the time', () => {
    const rates: Record<number, number> = {};
    for (let stage = 1; stage <= STAGES; stage++) {
      const stars = starsAt(stage);
      const level = Math.min(levelCap(stars), economy.pokemon.maxLevel);
      const slots = teamSlots(trainerLevelAt(stage));
      const { rate, team } = bestWinRate(stage, slots, level, stars);
      rates[stage] = rate;
      if (process.env.PASSABILITY_DEBUG) {
        const name = (id: number) => getSpecies(id)?.name ?? String(id);
        console.info(
          `stage ${stage} · Lv ${level} ★${stars} · ${team.map((m) => m.species.name).join(', ')} vs ${stageInfo(
            stage,
          )
            .rival.map((r) => `${name(r.speciesId)} Lv ${r.level}`)
            .join(', ')} → ${rate.toFixed(2)}`,
        );
      }
    }
    if (process.env.PASSABILITY_DEBUG) console.info('passability win rates', rates);
    const failing = Object.entries(rates).filter(([, rate]) => rate < MIN_WIN_RATE);
    expect(failing).toEqual([]);
  });

  it('stage 1 is fair for a fresh Lv 1 Pokémon from the first capsule', () => {
    // The real first capsule of many new saves (species, IVs and nature as rolled, Lv 1, ★1).
    const first: number[] = [];
    const withRetry: number[] = [];
    for (let k = 0; k < FRESH_SAVES; k++) {
      const created = createNewSave({
        seed: hashSeed('passability', 'fresh', k),
        now: 0,
        name: 'T',
      });
      const rolled = rollCapsule(
        { ...created, capsules: { ...created.capsules, basic: 1 } },
        'basic',
        0,
      );
      const id = rolled.result.speciesId;
      const species = getSpecies(id);
      const fresh = rolled.save.collection[String(id)];
      if (!species || !fresh) throw new Error(`The first capsule gave no Pokémon (save ${k})`);
      const p1 = winRate(1, [playerMember(species, fresh)], seedsFor(1, `fresh-${k}`, FRESH_SEEDS));
      // A loss still pays XP: the Retry fights with the Pokémon the loss levelled up.
      const lost = applyBattleResult(
        { ...rolled.save, team: [id] },
        { stage: 1, won: false, damageDealt: 0, teamIds: [id], now: 0 },
      );
      const after = lost.save.collection[String(id)] ?? fresh;
      const p2 = winRate(1, [playerMember(species, after)], seedsFor(1, `retry-${k}`, FRESH_SEEDS));
      first.push(p1);
      withRetry.push(p1 + (1 - p1) * p2);
    }
    const mean = (rates: number[]) => rates.reduce((a, b) => a + b, 0) / rates.length;
    if (process.env.PASSABILITY_DEBUG) {
      console.info('stage 1 fresh Lv 1: first try', mean(first), 'first or retry', mean(withRetry));
    }
    expect(mean(withRetry)).toBeGreaterThanOrEqual(MIN_WIN_RATE);
  });
});
