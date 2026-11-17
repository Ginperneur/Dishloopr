import { supabase } from '@/integrations/supabase/client';
import { EMPTY_BADGES, type AdminBadgeKey, type AdminBadges } from './adminNav';

// Several queue tables are not in the generated types yet.
const db = supabase as any;

export interface QueueStat {
  count: number;
  /** Creation time of the oldest open item, when the queue has a meaningful age. */
  oldest: string | null;
}

export type QueueSnapshot = Record<AdminBadgeKey, QueueStat>;

/** One open-items query: the count plus the oldest row's date in a single request. */
async function stat(query: any, dateCol: string | null): Promise<QueueStat> {
  if (!dateCol) {
    const { count } = await query;
    return { count: count || 0, oldest: null };
  }
  const { data, count } = await query.order(dateCol, { ascending: true }).limit(1);
  return { count: count || 0, oldest: data?.[0]?.[dateCol] ?? null };
}

const sel = (table: string, dateCol: string | null) =>
  dateCol
    ? db.from(table).select(dateCol, { count: 'exact' })
    : db.from(table).select('id', { count: 'exact', head: true });

const merge = (a: QueueStat, b: QueueStat): QueueStat => ({
  count: a.count + b.count,
  oldest: [a.oldest, b.oldest].filter(Boolean).sort()[0] ?? null,
});

/** React Query key for the shared snapshot (sidebar badges and Vandaag). */
export const QUEUE_SNAPSHOT_KEY = ['admin-queue-snapshot'];

export const OPEN_CLAIM_STATUSES = ['pending', 'email_verified', 'phone_verified'];

/** Count and age of every admin queue. Feeds the sidebar badges and Vandaag. */
export async function fetchQueueSnapshot(): Promise<QueueSnapshot> {
  const [
    claimsNew, claimsLegacy, dishes, reviews, support, contact, edits, tagRequests,
    eventReleases, optouts, suggestions, discovery, manualReview, outreachReplies, menuService,
  ] = await Promise.all([
    stat(sel('restaurant_claims', 'created_at').in('status', OPEN_CLAIM_STATUSES), 'created_at'),
    stat(sel('claim_requests', 'created_at').eq('status', 'pending'), 'created_at'),
    stat(sel('restaurant_dishes', 'created_at').in('status', ['suggested', 'needs_review']), 'created_at'),
    stat(sel('reviews', 'created_at').eq('status', 'pending'), 'created_at'),
    stat(sel('support_conversations', 'created_at').eq('escalated', true).is('resolved_at', null), 'created_at'),
    stat(sel('contact_messages', 'created_at').eq('status', 'nieuw'), 'created_at'),
    stat(sel('restaurant_pending_edits', 'created_at').eq('status', 'pending'), 'created_at'),
    stat(sel('restaurant_tag_requests', 'created_at').eq('status', 'pending'), 'created_at'),
    stat(sel('restaurant_events', 'created_at').eq('promotion_status', 'unpaid').eq('is_active', true), 'created_at'),
    stat(sel('restaurant_optout_requests', 'created_at').or('status.is.null,status.eq.nieuw'), 'created_at'),
    stat(sel('restaurant_suggestions', 'created_at').eq('status', 'pending'), 'created_at'),
    stat(sel('discovery_results', 'discovered_at').eq('status', 'pending'), 'discovered_at'),
    stat(sel('restaurants', null).eq('needs_manual_review', true), null),
    stat(sel('outreach_replies', 'received_at').eq('status', 'te_beoordelen'), 'received_at'),
    stat(sel('package_orders', 'created_at').eq('package', 'menu_service').eq('fulfillment_status', 'todo'), 'created_at'),
  ]);

  return {
    claims: merge(claimsNew, claimsLegacy),
    dishes, reviews, support, contact, edits, tagRequests, eventReleases, optouts,
    suggestions, discovery, manualReview, outreachReplies, menuService,
  };
}

export function snapshotToBadges(snapshot: QueueSnapshot | null): AdminBadges {
  if (!snapshot) return EMPTY_BADGES;
  const out = { ...EMPTY_BADGES };
  (Object.keys(out) as AdminBadgeKey[]).forEach((k) => { out[k] = snapshot[k].count; });
  return out;
}

/** Working days (Mon to Fri) between `iso` and now, rounded down. */
export function workingDaysSince(iso: string, now = new Date()): number {
  const d = new Date(iso);
  let days = 0;
  const cursor = new Date(d);
  while (true) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor > now) break;
    const wd = cursor.getDay();
    if (wd !== 0 && wd !== 6) days++;
  }
  return days;
}

/** Short Dutch age label: "vandaag", "1 dag", "5 dagen". */
export function ageLabel(iso: string | null, now = new Date()): string {
  if (!iso) return '';
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'vandaag';
  return days === 1 ? '1 dag' : `${days} dagen`;
}
