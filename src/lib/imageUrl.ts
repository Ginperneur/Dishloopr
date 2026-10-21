const OBJECT_PATH = '/storage/v1/object/public/';
const RENDER_PATH = '/storage/v1/render/image/public/';

export interface ImageOpts { width: number; quality?: number }

/** Returns a resized WebP variant for Supabase storage or Unsplash URLs; other URLs are returned unchanged. */
export function optimizedImage(url: string | null | undefined, { width, quality = 70 }: ImageOpts): string {
  if (!url) return '';
  try {
    if (url.includes(OBJECT_PATH) && /\.supabase\.co\//.test(url)) {
      const u = new URL(url.replace(OBJECT_PATH, RENDER_PATH));
      u.searchParams.set('width', String(Math.round(width)));
      u.searchParams.set('quality', String(quality));
      u.searchParams.set('resize', 'cover');
      return u.toString();
    }
    if (/^https:\/\/images\.unsplash\.com\//.test(url)) {
      const u = new URL(url);
      u.searchParams.set('w', String(Math.round(width)));
      u.searchParams.set('q', String(quality));
      u.searchParams.set('fm', 'webp');
      u.searchParams.set('auto', 'format');
      return u.toString();
    }
  } catch {
    return url;
  }
  return url;
}

/** 1x/2x srcSet for the optimized variants (undefined when the source can't be resized). */
export function optimizedSrcSet(url: string | null | undefined, width: number, quality = 70): string | undefined {
  if (!url) return undefined;
  const a = optimizedImage(url, { width, quality });
  if (a === url) return undefined;
  return `${a} 1x, ${optimizedImage(url, { width: width * 2, quality })} 2x`;
}

/** Props for an <img>: eager + high priority for the LCP image, lazy otherwise. */
export function imgLoadingProps(priority?: boolean) {
  return priority
    ? ({ loading: 'eager', fetchpriority: 'high', decoding: 'async' } as const)
    : ({ loading: 'lazy', decoding: 'async' } as const);
}
