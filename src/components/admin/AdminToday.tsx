import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLaunchDate } from '@/hooks/useLaunchDate';
import { useActivityLog } from '@/hooks/useActivityLog';
import { approveClaimRequest, rejectClaimRequest } from '@/lib/claimApproval';
import { TestMailsCard } from './TestMailsCard';
import {
  QUEUE_SNAPSHOT_KEY, ageLabel, fetchQueueSnapshot, workingDaysSince, type QueueSnapshot, type QueueStat,
} from './adminQueues';
import type { AdminBadgeKey } from './adminNav';
import { ArrowRight, Loader2, CheckCircle2, ChevronDown, ChevronUp, Check, X } from 'lucide-react';

// Some tables are not in the generated types yet.
const db = supabase as any;

type BulkKey = 'claims' | 'dishes' | 'reviews';
type RowKey = AdminBadgeKey | 'menuMissing';

interface QueueRow {
  key: RowKey;
  label: string;
  description: string;
  section: string;
  /** Working days we promise to handle an item in, if any. */
  sla?: number;
  bulk?: BulkKey;
}

const ROWS: QueueRow[] = [
  { key: 'claims', label: 'Claims', description: 'Eigenaren wachten op toegang', section: 'claims', sla: 2, bulk: 'claims' },
  { key: 'menuService', label: 'Menuservice', description: 'Betaald, handmatig leveren', section: 'package-orders', sla: 3 },
  { key: 'support', label: 'Support-escalaties', description: 'De AI-klantenservice kwam er niet uit', section: 'support', sla: 1 },
  { key: 'contact', label: 'Contactberichten', description: 'Vragen en meldingen via het formulier', section: 'contact', sla: 1 },
  { key: 'outreachReplies', label: 'Outreach-antwoorden', description: 'Eigenaren die reageerden op een mailgolf', section: 'outreach', sla: 1 },
  { key: 'edits', label: 'Wijzigingen', description: 'Naam of beschrijving, niet automatisch goedgekeurd', section: 'edits', sla: 2 },
  { key: 'tagRequests', label: 'Tag-aanvragen', description: 'Keuken-, sfeer- of conceptlabels van eigenaren', section: 'tag-requests', sla: 2 },
  { key: 'eventReleases', label: 'Evenementen', description: 'Specials van eigenaren vrijgeven', section: 'event-releases', sla: 2 },
  { key: 'optouts', label: 'Afmeldingen', description: 'Restaurants die eruit of iets aangepast willen', section: 'optouts', sla: 2 },
  { key: 'reviews', label: 'Reviews', description: 'In moderatie', section: 'reviews', bulk: 'reviews' },
  { key: 'dishes', label: 'Gerecht-suggesties', description: 'Screen eerst automatisch, dan de rest met de hand', section: 'dish-approval', bulk: 'dishes' },
  { key: 'suggestions', label: 'Restaurant-suggesties', description: 'Ingediend door bezoekers', section: 'suggestions' },
  { key: 'discovery', label: 'Discovery', description: 'Nieuw gevonden restaurants beoordelen', section: 'discovery' },
  { key: 'manualReview', label: 'Handmatig nakijken', description: 'Gemarkeerd om te controleren', section: 'manual-review' },
  { key: 'menuMissing', label: 'Menu ontbreekt', description: 'Verborgen om hun menu of mislukte scrape', section: 'empty-dishes' },
];

type Status = 'late' | 'due' | 'ok' | 'open' | 'empty';
const STATUS_ORDER: Record<Status, number> = { late: 0, due: 1, ok: 2, open: 3, empty: 4 };
const STATUS_LABEL: Record<Status, string> = { late: 'Te laat', due: 'Vandaag', ok: 'Op tijd', open: 'Open', empty: '' };
const STATUS_CLASS: Record<Status, string> = {
  late: 'bg-destructive/10 text-destructive',
  due: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  ok: 'bg-green-600/10 text-green-700 dark:text-green-300',
  open: 'bg-muted text-muted-foreground',
  empty: '',
};

function statusFor(row: QueueRow, stat: QueueStat): Status {
  if (stat.count === 0) return 'empty';
  if (!row.sla || !stat.oldest) return 'open';
  const age = workingDaysSince(stat.oldest);
  if (age > row.sla) return 'late';
  if (age === row.sla) return 'due';
  return 'ok';
}

const sinceDays = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

interface TodayExtras {
  menuMissing: QueueStat;
  claimedRestaurants: number;
  uitgelicht: number;
  ownerPro: number;
  week: { claims: number; users: number; reviews: number; replies: number };
  errors24h: number;
  failedScrapes: number;
}

