import { describe, expect, test } from 'bun:test';
import { pickTop, tally, scoreCandidate } from '../src/lib/foodMatch';

const c = (id: string, cats: string[], amb: string[], rating: number | null = null) => ({ id, categoryHits: new Set(cats), ambienceTags: amb, rating });

describe('food match', () => {
  test('returns exactly 2 suggestions', () => {
    const r = pickTop([c('a', ['pizza'], []), c('b', ['ramen'], []), c('c', [], [])], { pizza: 1, ramen: 1 }, {});
    expect(r.length).toBe(2);
  });
  test('restaurant matching more group dish votes wins', () => {
    const votes = tally([['ramen', 'sushi'], ['ramen']]);
    const r = pickTop([c('a', ['sushi'], [], 4.9), c('b', ['ramen'], [], 4.0)], votes, {});
    expect(r[0].id).toBe('b');
  });
  test('ambience match adds to score', () => {
    expect(scoreCandidate(c('a', [], ['Romantisch']), {}, { Romantisch: 2 })).toBe(2);
  });
});
