import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  FileText, UtensilsCrossed, Store, MessageSquare, AlertTriangle,
  TrendingUp, ArrowRight, Loader2, CheckCircle2,
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
  { key: 'emptyDishes', label: 'Restaurants zonder gerechten', description: 'Menu-scrape nodig', icon: AlertTriangle, section: 'empty-dishes', tone: 'info' },
  { key: 'failedScrapes', label: 'Mislukte scrapes', description: 'Handmatig menu of opnieuw proberen', icon: AlertTriangle, section: 'menu-scraper', tone: 'info' },
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c1, c2, dishes, newR, reviews, failedScrapes, emptyDishes] = await Promise.all([
        supabase.from('restaurant_claims').select('id', { count: 'exact', head: true }).in('status', ['pending', 'email_verified', 'phone_verified']),
        supabase.from('claim_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('restaurant_dishes').select('id', { count: 'exact', head: true }).eq('status', 'suggested'),
        supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', false).not('claimed_by_owner_id', 'is', null),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('scrape_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('dish_count', 0),
      ]);
      if (cancelled) return;
      setCounts({
        claims: (c1.count || 0) + (c2.count || 0),
        dishes: dishes.count || 0,
        newRestaurants: newR.count || 0,
        reviews: reviews.count || 0,
        failedScrapes: failedScrapes.count || 0,
        emptyDishes: emptyDishes.count || 0,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

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
          return (
            <button
              key={q.key}
              onClick={() => onNavigate(q.section)}
              className={`text-left rounded-lg border p-4 transition-colors ${toneClass(q.tone)} ${count === 0 ? 'opacity-60' : ''}`}
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
              <div className="flex items-center gap-1 text-xs text-primary mt-3">
                Open wachtrij <ArrowRight className="h-3 w-3" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
