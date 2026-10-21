import { describe, expect, test } from 'bun:test';
import { csvEscape, searchKey } from '../src/lib/searchLog';

describe('search log', () => {
  test('CSV escapes formula prefixes', () => {
    for (const p of ['=', '+', '-', '@']) expect(csvEscape(`${p}cmd`).includes(`'${p}cmd`)).toBe(true);
    expect(csvEscape('ramen')).toBe('ramen');
  });
  test('same filters in other order give the same key', () => {
    expect(searchKey('search', 'Ramen ', 'X', { a: ['2', '1'], b: [] }))
      .toBe(searchKey('search', 'ramen', 'X', { a: ['1', '2'] }));
  });
  test('different filter gives a new key', () => {
    expect(searchKey('search', 'ramen', 'X', { openNow: true }))
      .not.toBe(searchKey('search', 'ramen', 'X', {}));
  });
});
