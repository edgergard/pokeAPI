/**
 * Floors a product of decimals without float noise (e.g. `100 * 1.15 = 114.99999999999999` → 115).
 * Game values are small integers times percentages, so a 1e-9 nudge never crosses a real fraction.
 */
export function floorSafe(value: number): number {
  return Math.floor(value + 1e-9);
}

/** `floor(value × (100 + percent) / 100)` — a percent bonus on an integer amount. */
export function withPercent(value: number, percent: number): number {
  if (percent === 0) return value;
  return floorSafe((value * (100 + percent)) / 100);
}
