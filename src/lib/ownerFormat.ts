// Small display helpers for the owner dashboard.

/** First name for the greeting: profile name, else auth metadata, else the e-mail's local part. */
export function ownerFirstName(opts: { profileName?: string | null; metaName?: unknown; email?: string | null }): string | null {
  const pick = [opts.profileName, typeof opts.metaName === 'string' ? opts.metaName : null]
    .map(v => v?.trim())
    .find(Boolean);
  if (pick) return pick.split(/\s+/)[0];
  const local = opts.email?.split('@')[0]?.split(/[._+-]/)[0];
  if (!local || /\d/.test(local)) return null;
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
}

/**
 * "Top X%" of a city for a value (rating or review count), or null when there is nothing to
 * compare: no other restaurants with data, or no own value yet. Never NaN, never "Top 100%"
 * for a restaurant without reviews.
 */
export function topPercent(own: number, others: number[]): number | null {
  const valid = others.filter(v => Number.isFinite(v) && v > 0);
  if (!valid.length || !Number.isFinite(own) || own <= 0) return null;
  const better = valid.filter(v => v > own).length;
  return Math.max(1, Math.round(((better + 1) / (valid.length + 1)) * 100));
}

/** A percentage, or null when the base is zero (shown as a dash rather than NaN%). */
export function safePercent(part: number, whole: number, digits = 1): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  const f = 10 ** digits;
  return Math.round((part / whole) * 100 * f) / f;
}
