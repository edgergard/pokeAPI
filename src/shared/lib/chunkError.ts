/** Messages browsers and Next's chunk loaders (webpack, Turbopack) use when a lazy `import()` chunk can't load. */
const CHUNK_FAILURE =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload css|loading (css )?chunk \S+ failed|failed to load chunk/i;

/**
 * True for a failed lazy chunk (offline, or a stale tab whose hashed chunk names changed after a
 * redeploy) — the case where only a full reload can bring the code back.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'ChunkLoadError' || CHUNK_FAILURE.test(error.message);
}
