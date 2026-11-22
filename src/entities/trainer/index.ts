// Retired v1 trainer roster. Kept only for the legacy `features/battle-setup` (stream 2-play deletes it);
// delete this slice with it. New code never calls `useRoster` / the roster storage helpers: their read
// path rewrites the v1 keys that the save migration (`entities/save/persistence/v1.ts`) reads.
export { type Trainer, useRoster } from './model/roster';
export { PRESET_TRAINERS } from './model/presets';
export { randomRival } from './model/randomRival';
export { trainerOptionLabels } from './model/optionLabels';
