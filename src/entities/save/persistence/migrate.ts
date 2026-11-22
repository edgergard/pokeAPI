import { SAVE_VERSION, saveSchema } from '../model/schema';
import type { MigrateResult, MigrationContext } from './migrations';

/**
 * Brings a save document of `version` up to the current schema and validates it — the single entry
 * point for loading, the backup slot and file import. A current document is only validated; older ones
 * load the migration chain on demand, so the species data it needs stays out of every page's bundle.
 * Never throws.
 */
export async function migrateSave(
  version: number,
  doc: unknown,
  ctx: MigrationContext,
): Promise<MigrateResult> {
  if (version === SAVE_VERSION) {
    const parsed = saveSchema.safeParse(doc);
    return parsed.success
      ? { ok: true, save: parsed.data, migratedFrom: null }
      : { ok: false, reason: 'invalid' };
  }
  if (Number.isInteger(version) && version > SAVE_VERSION) return { ok: false, reason: 'newer' };
  let chain: typeof import('./migrations');
  try {
    chain = await import('./migrations');
  } catch {
    return { ok: false, reason: 'unavailable' }; // the chunk failed to load: not the document's fault
  }
  return chain.runMigrations(version, doc, ctx);
}

/** The `version` of a stored save document, or null when it doesn't look like one. */
export function detectVersion(doc: unknown): number | null {
  if (typeof doc !== 'object' || doc === null || !('version' in doc)) return null;
  const { version } = doc;
  return typeof version === 'number' && Number.isInteger(version) && version >= 1 ? version : null;
}
