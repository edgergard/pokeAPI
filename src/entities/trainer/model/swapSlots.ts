/**
 * Returns a new team with the Pokémon in slots `from` and `to` exchanged.
 * Out-of-range or identical indices return the input unchanged (same reference),
 * so callers can skip a state update when nothing moved.
 */
export function swapSlots<T>(team: readonly T[], from: number, to: number): readonly T[] {
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < team.length;
  if (from === to || !inRange(from) || !inRange(to)) return team;

  const next = [...team];
  [next[from], next[to]] = [team[to] as T, team[from] as T];
  return next;
}
