import type { MovesetData } from '../model/prepare';

let cached: Promise<MovesetData> | undefined;

/** Loads the build-time movesets lazily; memoised (a failed load is retried on the next call). */
export function loadMovesets(): Promise<MovesetData> {
  cached ??= import('../data/movesets.json')
    .then((m) => m.default as unknown as MovesetData)
    .catch((e: unknown) => {
      cached = undefined;
      throw e;
    });
  return cached;
}
