import { speciesOfRarity, type Species } from '@/entities/pokemon';
import { levelCap } from '@/entities/progression';
import { economy, type Rarity, type Reward } from '@/shared/config/economy';
import { createRng, hashSeed } from '@/shared/lib/rng';
import { RIVAL_FIRST_NAMES, RIVAL_LAST_NAMES } from './names';
import { rivalStats, teamPower, type StatBlock } from './power';

/** One rival fighter. Rivals are not owned: their stats come from `rivalStats` (IV 31, no nature). */
export type RivalMember = {
  readonly speciesId: number;
  readonly level: number;
  /** Shown as ★: the fewest stars whose level cap allows `level` (an owned Pokémon would need them). */
  readonly stars: number;
};

/** Everything the ladder and the battle preview show about one stage. Same for every player. */
export type StageInfo = {
  readonly stage: number;
  readonly rivalName: string;
  /** Lead first. */
  readonly rival: readonly RivalMember[];
  /** Rarities this stage's rival species were drawn from. */
  readonly rarities: readonly Rarity[];
  /** First-clear bonus (`economy.battle.firstClear`). */
  readonly firstClear: Reward;
  /** XP for a win, before trainer talents (the formula `applyBattleResult` uses). */
  readonly winXp: { readonly trainer: number; readonly pokemon: number };
  /** Rival team power ("Recommended power"). */
  readonly power: number;
};

const STAGES = economy.battle.ladderStages;

function assertStage(stage: number): void {
  if (!Number.isInteger(stage) || stage < 1 || stage > STAGES) {
    throw new RangeError(`Ladder stage must be an integer 1..${STAGES}, got ${stage}`);
  }
}

/** The last table entry whose `fromStage <= stage` (tables are sorted by `fromStage`, ascending). */
function lookup<T extends { fromStage: number }>(table: readonly T[], stage: number): T {
  let found: T | undefined;
  for (const entry of table) {
    if (entry.fromStage <= stage) found = entry;
  }
  if (!found) throw new RangeError(`No ladder table entry for stage ${stage}`);
  return found;
}

/** Rival team size at a stage (`economy.battle.rivalTeamSize`). */
export function rivalTeamSize(stage: number): number {
  assertStage(stage);
  return lookup(economy.battle.rivalTeamSize, stage).size;
}

/** Rarities rival species are drawn from at a stage (`economy.battle.rivalRarities`). */
export function rivalRarities(stage: number): readonly Rarity[] {
  assertStage(stage);
  return lookup(economy.battle.rivalRarities, stage).rarities;
}

/** Rival level at a stage: `start + perStage × (stage − 1)`, at most `economy.pokemon.maxLevel`. */
export function rivalLevel(stage: number): number {
  assertStage(stage);
  const { start, perStage } = economy.battle.rivalLevel;
  return Math.min(start + perStage * (stage - 1), economy.pokemon.maxLevel);
}

/** The fewest stars whose level cap reaches `level`. */
export function starsForLevel(level: number): number {
  for (let stars = 1; stars <= economy.pokemon.maxStars; stars++) {
    if (levelCap(stars) >= level) return stars;
  }
  return economy.pokemon.maxStars;
}

/** Win XP at a stage (trainer and per team member), before trainer talents. */
export function stageWinXp(stage: number): { trainer: number; pokemon: number } {
  assertStage(stage);
  const { trainerXp, pokemonXp } = economy.battle;
  return {
    trainer: trainerXp.base + trainerXp.perStage * stage,
    pokemon: pokemonXp.base + pokemonXp.perStage * stage,
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  const item = list[Math.floor(rng() * list.length)];
  if (item === undefined) throw new RangeError('Cannot pick from an empty list');
  return item;
}

/** Draws from the entries not in `taken`; the full list once every entry is taken. */
function pickFresh<T>(rng: () => number, list: readonly T[], taken: ReadonlySet<T>): T {
  const fresh = list.filter((item) => !taken.has(item));
  return pick(rng, fresh.length > 0 ? fresh : list);
}

const poolCache = new Map<Rarity, Species[]>();
const poolOf = (rarity: Rarity): Species[] => {
  let pool = poolCache.get(rarity);
  if (!pool) {
    pool = speciesOfRarity(rarity);
    poolCache.set(rarity, pool);
  }
  return pool;
};

/**
 * Generates the whole ladder, stage 1 → last. Each stage draws only from its own stream
 * `createRng(hashSeed('ladder', stage))`: the rival's first and last name (skipping names earlier
 * stages took), then per member a rarity (from the stage's rarities) and a species of that rarity
 * not already in the team. No other randomness: every player sees the same ladder. Not memoised
 * (tests compare it with `allStages`); use `stageInfo` / `allStages`.
 */
export function generateLadder(): StageInfo[] {
  const firstNames = new Set<string>();
  const lastNames = new Set<string>();
  return Array.from({ length: STAGES }, (_, i) => {
    const stage = i + 1;
    const rng = createRng(hashSeed('ladder', stage));
    const first = pickFresh<string>(rng, RIVAL_FIRST_NAMES, firstNames);
    const last = pickFresh<string>(rng, RIVAL_LAST_NAMES, lastNames);
    firstNames.add(first);
    lastNames.add(last);

    const rarities = rivalRarities(stage);
    const size = rivalTeamSize(stage);
    const level = rivalLevel(stage);
    const stars = starsForLevel(level);
    const used = new Set<number>();
    const rival: RivalMember[] = [];
    while (rival.length < size) {
      const rarity = pick(rng, rarities);
      const species = pick(
        rng,
        poolOf(rarity).filter(
          (s) => !used.has(s.id) && (stage > 1 || s.bst <= economy.battle.firstStageRivalMaxBst),
        ),
      );
      used.add(species.id);
      rival.push({ speciesId: species.id, level, stars });
    }

    const stats = rival.map(rivalStats).filter((s): s is StatBlock => s !== null);
    return {
      stage,
      rivalName: `${first} ${last}`,
      rival,
      rarities,
      firstClear: economy.battle.firstClear,
      winXp: stageWinXp(stage),
      power: teamPower(stats),
    };
  });
}

let ladder: StageInfo[] | null = null;

/** Every stage, 1 → `economy.battle.ladderStages` (generated once, then shared). */
export function allStages(): StageInfo[] {
  ladder ??= generateLadder();
  return [...ladder];
}

/** One ladder stage (1..`economy.battle.ladderStages`); throws a RangeError outside it. */
export function stageInfo(stage: number): StageInfo {
  assertStage(stage);
  ladder ??= generateLadder();
  const info = ladder[stage - 1];
  if (!info) throw new RangeError(`Ladder stage ${stage} is missing`);
  return info;
}
