import { describe, it, expect } from 'vitest';
import { missingItems, compareLandingOrder } from '../src/lib/inviteChecklist';

describe('invite checklist', () => {
  it('counts dishes without price', () => {
    const items = missingItems({ dishPrices: [null, 12, null], opening_hours: { ma: '9-17' }, images: ['a'], ambience_tags: ['Gezellig'], parking_info: {} });
    expect(items.map(i => i.label)).toEqual(['2 gerechten zonder prijs']);
  });
  it('lists all missing fields', () => {
    const items = missingItems({ dishPrices: [], opening_hours: null, images: [], ambience_tags: null, parking_info: null });
    expect(items.map(i => i.key)).toEqual(['hours', 'photos', 'ambience', 'parking']);
  });
});

describe('landing order', () => {
  const r = (id: string, rating: number, f = false, t = false) => ({ id, rating, is_featured: f, is_top_listing: t });
  it('featured, then top listing, then rating, then id', () => {
    const list = [r('b', 4.5), r('a', 4.5), r('c', 4.9), r('d', 3, false, true), r('e', 1, true)];
    expect(list.sort(compareLandingOrder).map(x => x.id)).toEqual(['e', 'd', 'c', 'a', 'b']);
  });
});
