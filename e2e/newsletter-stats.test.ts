import { describe, expect, test } from 'bun:test';
import { newsletterEmailSchema } from '../src/lib/validations';
import { roundDownHundreds } from '../src/lib/utils';

describe('newsletter email', () => {
  test('normalises case and spaces', () => {
    expect(newsletterEmailSchema.parse('  Jan@Example.COM ')).toBe('jan@example.com');
  });
  test('rejects invalid addresses', () => {
    expect(newsletterEmailSchema.safeParse('jan@').success).toBe(false);
    expect(newsletterEmailSchema.safeParse('geen mail').success).toBe(false);
  });
});

describe('homepage stats rounding', () => {
  test('rounds down to hundreds', () => {
    expect(roundDownHundreds(2199)).toBe(2100);
    expect(roundDownHundreds(83797)).toBe(83700);
    expect(roundDownHundreds(30)).toBe(30);
  });
});
