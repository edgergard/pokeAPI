import type { Trainer } from './roster';

const SAVED_AT = '2026-01-01T00:00:00.000Z';

/** Original (non-franchise) trainers to battle against. Default-form Pokémon only. */
export const PRESET_TRAINERS: readonly Trainer[] = [
  { id: 'preset-mira-vale', firstName: 'Mira', lastName: 'Vale', team: ['charizard', 'lapras', 'jolteon', 'gengar'], savedAt: SAVED_AT },
  { id: 'preset-oren-pike', firstName: 'Oren', lastName: 'Pike', team: ['venusaur', 'machamp', 'alakazam', 'gyarados'], savedAt: SAVED_AT },
  { id: 'preset-juno-hart', firstName: 'Juno', lastName: 'Hart', team: ['dragonite', 'ninetales', 'scizor', 'vaporeon'], savedAt: SAVED_AT },
  { id: 'preset-silas-crane', firstName: 'Silas', lastName: 'Crane', team: ['tyranitar', 'gardevoir', 'infernape', 'starmie'], savedAt: SAVED_AT },
];
