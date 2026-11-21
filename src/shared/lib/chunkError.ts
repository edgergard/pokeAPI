/** Messages browsers (and Vite's preload helper) use when a lazy `import()` chunk can't be loaded. */
const CHUNK_FAILURE =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload css/i;

/**
 * True for a failed lazy chunk (offline, or a stale tab whose hashed chunk names changed after a
 * redeploy) — the case where only a full reload can bring the code back.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'ChunkLoadError' || CHUNK_FAILURE.test(error.message);
}
