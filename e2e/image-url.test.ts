import { describe, expect, test } from 'bun:test';
import { optimizedImage, optimizedSrcSet } from '../src/lib/imageUrl';

const SB = 'https://abc.supabase.co/storage/v1/object/public/restaurant-images/x/1.jpg';

describe('optimizedImage', () => {
  test('storage images use the render endpoint at width 400, quality 70', () => {
    const out = optimizedImage(SB, { width: 400 });
    expect(out).toContain('/storage/v1/render/image/public/restaurant-images/x/1.jpg');
    expect(out).toContain('width=400');
    expect(out).toContain('quality=70');
  });
  test('unsplash gets w, q and webp', () => {
    const out = optimizedImage('https://images.unsplash.com/photo-1?w=2000&q=90', { width: 1200 });
    expect(out).toContain('w=1200');
    expect(out).toContain('q=70');
    expect(out).toContain('fm=webp');
  });
  test('other urls are unchanged and get no srcset', () => {
    expect(optimizedImage('https://example.com/a.jpg', { width: 400 })).toBe('https://example.com/a.jpg');
    expect(optimizedSrcSet('https://example.com/a.jpg', 400)).toBeUndefined();
  });
});
