import type { LoadResult, SavePersistence } from '../model/store';
import type { Save } from '../model/schema';

/**
 * Foundation placeholder: keeps the save in memory only (lost on reload).
 * TODO(stream 1-save): replace with the IndexedDB adapter (+ migrations, backup slot, persist()).
 */
export function createDefaultPersistence(): SavePersistence {
  let stored: Save | null = null;
  return {
    durable: false,
    async load(): Promise<LoadResult> {
      return stored ? { kind: 'loaded', save: stored } : { kind: 'empty' };
    },
    async write(save: Save) {
      stored = save;
      return true;
    },
  };
}
