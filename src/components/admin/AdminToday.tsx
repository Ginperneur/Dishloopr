import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  FileText, UtensilsCrossed, Store, MessageSquare, AlertTriangle,
  TrendingUp, ArrowRight, Loader2, CheckCircle2, ChevronDown, ChevronUp, Check, X,
} from 'lucide-react';

interface QueueCounts {
  claims: number;
  dishes: number;
  newRestaurants: number;
  reviews: number;
  failedScrapes: number;
  emptyDishes: number;
}

interface AdminTodayProps {
  onNavigate: (section: string) => void;
}

const QUEUES: Array<{
  key: keyof QueueCounts;
  label: string;
  description: string;
  icon: any;
  section: string;
  tone: 'urgent' | 'warning' | 'info';
}> = [
  { key: 'claims', label: 'Claim aanvragen', description: 'Eigenaren wachten op goedkeuring', icon: FileText, section: 'claims', tone: 'urgent' },
  { key: 'dishes', label: 'Gerecht-suggesties', description: 'Door bezoekers/eigenaren ingediend', icon: UtensilsCrossed, section: 'dish-approval', tone: 'warning' },
  { key: 'newRestaurants', label: 'Nieuwe restaurants', description: 'Inactief, wacht op review', icon: Store, section: 'restaurants', tone: 'warning' },
  { key: 'reviews', label: 'Reviews', description: 'In moderatie wachtrij', icon: MessageSquare, section: 'reviews', tone: 'warning' },
  { key: 'failedScrapes', label: 'Mislukte scrapes', description: 'Handmatig menu of opnieuw proberen', icon: AlertTriangle, section: 'menu-scraper', tone: 'info' },
  { key: 'emptyDishes', label: 'Restaurants zonder gerechten', description: 'Menu-scrape nodig', icon: AlertTriangle, section: 'empty-dishes', tone: 'info' },
];

const toneClass = (t: 'urgent' | 'warning' | 'info') =>
  t === 'urgent'
    ? 'border-destructive/40 bg-destructive/5 hover:bg-destructive/10'
    : t === 'warning'
    ? 'border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10'
    : 'border-border hover:bg-muted/40';

