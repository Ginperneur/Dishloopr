import { describe, expect, test } from 'bun:test';
import {
  attemptsExhausted, canSendAnotherCode, canStartClaim, codeExpiry, domainMatches, extractDomain, isExpired,
} from '../supabase/functions/verify-claim/rules';

describe('claim verification rules', () => {
  test('website domain ignores www', () => {
    expect(extractDomain('https://www.bistro.nl/menu')).toBe('bistro.nl');
  });
  test('email on the same domain or a subdomain matches', () => {
    expect(domainMatches('info@bistro.nl', 'bistro.nl')).toBe(true);
    expect(domainMatches('jan@mail.bistro.nl', 'bistro.nl')).toBe(true);
  });
  test('gmail or a lookalike domain is refused', () => {
    expect(domainMatches('bistro@gmail.com', 'bistro.nl')).toBe(false);
    expect(domainMatches('info@fakebistro.nl', 'bistro.nl')).toBe(false);
  });
  test('code is valid for 15 minutes', () => {
    const now = Date.now();
    const exp = codeExpiry(now);
    expect(exp.getTime() - now).toBe(15 * 60 * 1000);
    expect(isExpired(exp, now + 14 * 60 * 1000)).toBe(false);
    expect(isExpired(exp, now + 16 * 60 * 1000)).toBe(true);
  });
  test('max 5 attempts per code', () => {
    expect(attemptsExhausted(4)).toBe(false);
    expect(attemptsExhausted(5)).toBe(true);
  });
  test('max 3 codes per hour per claim', () => {
    expect(canSendAnotherCode(2)).toBe(true);
    expect(canSendAnotherCode(3)).toBe(false);
  });
  test('verified restaurant cannot be claimed again and one open claim per user', () => {
    expect(canStartClaim('verified_owner', false)).toEqual({ ok: false, reason: 'already_claimed' });
    expect(canStartClaim('claimed_unverified', true)).toEqual({ ok: false, reason: 'open_claim' });
    expect(canStartClaim('claimed_unverified', false)).toEqual({ ok: true });
  });
});
