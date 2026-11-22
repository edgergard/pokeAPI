/**
 * Every game number lives here (CLAUDE.md: no magic numbers in features).
 * Starting values are assumptions to tune by play-testing; the orchestrator owns this file.
 */

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export const CAPSULE_TIERS = ['basic', 'great'] as const;
export type CapsuleTier = (typeof CAPSULE_TIERS)[number];

export const NATURE_MULTIPLIER = { up: 1.1, down: 0.9 } as const;
export const IV_MAX = 31;

export const economy = {
  pokemon: {
    maxLevel: 50,
    /** PokeAPI growth-rate XP totals are for level 100 curves; divide to fit a 1–50 game. */
    xpCurveDivisor: 20,
    /** Level cap per star count (index = stars, 0 unused: every owned Pokémon has ≥ 1 star). */
    levelCapByStars: [10, 10, 20, 30, 40, 50],
    maxStars: 5,
    /** Duplicates needed to go from N stars to N+1 (index = current stars). */
    dupesForNextStar: [0, 1, 2, 3, 4, 0],
    /** Bench Pokémon get this share of the XP the team earns. */
    benchXpShare: 0.25,
    /** One talent point every N levels (first at level N). */
    talentPointEveryLevels: 5,
  },

  trainer: {
    maxLevel: 30,
    /** XP needed to go from level L to L+1: base + perLevel × (L − 1). Linear by design. */
    xpToNext: { base: 200, perLevel: 100 },
    /** Team size by trainer level: the first entry whose level ≤ trainer level wins (sorted desc). */
    teamSlots: [
      { level: 10, slots: 4 },
      { level: 5, slots: 3 },
      { level: 3, slots: 2 },
      { level: 1, slots: 1 },
    ],
    unlocks: {
      dailyQuests: 2,
      greatCapsules: 8,
    },
    /** Trainer talent points: one per level from this level on. */
    talentPointsFromLevel: 2,
  },

  capsules: {
    /** Odds per tier, in percent; each row sums to 100. */
    odds: {
      basic: { common: 60, uncommon: 28, rare: 10, epic: 1.8, legendary: 0.2 },
      great: { common: 25, uncommon: 40, rare: 25, epic: 8, legendary: 2 },
    } satisfies Record<CapsuleTier, Record<Rarity, number>>,
    /** Guaranteed minimum rarity after N opens of a tier without it (counter resets when it drops). */
    pity: {
      basic: { rarity: 'rare' as Rarity, opens: 10 },
      great: { rarity: 'epic' as Rarity, opens: 20 },
    } satisfies Record<CapsuleTier, { rarity: Rarity; opens: number }>,
    /** The very first capsule ever opened rolls at least this rarity (onboarding). */
    firstCapsuleMinRarity: 'uncommon' as Rarity,
  },

  dust: {
    /** Dust from a duplicate that can't add a star any more (max stars) or past the next-star need. */
    fromDuplicate: { common: 5, uncommon: 10, rare: 25, epic: 60, legendary: 150 } satisfies Record<
      Rarity,
      number
    >,
    /** Craft (buy) one unowned species with dust. */
    craftPrice: {
      common: 40,
      uncommon: 120,
      rare: 300,
      epic: 800,
      legendary: 2000,
    } satisfies Record<Rarity, number>,
  },

  battle: {
    /** Trainer XP for a win: base + perStage × stage; a loss gives lossShare of it. */
    trainerXp: { base: 60, perStage: 12, lossShare: 0.25 },
    /** Pokémon XP for a win (per team member): base + perStage × stage; loss: lossShare. */
    pokemonXp: { base: 40, perStage: 10, lossShare: 0.25 },
    /** First clear of a ladder stage. */
    firstClear: { capsules: { basic: 1 }, dust: 20 },
    /** Replaying a cleared stage: a basic capsule every N wins. */
    replayCapsuleEveryWins: 3,
    /** The capsule a replay streak or the trainer capsuleChance talent gives. */
    bonusCapsuleReward: { capsules: { basic: 1 } } as { capsules: { basic: number } },
    /** Rival level at stage s: start + perStage × (s − 1). */
    rivalLevel: { start: 3, perStage: 2 },
    ladderStages: 25,
  },

  onboarding: {
    loanerLevel: 5,
    rivalLevel: 3,
    introReward: { capsules: { basic: 1 } },
  },

  quests: {
    dailyCount: 3,
    /** Unfinished daily quests stock up for at most N days. */
    maxStockDays: 3,
    /** Local hour when a new quest day starts. */
    refreshHour: 6,
    pool: [
      { id: 'win-battles', kind: 'battleWon', target: 3, reward: { capsules: { basic: 1 } } },
      { id: 'open-capsules', kind: 'capsuleOpened', target: 2, reward: { dust: 30 } },
      { id: 'deal-damage', kind: 'damageDealt', target: 500, reward: { dust: 20 } },
      { id: 'clear-stage', kind: 'stageCleared', target: 1, reward: { capsules: { basic: 1 } } },
      { id: 'level-up', kind: 'pokemonLeveled', target: 2, reward: { dust: 25 } },
    ],
    /** Trainer XP per finished quest. */
    trainerXp: 80,
  },

  save: {
    /** Show the "Back up your progress" banner after N days or N battles without an export. */
    backupReminder: { days: 7, battles: 10 },
  },
} as const;

export type QuestKind = (typeof economy.quests.pool)[number]['kind'];
export type Reward = { capsules?: Partial<Record<CapsuleTier, number>>; dust?: number };
