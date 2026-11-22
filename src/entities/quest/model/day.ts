import { economy } from '@/shared/config/economy';

const MS_PER_DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Quest day of `now`: the local calendar date, where a day starts at `economy.quests.refreshHour`
 * (before that hour it is still the previous quest day). Compared in local wall-clock hours, so DST
 * shifts don't move the boundary.
 */
export function questDay(now: number): string {
  const date = new Date(now);
  const day =
    date.getHours() < economy.quests.refreshHour
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
      : date;
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** Ms timestamp of the next local `economy.quests.refreshHour` strictly after `now`. */
export function nextRefreshAt(now: number): number {
  const date = new Date(now);
  const hour = economy.quests.refreshHour;
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour);
  if (today.getTime() > now) return today.getTime();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, hour).getTime();
}

/** Day label → day number (days since 1970-01-01), or null when malformed. Labels only, no time zone. */
export function dayNumber(day: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const [, y, m, d] = match;
  const ms = Date.UTC(Number(y), Number(m) - 1, Number(d));
  return Number.isFinite(ms) ? Math.round(ms / MS_PER_DAY) : null;
}

/** Day number → `YYYY-MM-DD` label. */
export function dayLabel(dayNum: number): string {
  const date = new Date(dayNum * MS_PER_DAY);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
