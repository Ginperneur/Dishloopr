import { describe, expect, test } from 'bun:test';
import {
  capitalizeTerm,
  groupByCoverage,
  sortByCoverage,
  splitDishQuery,
} from '../src/lib/multiDishSearch';

describe('splitDishQuery', () => {
  test('splits on Dutch "en" and comma', () => {
    expect(splitDishQuery('biefstuk en garnalen')).toEqual(['biefstuk', 'garnalen']);
    expect(splitDishQuery('Biefstuk, Garnalen')).toEqual(['biefstuk', 'garnalen']);
  });

  test('splits on English "and", "&" and "+"', () => {
    expect(splitDishQuery('steak and shrimp')).toEqual(['steak', 'shrimp']);
    expect(splitDishQuery('sushi & ramen')).toEqual(['sushi', 'ramen']);
    expect(splitDishQuery('sushi&ramen')).toEqual(['sushi', 'ramen']);
    expect(splitDishQuery('pizza + pasta')).toEqual(['pizza', 'pasta']);
  });

  test('keeps trailing location words with the second dish', () => {
    expect(splitDishQuery('biefstuk en garnalen in utrecht')).toEqual([
      'biefstuk',
      'garnalen in utrecht',
    ]);
  });

  test('compound dishes stay whole', () => {
    expect(splitDishQuery('fish and chips')).toEqual(['fish and chips']);
    expect(splitDishQuery('Fish & Chips')).toEqual(['fish & chips']);
    expect(splitDishQuery('fish&chips')).toEqual(['fish & chips']);
    expect(splitDishQuery('kip zoet en zuur')).toEqual(['kip zoet en zuur']);
    expect(splitDishQuery('mac and cheese')).toEqual(['mac and cheese']);
  });

  test('keepWhole callback keeps a part whole', () => {
    expect(splitDishQuery('peper en zout', p => p === 'peper en zout')).toEqual(['peper en zout']);
  });

  test('duplicates are removed and empty parts dropped', () => {
    expect(splitDishQuery('biefstuk en biefstuk')).toEqual(['biefstuk']);
    expect(splitDishQuery('biefstuk,, ')).toEqual(['biefstuk']);
  });

  test('words containing "en" inside are not split', () => {
    expect(splitDishQuery('kip tandoori met rijst')).toEqual(['kip tandoori met rijst']);
    expect(splitDishQuery('garnalen')).toEqual(['garnalen']);
    expect(splitDishQuery('entrecote')).toEqual(['entrecote']);
  });
});

describe('sortByCoverage', () => {
  test('items covering more dishes come first, original order kept within a group', () => {
    const items = [
      { id: 'a', matchedTerms: ['x'] },
      { id: 'b', matchedTerms: ['x', 'y'] },
      { id: 'c', matchedTerms: ['x', 'y'] },
      { id: 'd', matchedTerms: ['x'] },
    ];
    expect(sortByCoverage(items).map(i => i.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  test('compare orders within a coverage group, coverage still wins', () => {
    const items = [
      { id: 'a', matchedTerms: ['x'], rating: 100 },
      { id: 'b', matchedTerms: ['x', 'y'], rating: 3 },
      { id: 'c', matchedTerms: ['x', 'y'], rating: 9 },
      { id: 'd', matchedTerms: ['x'], rating: 1 },
    ];
    const sorted = sortByCoverage(items, (p, q) => q.rating - p.rating);
    expect(sorted.map(i => i.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});

describe('groupByCoverage', () => {
  test('groups a sorted list by coverage', () => {
    const items = [
      { id: 1, matchedTerms: ['a', 'b'] },
      { id: 2, matchedTerms: ['a'] },
      { id: 3, matchedTerms: ['a', 'b'] },
    ];
    const groups = groupByCoverage(sortByCoverage(items));
    expect(groups).toEqual([
      { covered: 2, items: [{ id: 1, matchedTerms: ['a', 'b'] }, { id: 3, matchedTerms: ['a', 'b'] }] },
      { covered: 1, items: [{ id: 2, matchedTerms: ['a'] }] },
    ]);
  });
});

describe('capitalizeTerm', () => {
  test('uppercases the first letter only', () => {
    expect(capitalizeTerm('biefstuk')).toBe('Biefstuk');
    expect(capitalizeTerm('')).toBe('');
  });
});
