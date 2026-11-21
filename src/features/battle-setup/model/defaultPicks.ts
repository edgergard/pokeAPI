import { PRESET_TRAINERS, type Trainer } from '@/entities/trainer';

/**
 * Red = the preferred trainer (own or preset, e.g. the team the visitor came from) when it exists,
 * else the latest own trainer, else the first preset. Blue = the first preset that isn't Red.
 * `trainers` is the visitor's roster, newest first.
 */
export function defaultPicks(
  trainers: readonly Trainer[],
  preferredId?: string | null,
): { red: Trainer; blue: Trainer } {
  const preferred = preferredId
    ? (trainers.find((t) => t.id === preferredId) ?? PRESET_TRAINERS.find((t) => t.id === preferredId))
    : undefined;
  const red = preferred ?? trainers[0] ?? (PRESET_TRAINERS[0] as Trainer);
  const blue = PRESET_TRAINERS.find((t) => t.id !== red.id) ?? (PRESET_TRAINERS[1] as Trainer);
  return { red, blue };
}
