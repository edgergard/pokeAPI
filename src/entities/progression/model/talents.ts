/**
 * Talent definitions (contract shape; content filled in by stream 1-progression).
 * Pokémon talents: 3 branches × 4 tiers (design.md creature). Trainer talents: ~15 nodes that change rules.
 */
export type TalentBranch = 'offense' | 'defense' | 'tempo';

/** What a talent does, as data the battle engine and progression code interpret. */
export type TalentEffect =
  | {
      kind: 'statPercent';
      stat: 'hp' | 'attack' | 'defense' | 'specialAttack' | 'specialDefense' | 'speed';
      percent: number;
    }
  | { kind: 'critChance'; percent: number }
  | { kind: 'firstStrike' }
  | { kind: 'xpPercent'; percent: number }
  | { kind: 'dustPercent'; percent: number }
  | { kind: 'benchXpPercent'; percent: number }
  | { kind: 'capsuleChance'; percent: number };

export type PokemonTalent = {
  id: string;
  branch: TalentBranch;
  /** 1–4; tier N needs tier N−1 of the same branch. */
  tier: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  effects: TalentEffect[];
};

export type TrainerTalent = {
  id: string;
  name: string;
  description: string;
  /** Trainer level needed to learn it. */
  requiresLevel: number;
  /** Talent ids that must be learned first. */
  requires: string[];
  effects: TalentEffect[];
};

/**
 * Pokémon talents: generic for every species. One point per node; tier N needs tier N−1 of its branch.
 * Talent percents are talent content (not economy numbers) and live here.
 */
export const POKEMON_TALENTS: PokemonTalent[] = [
  {
    id: 'offense-1',
    branch: 'offense',
    tier: 1,
    name: 'Honed Strikes',
    description: '+8% Attack.',
    effects: [{ kind: 'statPercent', stat: 'attack', percent: 8 }],
  },
  {
    id: 'offense-2',
    branch: 'offense',
    tier: 2,
    name: 'Focused Mind',
    description: '+8% Sp. Atk.',
    effects: [{ kind: 'statPercent', stat: 'specialAttack', percent: 8 }],
  },
  {
    id: 'offense-3',
    branch: 'offense',
    tier: 3,
    name: 'Keen Eye',
    description: '+5% critical hit chance.',
    effects: [{ kind: 'critChance', percent: 5 }],
  },
  {
    id: 'offense-4',
    branch: 'offense',
    tier: 4,
    name: 'All-Out',
    description: '+10% Attack and +10% Sp. Atk.',
    effects: [
      { kind: 'statPercent', stat: 'attack', percent: 10 },
      { kind: 'statPercent', stat: 'specialAttack', percent: 10 },
    ],
  },
  {
    id: 'defense-1',
    branch: 'defense',
    tier: 1,
    name: 'Thick Hide',
    description: '+8% HP.',
    effects: [{ kind: 'statPercent', stat: 'hp', percent: 8 }],
  },
  {
    id: 'defense-2',
    branch: 'defense',
    tier: 2,
    name: 'Iron Guard',
    description: '+8% Defense.',
    effects: [{ kind: 'statPercent', stat: 'defense', percent: 8 }],
  },
  {
    id: 'defense-3',
    branch: 'defense',
    tier: 3,
    name: 'Calm Spirit',
    description: '+8% Sp. Def.',
    effects: [{ kind: 'statPercent', stat: 'specialDefense', percent: 8 }],
  },
  {
    id: 'defense-4',
    branch: 'defense',
    tier: 4,
    name: 'Bulwark',
    description: '+10% HP, +5% Defense and +5% Sp. Def.',
    effects: [
      { kind: 'statPercent', stat: 'hp', percent: 10 },
      { kind: 'statPercent', stat: 'defense', percent: 5 },
      { kind: 'statPercent', stat: 'specialDefense', percent: 5 },
    ],
  },
  {
    id: 'tempo-1',
    branch: 'tempo',
    tier: 1,
    name: 'Light Step',
    description: '+6% Speed.',
    effects: [{ kind: 'statPercent', stat: 'speed', percent: 6 }],
  },
  {
    id: 'tempo-2',
    branch: 'tempo',
    tier: 2,
    name: 'Quick Feet',
    description: '+8% Speed.',
    effects: [{ kind: 'statPercent', stat: 'speed', percent: 8 }],
  },
  {
    id: 'tempo-3',
    branch: 'tempo',
    tier: 3,
    name: 'Opportunist',
    description: '+5% Speed and +3% critical hit chance.',
    effects: [
      { kind: 'statPercent', stat: 'speed', percent: 5 },
      { kind: 'critChance', percent: 3 },
    ],
  },
  {
    id: 'tempo-4',
    branch: 'tempo',
    tier: 4,
    name: 'First Strike',
    description: 'Acts first on its first turn on the field, regardless of Speed.',
    effects: [{ kind: 'firstStrike' }],
  },
];

