import { describe, it, expect } from 'vitest';
import { clientReferenceId, isUsableLink, withReference } from '../src/lib/packageLinks';

describe('package links', () => {
  it('builds a Stripe-safe reference', () => {
    expect(clientReferenceId('abc-123', 'pizza-amsterdam')).toBe('abc-123__pizza-amsterdam');
    expect(clientReferenceId('a b', 'x/y')).toBe('a-b__x-y');
    expect(clientReferenceId('a', 'x'.repeat(300)).length).toBe(200);
  });
  it('treats empty or non-https links as unavailable', () => {
    expect(isUsableLink('')).toBe(false);
    expect(isUsableLink(null)).toBe(false);
    expect(isUsableLink('http://buy.stripe.com/x')).toBe(false);
    expect(isUsableLink('https://buy.stripe.com/x')).toBe(true);
  });
  it('adds client_reference_id', () => {
    expect(withReference('https://buy.stripe.com/x', 'r__p')).toBe('https://buy.stripe.com/x?client_reference_id=r__p');
  });
});
