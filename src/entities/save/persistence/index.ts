// Public face of save persistence: IndexedDB adapter, migrations, backup slot, persistent storage.
// Other layers reach these through `@/entities/save` only.
export {
  createDefaultPersistence,
  commitSave,
  LOAD_ERROR_DAMAGED,
  LOAD_ERROR_NEWER,
  LOAD_ERROR_UNAVAILABLE,
  type IdbPersistence,
  type PersistenceOptions,
} from './adapter';
export { useSaveConflict } from './conflict';
export { migrateSave, detectVersion } from './migrate';
export type { MigrateResult, MigrationContext } from './migrations';
export { readBackup, writeBackup, type SaveBackup } from './backup';
export { requestPersist, readPersistState, usePersistState, type PersistState } from './persist';