/**
 * Trainer talents: rules, not stat bloat. One trainer talent point per node. Three lines (training,
 * scavenging, tactics) plus two capstones that join them. `description` is the exact rule shown on
 * the trainer screen.
 */
export const TRAINER_TALENTS: TrainerTalent[] = [
  // Training line: Pokémon battle XP and the bench share.
  {
    id: 'field-notes',
    name: 'Field Notes',
    description: 'Your Pokémon earn +10% battle XP.',
    requiresLevel: 2,
    requires: [],
    effects: [{ kind: 'xpPercent', percent: 10 }],
  },
  {
    id: 'sparring-partners',
    name: 'Sparring Partners',
    description: 'Bench Pokémon get an extra 10% of the XP your team earns.',
    requiresLevel: 4,
    requires: ['field-notes'],
    effects: [{ kind: 'benchXpPercent', percent: 10 }],
  },
  {
    id: 'veteran-coach',
    name: 'Veteran Coach',
    description: 'Your Pokémon earn +15% battle XP.',
    requiresLevel: 9,
    requires: ['sparring-partners'],
    effects: [{ kind: 'xpPercent', percent: 15 }],
  },
  {
    id: 'shared-lessons',
    name: 'Shared Lessons',
    description: 'Bench Pokémon get an extra 15% of the XP your team earns.',
    requiresLevel: 14,
    requires: ['veteran-coach'],
    effects: [{ kind: 'benchXpPercent', percent: 15 }],
  },
  {
    id: 'master-trainer',
    name: 'Master Trainer',
    description: 'Your Pokémon earn +20% battle XP.',
    requiresLevel: 22,
    requires: ['shared-lessons'],
    effects: [{ kind: 'xpPercent', percent: 20 }],
  },
  // Scavenging line: dust and bonus capsules.
  {
    id: 'dust-collector',
    name: 'Dust Collector',
    description: '+10% dust from battle and quest rewards.',
    requiresLevel: 3,
    requires: [],
    effects: [{ kind: 'dustPercent', percent: 10 }],
  },
  {
    id: 'lucky-find',
    name: 'Lucky Find',
    description: 'Each battle win has a 5% chance to give a bonus Basic capsule.',
    requiresLevel: 6,
    requires: ['dust-collector'],
    effects: [{ kind: 'capsuleChance', percent: 5 }],
  },
  {
    id: 'fine-sieve',
    name: 'Fine Sieve',
    description: '+15% dust from battle and quest rewards.',
    requiresLevel: 11,
    requires: ['lucky-find'],
    effects: [{ kind: 'dustPercent', percent: 15 }],
  },
  {
    id: 'treasure-sense',
    name: 'Treasure Sense',
    description: '+5% chance of a bonus Basic capsule on each battle win.',
    requiresLevel: 17,
    requires: ['fine-sieve'],
    effects: [{ kind: 'capsuleChance', percent: 5 }],
  },
  {
    id: 'golden-touch',
    name: 'Golden Touch',
    description: '+25% dust from battle and quest rewards.',
    requiresLevel: 26,
    requires: ['treasure-sense'],
    effects: [{ kind: 'dustPercent', percent: 25 }],
  },
  // Tactics line: team-wide critical hits.
  {
    id: 'quick-draw',
    name: 'Quick Draw',
    description: 'Your whole team gets +3% critical hit chance.',
    requiresLevel: 5,
    requires: [],
    effects: [{ kind: 'critChance', percent: 3 }],
  },
  {
    id: 'eagle-eye',
    name: 'Eagle Eye',
    description: 'Your whole team gets +4% critical hit chance.',
    requiresLevel: 12,
    requires: ['quick-draw'],
    effects: [{ kind: 'critChance', percent: 4 }],
  },
  {
    id: 'killer-instinct',
    name: 'Killer Instinct',
    description: 'Your whole team gets +5% critical hit chance.',
    requiresLevel: 20,
    requires: ['eagle-eye'],
    effects: [{ kind: 'critChance', percent: 5 }],
  },
  // Capstones: join two or three lines.
  {
    id: 'lucky-streak',
    name: 'Lucky Streak',
    description: '+5% chance of a bonus Basic capsule on each battle win.',
    requiresLevel: 24,
    requires: ['treasure-sense', 'eagle-eye'],
    effects: [{ kind: 'capsuleChance', percent: 5 }],
  },
  {
    id: 'champions-road',
    name: "Champion's Road",
    description:
      'Your Pokémon earn +10% battle XP, +10% dust from rewards and +5% bonus capsule chance on wins.',
    requiresLevel: 30,
    requires: ['master-trainer', 'golden-touch', 'killer-instinct'],
    effects: [
      { kind: 'xpPercent', percent: 10 },
      { kind: 'dustPercent', percent: 10 },
      { kind: 'capsuleChance', percent: 5 },
    ],
  },
];
