/** Pure decisions behind useBattlePlayback's session rebuilds (motion flips, fallbacks). */

/** Why the arena is showing the log instead of (or on top of) the 3D stage. */
export type StageNotice = 'unsupported' | 'error' | 'lost' | null;

export type ResumePlan =
  { kind: 'start' } | { kind: 'resume'; from: number } | { kind: 'finished' };

/**
 * How a (re)built timeline should start, given how many events the HUD already shows.
 * A finished battle jumps to its end state: the victory beat is not replayed and the result
 * screen stays put.
 */
export function resumePlan(delivered: number, total: number): ResumePlan {
  if (delivered <= 0) return { kind: 'start' };
  if (delivered >= total) return { kind: 'finished' };
  return { kind: 'resume', from: delivered };
}

/** The notice for running without a 3D stage when no stage was ever created. */
export function fallbackNotice(opts: {
  chunkLoaded: boolean;
  supported: boolean;
}): Exclude<StageNotice, null> {
  return opts.chunkLoaded && !opts.supported ? 'unsupported' : 'error';
}
