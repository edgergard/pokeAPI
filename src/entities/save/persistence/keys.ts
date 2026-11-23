/**
 * Persisted keys (docs/plan/PLAN.md "Persisted keys"). These are the only IndexedDB keys the game uses;
 * adding one is a contract change (L-027).
 */
export const DB_NAME = 'trainer-studio';
export const STORE_NAME = 'keyval';

/** The current save document. */
export const SAVE_KEY = 'save:v2';
/** One previous save (before an import, a reset or a restore), with the time it was moved there. */
export const BACKUP_KEY = 'save:backup';

/** v1 localStorage keys. Read once by the v1 migration, never written or removed. */
export const V1_ROSTER_KEY = 'trainer-studio:roster:v1';
export const V1_TRAINER_KEY = 'trainer-studio:trainer:v1';

/**
 * sessionStorage fallback (same JSON document as `save:v2`), written only while IndexedDB is missing or
 * blocked, so a full page load within the same tab keeps progress. Never durable.
 */
export const SESSION_SAVE_KEY = 'trainer-studio:session-save:v2';
