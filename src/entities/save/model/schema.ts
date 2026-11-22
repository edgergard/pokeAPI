import { z } from 'zod';
import { CAPSULE_TIERS, IV_MAX, RARITIES } from '@/shared/config/economy';

/**
 * The whole player save (contract, owned by the orchestrator — streams escalate to change it).
 * One versioned document; stream 1-save persists it in IndexedDB and migrates older versions.
 */
export const SAVE_VERSION = 2;

export const ONBOARDING_STEPS = ['hero', 'dealt', 'fought', 'capsule', 'done'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const NATURES = ['neutral', 'brave', 'modest', 'bold', 'calm', 'timid', 'adamant'] as const;
export type Nature = (typeof NATURES)[number];

const tierCounts = z.object(
  Object.fromEntries(CAPSULE_TIERS.map((t) => [t, z.number().int().min(0)])) as Record<
    (typeof CAPSULE_TIERS)[number],
    z.ZodNumber
  >,
);

const ivs = z.object({
  hp: z.number().int().min(0).max(IV_MAX),
  attack: z.number().int().min(0).max(IV_MAX),
  defense: z.number().int().min(0).max(IV_MAX),
  specialAttack: z.number().int().min(0).max(IV_MAX),
  specialDefense: z.number().int().min(0).max(IV_MAX),
  speed: z.number().int().min(0).max(IV_MAX),
});

export const ownedPokemonSchema = z.object({
  speciesId: z.number().int().positive(),
  level: z.number().int().min(1),
  /** XP towards the next level (not total). */
  xp: z.number().int().min(0),
  stars: z.number().int().min(1),
  /** Duplicates collected towards the next star. */
  dupes: z.number().int().min(0),
  ivs,
  nature: z.enum(NATURES),
  /** Learned talent node ids (see entities/progression talents). */
  talents: z.array(z.string()),
  obtainedAt: z.number().int(),
});
export type OwnedPokemon = z.infer<typeof ownedPokemonSchema>;

export const questSchema = z.object({
  /** economy.quests.pool id */
  id: z.string(),
  progress: z.number().min(0),
  target: z.number().positive(),
  /** Quest day (YYYY-MM-DD, local, shifted by economy.quests.refreshHour) it was issued on. */
  day: z.string(),
  claimed: z.boolean(),
});
export type Quest = z.infer<typeof questSchema>;

export const saveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  meta: z.object({
    /** Root seed for every roll in this save (capsules, rivals, battles). */
    seed: z.number().int(),
    /** Counters mixed into the seed so every roll is reproducible and reload-safe. */
    pullIndex: z.number().int().min(0),
    battleIndex: z.number().int().min(0),
    /** Max wall-clock time seen (ms); guards daily quests against the clock moving back. */
    maxSeenTime: z.number().int().min(0),
    createdAt: z.number().int(),
    lastExportAt: z.number().int().nullable(),
    battlesSinceExport: z.number().int().min(0),
    /** True when this save came from a v1 roster migration. */
    migratedFromV1: z.boolean(),
  }),
  onboarding: z.object({
    step: z.enum(ONBOARDING_STEPS),
    /** Species of the loaner card dealt in onboarding (not owned). */
    loanerSpeciesId: z.number().int().positive().nullable(),
    rivalSpeciesId: z.number().int().positive().nullable(),
  }),
  trainer: z.object({
    name: z.string().min(1).max(24),
    level: z.number().int().min(1),
    /** XP towards the next level. */
    xp: z.number().int().min(0),
    talentPoints: z.number().int().min(0),
    talents: z.array(z.string()),
  }),
  /** speciesId (as string) → owned Pokémon. */
  collection: z.record(z.string(), ownedPokemonSchema),
  /** speciesIds in slot order; length ≤ unlocked team slots. */
  team: z.array(z.number().int().positive()).max(4),
  capsules: tierCounts,
  /** Opens of each tier since that tier's pity rarity (or better) last dropped. */
  pity: tierCounts,
  /** Total capsules ever opened (first-capsule guarantee). */
  capsulesOpened: z.number().int().min(0),
  dust: z.number().int().min(0),
  ladder: z.object({
    /** Highest stage cleared (0 = none). */
    cleared: z.number().int().min(0),
    /** Wins on already-cleared stages since the last replay capsule. */
    replayWins: z.number().int().min(0),
  }),
  quests: z.object({
    active: z.array(questSchema),
    /** Last quest day that was issued. */
    lastIssuedDay: z.string().nullable(),
  }),
});
export type Save = z.infer<typeof saveSchema>;

export const RARITY_LIST = RARITIES;

/** A fresh save. `now` and `seed` are injected so tests stay deterministic. */
export function createNewSave({
  seed,
  now,
  name,
}: {
  seed: number;
  now: number;
  name: string;
}): Save {
  return {
    version: SAVE_VERSION,
    meta: {
      seed,
      pullIndex: 0,
      battleIndex: 0,
      maxSeenTime: now,
      createdAt: now,
      lastExportAt: null,
      battlesSinceExport: 0,
      migratedFromV1: false,
    },
    onboarding: { step: 'hero', loanerSpeciesId: null, rivalSpeciesId: null },
    trainer: { name, level: 1, xp: 0, talentPoints: 0, talents: [] },
    collection: {},
    team: [],
    capsules: { basic: 0, great: 0 },
    pity: { basic: 0, great: 0 },
    capsulesOpened: 0,
    dust: 0,
    ladder: { cleared: 0, replayWins: 0 },
    quests: { active: [], lastIssuedDay: null },
  };
}