async function fetchExtras(): Promise<TodayExtras> {
  const head = { count: 'exact' as const, head: true };
  const weekAgo = sinceDays(7);
  const [
    hiddenNoReason, hiddenMenu, failedScrapes, claimed, uitgelicht, pro,
    wClaimsNew, wClaimsLegacy, wUsers, wReviews, wReplies, errors,
  ] = await Promise.all([
    db.from('restaurants_verborgen').select('id', head).is('reden', null),
    db.from('restaurants_verborgen').select('id', head).filter('reden', 'imatch', 'menu|gerecht|kaart|dish'),
    db.from('scrape_queue').select('id', head).eq('status', 'failed'),
    supabase.from('restaurants').select('id', head).not('claimed_by_owner_id', 'is', null),
    db.from('package_orders').select('id', head).eq('package', 'founding_partner').in('status', ['active', 'trialing', 'past_due']),
    supabase.from('owner_pro_subscriptions').select('id', head).eq('status', 'active'),
    supabase.from('restaurant_claims').select('id', head).gte('created_at', weekAgo),
    supabase.from('claim_requests').select('id', head).gte('created_at', weekAgo),
    supabase.from('profiles').select('id', head).gte('created_at', weekAgo),
    supabase.from('reviews').select('id', head).gte('created_at', weekAgo),
    db.from('outreach_replies').select('id', head).gte('received_at', weekAgo),
    supabase.from('error_logs').select('id', head).gte('created_at', sinceDays(1)),
  ]);
  return {
    menuMissing: { count: (hiddenNoReason.count || 0) + (hiddenMenu.count || 0) + (failedScrapes.count || 0), oldest: null },
    claimedRestaurants: claimed.count || 0,
    uitgelicht: uitgelicht.count || 0,
    ownerPro: pro.count || 0,
    week: {
      claims: (wClaimsNew.count || 0) + (wClaimsLegacy.count || 0),
      users: wUsers.count || 0,
      reviews: wReviews.count || 0,
      replies: wReplies.count || 0,
    },
    errors24h: errors.count || 0,
    failedScrapes: failedScrapes.count || 0,
  };
}

interface AdminTodayProps {
  onNavigate: (section: string) => void;
}

