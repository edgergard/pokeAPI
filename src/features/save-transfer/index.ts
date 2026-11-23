// Public API of the save-transfer feature: export/import save files, the backup slot and reset.
export {
  applyImport,
  createFreshSave,
  exportSave,
  markExported,
  readSaveFile,
  resetProgress,
  restoreBackup,
  type RestoreResult,
} from './model/actions';
export {
  SAVE_FILE_FORMAT,
  decodeSaveFile,
  encodeEnvelope,
  encodeSaveFile,
  exportFileName,
  type DecodeResult,
  type SaveEnvelope,
} from './model/envelope';
export { GAME_VERSION } from './model/gameVersion';
export { isBackupDue } from './model/isBackupDue';
export { TRANSFER_COPY } from './model/messages';
