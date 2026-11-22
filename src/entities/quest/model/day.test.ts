import { describe, expect, it } from 'vitest';
import { dayLabel, dayNumber, nextRefreshAt, questDay } from './day';

// Local-time constructors keep these tests valid in any time zone. refreshHour = 6.
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m, d, h, min).getTime();

describe('questDay', () => {
  it('starts a quest day at the refresh hour', () => {
    expect(questDay(at(2026, 10, 22, 5, 59))).toBe('2026-11-21');
    expect(questDay(at(2026, 10, 22, 6, 0))).toBe('2026-11-22');
    expect(questDay(at(2026, 10, 22, 23, 59))).toBe('2026-11-22');
  });

  it('uses local wall-clock hours, so DST change days keep the 06:00 boundary', () => {
    // EU (2027-03-28) and US (2027-03-14) spring-forward days, EU fall-back day (2026-10-25)
    for (const [m, d] of [
      [2, 28],
      [2, 14],
    ] as const) {
      expect(questDay(at(2027, m, d, 6, 30))).toBe(`2027-03-${d}`);
      expect(questDay(at(2027, m, d, 5, 30))).toBe(`2027-03-${d - 1}`);
    }
    expect(questDay(at(2026, 9, 25, 6, 0))).toBe('2026-10-25');
    expect(nextRefreshAt(at(2027, 2, 28, 1))).toBe(at(2027, 2, 28, 6));
  });

  it('crosses month and year boundaries', () => {
    expect(questDay(at(2027, 0, 1, 3))).toBe('2026-12-31');
    expect(questDay(at(2026, 11, 1, 0))).toBe('2026-11-30');
  });
});

describe('nextRefreshAt', () => {
  it('is the next local refresh hour strictly after now', () => {
    expect(nextRefreshAt(at(2026, 10, 22, 5))).toBe(at(2026, 10, 22, 6));
    expect(nextRefreshAt(at(2026, 10, 22, 6))).toBe(at(2026, 10, 23, 6));
    expect(nextRefreshAt(at(2026, 10, 22, 23, 30))).toBe(at(2026, 10, 23, 6));
    expect(nextRefreshAt(at(2026, 11, 31, 23))).toBe(at(2027, 0, 1, 6));
  });
});

describe('day numbers', () => {
  it('round-trips labels and counts days', () => {
    const n = dayNumber('2026-11-22');
    expect(n).not.toBeNull();
    if (n === null) return;
    expect(dayLabel(n)).toBe('2026-11-22');
    expect(dayLabel(n + 10)).toBe('2026-12-02');
    expect(dayNumber('2026-12-02')).toBe(n + 10);
    expect(dayNumber('not a day')).toBeNull();
  });
});
