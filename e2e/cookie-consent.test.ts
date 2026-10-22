import { describe, expect, test } from 'bun:test';
import { CONSENT_KEY, CONSENT_DATE_KEY, DENIED_CONSENT, parseCookieChoice, persistCookieChoice, cookieDomains } from '../src/lib/cookieConsent';

describe('cookie consent rules', () => {
  test('all four Google consent categories start denied', () => {
    expect(DENIED_CONSENT).toEqual({ ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
  });
  for (const choice of ['accepted', 'necessary'] as const) {
    test(`stores ${choice} with its date`, () => {
      const values = new Map<string, string>();
      persistCookieChoice({ setItem: (key, value) => { values.set(key, value); } }, choice, new Date('2026-10-22T09:20:00Z'));
      expect(values.get(CONSENT_KEY)).toBe(choice);
      expect(values.get(CONSENT_DATE_KEY)).toBe('2026-10-22T09:20:00.000Z');
      expect(parseCookieChoice(values.get(CONSENT_KEY) ?? null)).toBe(choice);
    });
  }
  test('legacy rejection remains necessary and invalid choices grant nothing', () => {
    expect(parseCookieChoice('rejected')).toBe('necessary');
    expect(parseCookieChoice('true')).toBeNull();
    expect(parseCookieChoice(null)).toBeNull();
  });
  test('blocked storage does not throw', () => {
    expect(() => persistCookieChoice({ setItem: () => { throw new Error('blocked'); } }, 'necessary')).not.toThrow();
  });
  test('cleanup covers host cookies and parent-domain cookies', () => {
    expect(cookieDomains('www.dishloopr.com')).toEqual(['', 'www.dishloopr.com', 'dishloopr.com', 'com']);
  });
});