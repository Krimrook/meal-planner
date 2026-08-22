import { getMonday, addDays, toISODate, formatDayLabel, formatRangeLabel, weekStartFromParam } from './Dateutils.js';

describe('getMonday', () => {
  test('returns the same date when given a Monday', () => {
    // 2026-08-17 is a Monday
    const monday = getMonday(new Date('2026-08-17T12:00:00'));
    expect(toISODate(monday)).toBe('2026-08-17');
  });

  test('rolls a mid-week date back to that week\'s Monday', () => {
    // 2026-08-20 is a Thursday
    const monday = getMonday(new Date('2026-08-20T09:00:00'));
    expect(toISODate(monday)).toBe('2026-08-17');
  });

  test('handles Sunday correctly (the classic getDay()===0 off-by-one trap)', () => {
    // 2026-08-23 is a Sunday — should roll BACK to the Monday that started
    // that same week, not forward to next Monday.
    const monday = getMonday(new Date('2026-08-23T18:00:00'));
    expect(toISODate(monday)).toBe('2026-08-17');
  });

  test('zeroes out the time component', () => {
    const monday = getMonday(new Date('2026-08-20T23:45:00'));
    expect(monday.getHours()).toBe(0);
    expect(monday.getMinutes()).toBe(0);
    expect(monday.getSeconds()).toBe(0);
  });
});

describe('addDays', () => {
  test('adds positive days', () => {
    const result = addDays(new Date('2026-08-17'), 6);
    expect(toISODate(result)).toBe('2026-08-23');
  });

  test('adds negative days', () => {
    const result = addDays(new Date('2026-08-17'), -7);
    expect(toISODate(result)).toBe('2026-08-10');
  });

  test('does not mutate the input date', () => {
    const original = new Date('2026-08-17');
    const originalTime = original.getTime();
    addDays(original, 5);
    expect(original.getTime()).toBe(originalTime);
  });
});

describe('toISODate', () => {
  test('pads single-digit months and days', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05'); // Jan 5
  });

  test('formats a double-digit month and day', () => {
    expect(toISODate(new Date(2026, 10, 23))).toBe('2026-11-23'); // Nov 23
  });
});

describe('formatDayLabel / formatRangeLabel', () => {
  test('formatDayLabel includes weekday, day, and month', () => {
    const label = formatDayLabel(new Date('2026-08-17'));
    expect(label).toMatch(/Mon/);
    expect(label).toMatch(/17/);
    expect(label).toMatch(/Aug/);
  });

  test('formatRangeLabel spans start to end with the year on the end date', () => {
    const label = formatRangeLabel(new Date('2026-08-17'), new Date('2026-08-23'));
    expect(label).toContain('17 Aug');
    expect(label).toContain('23 Aug 2026');
  });
});

describe('weekStartFromParam', () => {
  test('falls back to the current week when param is missing', () => {
    const expected = toISODate(getMonday(new Date()));
    expect(toISODate(weekStartFromParam(null))).toBe(expected);
    expect(toISODate(weekStartFromParam(undefined))).toBe(expected);
    expect(toISODate(weekStartFromParam(''))).toBe(expected);
  });

  test('falls back to the current week when param is malformed', () => {
    const expected = toISODate(getMonday(new Date()));
    expect(toISODate(weekStartFromParam('not-a-date'))).toBe(expected);
  });

  test('parses a valid ISO date and rolls it back to that week\'s Monday', () => {
    // 2026-08-20 is a Thursday in the week starting 2026-08-17
    expect(toISODate(weekStartFromParam('2026-08-20'))).toBe('2026-08-17');
  });
});