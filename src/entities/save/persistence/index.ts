// Public face of save persistence: IndexedDB adapter, migrations, backup slot, persistent storage.
// Other layers reach these through `@/entities/save` only.
export {
  createDefaultPersistence,
  LOAD_ERROR_DAMAGED,
  LOAD_ERROR_NEWER,
  type IdbPersistence,
  type PersistenceOptions,
} from './adapter';
export { migrateSave, detectVersion } from './migrate';
export type { MigrateResult, MigrationContext } from './migrations';
export { readBackup, writeBackup, type SaveBackup } from './backup';
export { requestPersist, readPersistState, usePersistState, type PersistState } from './persist';