export function AdminToday({ onNavigate }: AdminTodayProps) {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const launch = useLaunchDate();
  const [expanded, setExpanded] = useState<BulkKey | null>(null);
  const [items, setItems] = useState<Partial<Record<BulkKey, any[]>>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  const { data: snapshot } = useQuery({ queryKey: QUEUE_SNAPSHOT_KEY, queryFn: fetchQueueSnapshot, refetchInterval: 60_000 });
  const { data: extras } = useQuery({ queryKey: ['admin-today-extras'], queryFn: fetchExtras, refetchInterval: 5 * 60_000 });

  const rows = useMemo(() => {
    if (!snapshot || !extras) return [];
    const statFor = (key: RowKey): QueueStat =>
      key === 'menuMissing' ? extras.menuMissing : (snapshot as QueueSnapshot)[key];
    return ROWS.map((row) => {
      const stat = statFor(row.key);
      return { row, stat, status: statusFor(row, stat) };
    }).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.stat.count - a.stat.count);
  }, [snapshot, extras]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: QUEUE_SNAPSHOT_KEY });
    queryClient.invalidateQueries({ queryKey: ['admin-today-extras'] });
  };

  // Oldest first: that is the order you work a queue in.
  const loadItems = async (key: BulkKey) => {
    if (key === 'claims') {
      const { data } = await supabase
        .from('claim_requests')
        .select('id, restaurant_id, user_id, created_at, restaurants(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(20);
      setItems((p) => ({ ...p, claims: data || [] }));
    } else if (key === 'dishes') {
      const { data } = await supabase
        .from('restaurant_dishes')
        .select('id, restaurant_id, dish_id, created_at, dishes(name), restaurants(name)')
        .eq('status', 'suggested')
        .order('created_at', { ascending: true })
        .limit(20);
      setItems((p) => ({ ...p, dishes: data || [] }));
    } else {
      const { data } = await supabase
        .from('reviews')
        .select('id, restaurant_id, content, created_at, restaurants(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(20);
      setItems((p) => ({ ...p, reviews: data || [] }));
    }
  };

  const toggleExpand = async (key: BulkKey) => {
    setSelected(new Set());
    if (expanded === key) { setExpanded(null); return; }
    setExpanded(key);
    await loadItems(key);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runBulk = async (key: BulkKey, action: 'approve' | 'reject') => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    let done = 0;
    try {
      if (key === 'claims') {
        // Same steps as the Claims page, so an approved owner really gets access.
        const list = (items.claims || []).filter((i) => selected.has(i.id));
        for (const request of list) {
          if (action === 'approve') await approveClaimRequest(request);
          else await rejectClaimRequest(request.id);
          await logActivity({
            actionType: action,
            entityType: 'claim',
            entityId: request.id,
            entityName: request.restaurants?.name,
            details: { bulk: true },
          });
          done++;
        }
      } else if (key === 'dishes') {
        const status = action === 'approve' ? 'approved_by_admin' : 'rejected';
        const { error } = await supabase.from('restaurant_dishes').update({ status }).in('id', ids);
        if (error) throw error;
        done = ids.length;
      } else {
        const status = action === 'approve' ? 'published' as const : 'flagged' as const;
        const { error } = await supabase.from('reviews').update({ status }).in('id', ids);
        if (error) throw error;
        done = ids.length;
      }
      toast.success(`${done} item(s) ${action === 'approve' ? 'goedgekeurd' : 'afgewezen'}`);
    } catch (e: any) {
      toast.error(`Bulk-actie gestopt na ${done} item(s): ${e.message || ''}`);
    } finally {
      setSelected(new Set());
      await loadItems(key);
      refresh();
      setBulkBusy(false);
    }
  };

  const labelFor = (key: BulkKey, item: any): string => {
    if (key === 'claims') return item.restaurants?.name || `Restaurant ${item.restaurant_id?.slice(0, 8)}`;
    if (key === 'dishes') return `${item.dishes?.name || 'Gerecht'} bij ${item.restaurants?.name || 'onbekend restaurant'}`;
    return `${item.restaurants?.name || ''}: ${(item.content || '').slice(0, 60)}`;
  };

  if (!snapshot || !extras) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const open = rows.filter((r) => r.status !== 'empty');
  const empty = rows.filter((r) => r.status === 'empty');
  const late = rows.filter((r) => r.status === 'late').length;
  const launchDay = new Date(`${launch.iso}T00:00:00`);
  const daysToLaunch = Math.ceil((launchDay.getTime() - Date.now()) / 86_400_000);
  const bulkRow = expanded ? ROWS.find((r) => r.bulk === expanded) : null;

  return (
    <div className="space-y-5">
      {/* Launch */}
      <Card>
        <CardContent className="pt-6 flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="min-w-[180px]">
            <p className="text-xs text-muted-foreground">
              {daysToLaunch > 0 ? `Soft launch op ${launch.label}` : `Live sinds ${launch.label}`}
            </p>
            <p className="font-display text-3xl font-bold text-primary">
              {daysToLaunch > 0 ? `nog ${daysToLaunch} ${daysToLaunch === 1 ? 'dag' : 'dagen'}` : 'live'}
            </p>
            <button onClick={() => onNavigate('settings')} className="mt-1 text-xs text-primary hover:underline">
              Launchdatum aanpassen
            </button>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Geclaimde restaurants" value={extras.claimedRestaurants} onClick={() => onNavigate('claim-analytics')} />
            <Stat label="Uitgelicht (actief en proef)" value={extras.uitgelicht} onClick={() => onNavigate('package-orders')} />
            <Stat label="Owner Pro actief" value={extras.ownerPro} onClick={() => onNavigate('package-orders')} />
            <Stat label="Menuservice te leveren" value={snapshot.menuService.count} tone={snapshot.menuService.count ? 'warn' : undefined} onClick={() => onNavigate('package-orders')} />
          </div>
        </CardContent>
      </Card>

      {/* Queues */}
      <Card className={open.length === 0 ? 'border-green-500/30 bg-green-500/5' : undefined}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                {open.length === 0 && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                Te doen, op volgorde van deadline
              </CardTitle>
              <CardDescription className="mt-1">
                {open.length === 0
                  ? 'Alle wachtrijen zijn leeg.'
                  : `${open.length} wachtrijen met werk${late ? `, ${late} over de belofte aan eigenaren` : ''}.`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Wachtrij</th>
                  <th className="py-2 px-3 font-medium text-right">Open</th>
                  <th className="py-2 px-3 font-medium">Oudste</th>
                  <th className="py-2 px-3 font-medium">Belofte</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 pl-3 font-medium text-right">Actie</th>
                </tr>
              </thead>
              <tbody>
                {open.map(({ row, stat, status }) => (
                  <tr key={row.key} className="border-t border-border/60">
                    <td className="py-3 pr-3">
                      <div className="font-medium">{row.label}</div>
                      <div className="text-xs text-muted-foreground">{row.description}</div>
                    </td>
                    <td className="py-3 px-3 text-right text-base font-bold tabular-nums">{stat.count}</td>
                    <td className="py-3 px-3 text-muted-foreground">{ageLabel(stat.oldest) || '-'}</td>
                    <td className="py-3 px-3 text-muted-foreground">{row.sla ? `${row.sla} ${row.sla === 1 ? 'werkdag' : 'werkdagen'}` : '-'}</td>
                    <td className="py-3 px-3">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="py-3 pl-3">
                      <div className="flex justify-end gap-2">
                        {row.bulk && (
                          <Button size="sm" variant="ghost" onClick={() => toggleExpand(row.bulk!)}>
                            Snel {expanded === row.bulk ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => onNavigate(row.section)}>
                          Openen <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {empty.length > 0 && (
            <div className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <button onClick={() => setShowEmpty((s) => !s)} className="hover:text-foreground">
                {empty.length} lege wachtrijen {showEmpty ? 'verbergen' : 'tonen'}
              </button>
              {showEmpty && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {empty.map(({ row }) => (
                    <button key={row.key} onClick={() => onNavigate(row.section)} className="rounded-full border border-border/60 px-2.5 py-1 hover:bg-muted/50">
                      {row.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {expanded && bulkRow && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">Snel afhandelen: {bulkRow.label}</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setSelected(new Set((items[expanded] || []).map((i) => i.id)))} disabled={!items[expanded]?.length}>
                  Alles selecteren
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
                  Wissen
                </Button>
                <Button size="sm" onClick={() => runBulk(expanded, 'approve')} disabled={selected.size === 0 || bulkBusy}>
                  {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                  Goedkeuren ({selected.size})
                </Button>
                <Button size="sm" variant="destructive" onClick={() => runBulk(expanded, 'reject')} disabled={selected.size === 0 || bulkBusy}>
                  <X className="h-3 w-3 mr-1" />
                  Afwijzen
                </Button>
              </div>
            </div>
            <CardDescription className="text-xs mt-1">
              De 20 oudste items. {expanded === 'claims' ? 'Alleen claimverzoeken; claims met e-mail- of telefoonverificatie beoordeel je op de Claims-pagina.' : 'Voor meer detail open je de wachtrij.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!items[expanded] ? (
              <div className="py-6 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
            ) : items[expanded]!.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Geen items.</p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {items[expanded]!.map((item: any) => (
                  <label key={item.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer text-sm">
                    <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                    <span className="flex-1 truncate">{labelFor(expanded, item)}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(item.created_at).toLocaleDateString('nl-NL')}</span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Afgelopen 7 dagen</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Stat label="Nieuwe claims" value={extras.week.claims} onClick={() => onNavigate('claim-analytics')} />
            <Stat label="Nieuwe gebruikers" value={extras.week.users} onClick={() => onNavigate('users')} />
            <Stat label="Nieuwe reviews" value={extras.week.reviews} onClick={() => onNavigate('reviews')} />
            <Stat label="Outreach-antwoorden" value={extras.week.replies} onClick={() => onNavigate('outreach')} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Systeemstatus</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border/60">
            <Health label="Fouten bij bezoekers (24 uur)" value={extras.errors24h} bad={extras.errors24h > 0} onClick={() => onNavigate('error-logs')} />
            <Health label="Mislukte menu-scrapes" value={extras.failedScrapes} bad={extras.failedScrapes > 0} onClick={() => onNavigate('menu-scraper')} />
            <Health label="Restaurants verborgen om hun menu" value={extras.menuMissing.count - extras.failedScrapes} bad={false} onClick={() => onNavigate('empty-dishes')} />
          </CardContent>
        </Card>
      </div>

      <TestMailsCard />
    </div>
  );
}

function Stat({ label, value, tone, onClick }: { label: string; value: number; tone?: 'warn'; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 ${tone === 'warn' ? 'border-orange-500/40 bg-orange-500/5' : 'border-border/60'}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString('nl-NL')}</p>
    </button>
  );
}

function Health({ label, value, bad, onClick }: { label: string; value: number; bad: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm hover:text-primary">
      <span className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${bad ? 'bg-orange-500' : 'bg-green-600'}`} aria-hidden="true" />
        {label}
      </span>
      <Badge variant={bad ? 'destructive' : 'secondary'}>{value.toLocaleString('nl-NL')}</Badge>
    </button>
  );
}
