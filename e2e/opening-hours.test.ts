import { describe, expect, it } from 'vitest';
import { hasOpeningHoursData, isOpenNow } from '../src/lib/openingHours';

const mondayNoon = new Date(2026, 10, 2, 12, 0);

describe('unknown opening hours', () => {
  it.each([null, undefined, '', {}, [], { weekday_text: [] }, { mon: '' },
    { mon: '  ', tue: '' }, { weekday_text: ['maandag:  '] },
    { open_now: true }, { weekday_text: [null] }])('does not infer a status from %j', hours => {
    expect(hasOpeningHoursData(hours)).toBe(false);
    expect(isOpenNow(hours, mondayNoon)).toBeNull();
  });
});

describe('existing opening-hours calculations', () => {
  it('keeps open and closed times unchanged', () => {
    const hours = { mon: '10:00 - 18:00' };
    expect(hasOpeningHoursData(hours)).toBe(true);
    expect(isOpenNow(hours, mondayNoon)).toBe(true);
    expect(isOpenNow(hours, new Date(2026, 10, 2, 19, 0))).toBe(false);
  });
  it('recognizes explicit closure as real data', () => {
    expect(hasOpeningHoursData({ mon: 'closed' })).toBe(true);
    expect(isOpenNow({ mon: 'closed' }, mondayNoon)).toBe(false);
  });
  it('keeps Google and full-day-name formats unchanged', () => {
    expect(isOpenNow({ weekday_text: ['maandag: 10:00–18:00'] }, mondayNoon)).toBe(true);
    expect(isOpenNow({ maandag: 'Gesloten' }, mondayNoon)).toBe(false);
  });
  it('keeps overnight ranges unchanged', () => {
    expect(isOpenNow({ mon: '18:00 - 02:00' }, new Date(2026, 10, 2, 23, 0))).toBe(true);
  });
});