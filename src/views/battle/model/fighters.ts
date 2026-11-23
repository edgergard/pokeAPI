import {
  buildTeam,
  findIntroSeed,
  IntroSeedError,
  movesFor,
  statsAtLevel,
  type BattleTeam,
  type MovesetData,
  type TeamMemberSpec,
} from '@/entities/battle';
import { stageInfo, type RivalMember } from '@/entities/ladder';
import { getSpecies, speciesOfRarity, type Species } from '@/entities/pokemon';
import { computeStats, learnedTalentBranches, talentModifiers } from '@/entities/progression';
import type { Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { createRng, hashSeed } from '@/shared/lib/rng';

/** A side before moves are attached: fighter specs plus the species ids behind them. */
export type Lineup = { members: TeamMemberSpec[]; ids: number[] };

/**
 * The player's fighters from the save: stats via `computeStats` (level, IVs, nature, talents),
 * talent modifiers (own talents + trainer talents) folded into `critChanceBonus` / `firstStrike`,
 * badges from stars and learned talent branches. Ids that aren't owned or known are skipped.
 */
export function playerLineup(
  save: Pick<Save, 'collection' | 'trainer'>,
  ids: readonly number[],
): Lineup {
  const members: TeamMemberSpec[] = [];
  const kept: number[] = [];
  for (const id of ids) {
    const species = getSpecies(id);
    const owned = save.collection[String(id)];
    if (!species || !owned || kept.includes(id)) continue;
    const modifiers = talentModifiers(owned, save.trainer.talents);
    members.push({
      species,
      level: owned.level,
      stats: computeStats(species, owned),
      badges: { stars: owned.stars, talentIcons: learnedTalentBranches(owned.talents) },
      critChanceBonus: modifiers.critChance,
      firstStrike: modifiers.firstStrike,
    });
    kept.push(id);
  }
  return { members, ids: kept };
}

/** A rival fighter: not owned, so engine stats (`statsAtLevel`: IV 31, no nature, no talents). */
export function rivalMember(member: RivalMember): TeamMemberSpec | null {
  const species = getSpecies(member.speciesId);
  if (!species) return null;
  return {
    species,
    level: member.level,
    stats: statsAtLevel(species.stats, member.level),
    badges: { stars: member.stars, talentIcons: [] },
  };
}

export type StageLineups = {
  red: Lineup;
  blue: Lineup;
  /** Fighters per side. The engine needs both teams the same size (`assertTeamSizes`). */
  size: number;
  /** The rival brings more (or fewer) than fight: both sides field their first `size`. */
  trimmed: boolean;
  rivalName: string;
};

/**
 * Both sides of a ladder battle. The engine only pits equal teams (N×N), so a battle is
 * k×k with k = min(your team, the stage's rival team): each side fields its first k.
 */
export function stageLineups(
  save: Pick<Save, 'collection' | 'trainer' | 'team'>,
  stage: number,
): StageLineups {
  const info = stageInfo(stage);
  const player = playerLineup(save, save.team);
  const rival = info.rival.flatMap((m) => {
    const spec = rivalMember(m);
    return spec ? [{ spec, id: m.speciesId }] : [];
  });
  const size = Math.min(player.members.length, rival.length);
  return {
    red: { members: player.members.slice(0, size), ids: player.ids.slice(0, size) },
    blue: {
      members: rival.slice(0, size).map((r) => r.spec),
      ids: rival.slice(0, size).map((r) => r.id),
    },
    size,
    trimmed: size > 0 && (player.members.length !== size || rival.length !== size),
    rivalName: info.rivalName,
  };
}

/** Both teams of a ladder battle, moves attached. */
export function buildStageTeams(
  lineups: StageLineups,
  trainerName: string,
  movesets: MovesetData,
): { red: BattleTeam; blue: BattleTeam } {
  return {
    red: buildTeam({ side: 'red', trainerName, members: lineups.red.members, movesets }),
    blue: buildTeam({
      side: 'blue',
      trainerName: lineups.rivalName,
      members: lineups.blue.members,
      movesets,
    }),
  };
}

/** Seed of the save's next battle, fixed when it starts (Replay plays the same seed). */
export const battleSeed = (save: Pick<Save, 'meta'>) =>
  hashSeed(save.meta.seed, 'battle', save.meta.battleIndex);

/* ---------- Onboarding intro ---------- */

/** How many deterministic rival re-picks the intro tries when the dealt rival can't be beaten. */
export const RIVAL_PICK_LIMIT = 32;

/** Trainer name of the intro rival's side (the HUD label). */
export const INTRO_RIVAL_NAME = 'Rival';

/** An intro fighter: engine stats at a fixed level, ★1, no talents (as on Home's deal step). */
export function introMember(species: Species, level: number): TeamMemberSpec {
  return {
    species,
    level,
    stats: statsAtLevel(species.stats, level),
    badges: { stars: 1, talentIcons: [] },
  };
}

export type IntroSetup = {
  red: BattleTeam;
  blue: BattleTeam;
  seed: number;
  /** The rival that fights; differs from `onboarding.rivalSpeciesId` after a re-pick. */
  rivalId: number;
};

/**
 * The scripted onboarding battle: loaner (`economy.onboarding.loanerLevel`) vs the dealt rival
 * (`economy.onboarding.rivalLevel`), seeded by `findIntroSeed` so the loaner always wins. When no
 * seed wins (`IntroSeedError`) the rival is re-picked deterministically: commons with moves and a
 * BST no higher than the loaner's (in `speciesOfRarity` order), candidate k drawn by
 * `createRng(hashSeed(save.meta.seed, 'rival', k))`, k = 0, 1, … < RIVAL_PICK_LIMIT.
 * Null when the dealt species are unknown or no rival works.
 */
export function setupIntro(
  save: Pick<Save, 'onboarding' | 'trainer' | 'meta'>,
  movesets: MovesetData,
): IntroSetup | null {
  const { loanerSpeciesId, rivalSpeciesId } = save.onboarding;
  const loaner = loanerSpeciesId === null ? undefined : getSpecies(loanerSpeciesId);
  const dealtRival = rivalSpeciesId === null ? undefined : getSpecies(rivalSpeciesId);
  if (!loaner || !dealtRival) return null;

  const red = buildTeam({
    side: 'red',
    trainerName: save.trainer.name,
    members: [introMember(loaner, economy.onboarding.loanerLevel)],
    movesets,
  });
  const attempt = (rival: Species): IntroSetup | null => {
    const blue = buildTeam({
      side: 'blue',
      trainerName: INTRO_RIVAL_NAME,
      members: [introMember(rival, economy.onboarding.rivalLevel)],
      movesets,
    });
    try {
      return { red, blue, seed: findIntroSeed(red, blue), rivalId: rival.id };
    } catch (error) {
      if (error instanceof IntroSeedError) return null;
      throw error;
    }
  };

  const dealt = attempt(dealtRival);
  if (dealt) return dealt;

  const candidates = speciesOfRarity('common').filter(
    (s) => movesFor(movesets, s.slug).length > 0 && s.bst <= loaner.bst,
  );
  if (candidates.length === 0) return null;
  for (let k = 0; k < RIVAL_PICK_LIMIT; k++) {
    const roll = createRng(hashSeed(save.meta.seed, 'rival', k))();
    const candidate = candidates[Math.floor(roll * candidates.length)];
    const setup = candidate && attempt(candidate);
    if (setup) return setup;
  }
  return null;
}
