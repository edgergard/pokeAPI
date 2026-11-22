import { SAVE_VERSION, saveSchema, type Save } from '../model/schema';
import { migrateFromV1 } from './fromV1';

export type MigrationContext = {
  /** Wall-clock time for timestamps the step has to invent (createdAt, obtainedAt). */
  now: number;
};

/** Turns a document of version N into one of version N + 1, or null when there is nothing to keep. */
export type MigrationStep = (doc: unknown, ctx: MigrationContext) => unknown;

/**
 * The migration chain, keyed by the version a step upgrades from. A future v3 adds `2: fromV2` and bumps
 * SAVE_VERSION; loading and import both walk the same chain. Steps are pure.
 */
export const MIGRATIONS: Readonly<Record<number, MigrationStep>> = {
  // Step 0 of the product spec: the v1 localStorage roster → the first v2 save.
  1: migrateFromV1,
};

export type MigrateResult =
  | {
      ok: true;
      save: Save;
      /** The version it was upgraded from, or null when it was already current. */
      migratedFrom: number | null;
    }
  | {
      ok: false;
      /** newer: made by a later game; empty: an old document with nothing to import; invalid: anything else. */
      reason: 'newer' | 'empty' | 'invalid';
    };

/** Walks a document of `version` up the chain to SAVE_VERSION and validates the result. Never throws. */
export function runMigrations(version: number, doc: unknown, ctx: MigrationContext): MigrateResult {
  if (!Number.isInteger(version) || version < 1) return { ok: false, reason: 'invalid' };
  if (version > SAVE_VERSION) return { ok: false, reason: 'newer' };

  let current = doc;
  try {
    for (let v = version; v < SAVE_VERSION; v++) {
      const step = MIGRATIONS[v];
      if (!step) return { ok: false, reason: 'invalid' };
      current = step(current, ctx);
      if (current === null || current === undefined) return { ok: false, reason: 'empty' };
    }
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const parsed = saveSchema.safeParse(current);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  return { ok: true, save: parsed.data, migratedFrom: version === SAVE_VERSION ? null : version };
}
