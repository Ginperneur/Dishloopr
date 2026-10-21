import { describe, expect, test } from 'bun:test';
import { getRatingDisplay, formatScore, formatCount } from '../src/lib/ratingDisplay';

describe('rating display threshold', () => {
  test('9 own reviews shows only Google', () => {
    expect(getRatingDisplay({ googleRating: 4.5, googleReviewsCount: 1392, ownReviewCount: 9, ownAverage: 4.8 }))
      .toEqual({ mode: 'google-only', google: 4.5, googleCount: 1392 });
  });
  test('10 own reviews shows both', () => {
    expect(getRatingDisplay({ googleRating: 4.5, googleReviewsCount: 1392, ownReviewCount: 10, ownAverage: 4.6 }))
      .toEqual({ mode: 'both', own: 4.6, google: 4.5, googleCount: 1392 });
  });
  test('empty Google rating and few own reviews shows no stars', () => {
    expect(getRatingDisplay({ googleRating: null, ownReviewCount: 3, ownAverage: 5 }).mode).toBe('none');
    expect(getRatingDisplay({ googleRating: 0, ownReviewCount: 0 }).mode).toBe('none');
  });
  test('Dutch formatting uses comma and dot', () => {
    expect(formatScore(4.5, 'nl')).toBe('4,5');
    expect(formatCount(1392, 'nl')).toBe('1.392');
  });
});