export function AdminToday({ onNavigate }: AdminTodayProps) {
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<keyof QueueCounts | null>(null);
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    const headOpts = { count: 'exact' as const, head: true };
    const c1 = await supabase.from('restaurant_claims').select('id', headOpts).in('status', ['pending', 'email_verified', 'phone_verified']);
    const c2 = await supabase.from('claim_requests').select('id', headOpts).eq('status', 'pending');
    const dishes = await supabase.from('restaurant_dishes').select('id', headOpts).eq('status', 'suggested');
    const newR = await supabase.from('restaurants').select('id', headOpts).eq('is_active', false).not('claimed_by_owner_id', 'is', null);
    const reviews = await supabase.from('reviews').select('id', headOpts).eq('status', 'pending');
    const failedScrapes = await supabase.from('scrape_queue').select('id', headOpts).eq('status', 'failed');
    setCounts({
      claims: (c1.count || 0) + (c2.count || 0),
      dishes: dishes.count || 0,
      newRestaurants: newR.count || 0,
      reviews: reviews.count || 0,
      failedScrapes: failedScrapes.count || 0,
      emptyDishes: 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!cancelled) fetchCounts();
    return () => { cancelled = true; };
  }, [fetchCounts]);

  const loadItems = async (key: keyof QueueCounts) => {
    if (key === 'claims') {
      const { data } = await supabase
        .from('claim_requests')
        .select('id, restaurant_id, user_id, created_at, restaurants(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);
      setItems((p) => ({ ...p, claims: data || [] }));
    } else if (key === 'dishes') {
      const { data } = await supabase
        .from('restaurant_dishes')
        .select('id, restaurant_id, dish_id, created_at, dishes(name), restaurants(name)')
        .eq('status', 'suggested')
        .order('created_at', { ascending: false })
        .limit(20);
      setItems((p) => ({ ...p, dishes: data || [] }));
    } else if (key === 'reviews') {
      const { data } = await supabase
        .from('reviews')
        .select('id, restaurant_id, content, created_at, restaurants(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);
      setItems((p) => ({ ...p, reviews: data || [] }));
    } else if (key === 'newRestaurants') {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, address, created_at')
        .eq('is_active', false)
        .not('claimed_by_owner_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      setItems((p) => ({ ...p, newRestaurants: data || [] }));
    }
  };

  const toggleExpand = async (key: keyof QueueCounts) => {
    if (expanded === key) {
      setExpanded(null);
      setSelected(new Set());
      return;
    }
    setExpanded(key);
    setSelected(new Set());
    if (!items[key]) await loadItems(key);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = (key: keyof QueueCounts) => {
    const list = items[key] || [];
    setSelected(new Set(list.map((i: any) => i.id)));
  };

  const runBulk = async (key: keyof QueueCounts, action: 'approve' | 'reject') => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    try {
      if (key === 'claims') {
        const status = action === 'approve' ? 'approved' : 'rejected';
        const { error } = await supabase.from('claim_requests').update({ status }).in('id', ids);
        if (error) throw error;
      } else if (key === 'dishes') {
        const status = action === 'approve' ? 'approved_by_admin' : 'rejected';
        const { error } = await supabase.from('restaurant_dishes').update({ status }).in('id', ids);
        if (error) throw error;
      } else if (key === 'reviews') {
        const status = action === 'approve' ? 'published' as const : 'flagged' as const;
        const { error } = await supabase.from('reviews').update({ status }).in('id', ids);
        if (error) throw error;
      } else if (key === 'newRestaurants') {
        if (action === 'approve') {
          const { error } = await supabase.from('restaurants').update({ is_active: true }).in('id', ids);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('restaurants').update({ is_active: false, claim_status: 'disputed' as const }).in('id', ids);
          if (error) throw error;
        }
      }
      toast.success(`${ids.length} item(s) ${action === 'approve' ? 'goedgekeurd' : 'afgewezen'}`);
      setSelected(new Set());
      setItems((p) => ({ ...p, [key]: (p[key] || []).filter((i: any) => !ids.includes(i.id)) }));
      fetchCounts();
    } catch (e: any) {
      toast.error('Bulk-actie mislukt: ' + (e.message || ''));
    } finally {
      setBulkBusy(false);
    }
  };

  const labelFor = (key: keyof QueueCounts, item: any): string => {
    if (key === 'claims') return item.restaurants?.name || `Restaurant ${item.restaurant_id?.slice(0, 8)}`;
    if (key === 'dishes') return `${item.dishes?.name || 'Gerecht'} — ${item.restaurants?.name || ''}`;
    if (key === 'reviews') return `${item.restaurants?.name || ''}: ${(item.content || '').slice(0, 60)}`;
    if (key === 'newRestaurants') return `${item.name} — ${item.address || ''}`;
    return item.id;
  };

  const supportsBulk = (key: keyof QueueCounts) =>
    ['claims', 'dishes', 'reviews', 'newRestaurants'].includes(key);

  if (loading || !counts) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const total = QUEUES.reduce((sum, q) => sum + (counts[q.key] || 0), 0);

  return (
    <div className="space-y-4">
      <Card className={total === 0 ? 'border-green-500/30 bg-green-500/5' : 'border-primary/20'}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                {total === 0 ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <TrendingUp className="h-5 w-5 text-primary" />}
                Vandaag op de admin
              </CardTitle>
              <CardDescription className="mt-1">
                {total === 0
                  ? 'Alles is bijgewerkt. Geen actie vereist.'
                  : `${total} items wachten op je. Werk de wachtrijen hieronder af.`}
              </CardDescription>
            </div>
            {total > 0 && (
              <Badge variant="destructive" className="text-base px-3 py-1">{total}</Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {QUEUES.map((q) => {
          const count = counts[q.key] || 0;
          const Icon = q.icon;
          const isOpen = expanded === q.key;
          return (
            <div
              key={q.key}
              className={`rounded-lg border p-4 transition-colors ${toneClass(q.tone)} ${count === 0 ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-semibold truncate">{q.label}</span>
                </div>
                <Badge variant={count === 0 ? 'secondary' : q.tone === 'urgent' ? 'destructive' : 'default'}>
                  {count}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{q.description}</p>
              <div className="flex items-center justify-between gap-2 mt-3">
                <button
                  onClick={() => onNavigate(q.section)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open wachtrij <ArrowRight className="h-3 w-3" />
                </button>
                {supportsBulk(q.key) && count > 0 && (
                  <button
                    onClick={() => toggleExpand(q.key)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Bulk {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {expanded && supportsBulk(expanded) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">Bulk-acties: {QUEUES.find((q) => q.key === expanded)?.label}</CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => selectAll(expanded)} disabled={!items[expanded]?.length}>
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
              Toont de 20 oudste items in deze wachtrij. Voor volledige beheer, open de wachtrij.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!items[expanded] ? (
              <div className="py-6 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
            ) : items[expanded].length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Geen items.</p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {items[expanded].map((item: any) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                    <span className="flex-1 truncate">{labelFor(expanded, item)}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(item.created_at).toLocaleDateString('nl-NL')}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
