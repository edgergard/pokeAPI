import { PRESET_TRAINERS, type Trainer } from '@/entities/trainer';

/** Red = the latest own trainer (else the first preset); Blue = the first preset that isn't Red. */
export function defaultPicks(latest: Trainer | undefined): { red: Trainer; blue: Trainer } {
  const red = latest ?? (PRESET_TRAINERS[0] as Trainer);
  const blue = PRESET_TRAINERS.find((t) => t.id !== red.id) ?? (PRESET_TRAINERS[1] as Trainer);
  return { red, blue };
}
