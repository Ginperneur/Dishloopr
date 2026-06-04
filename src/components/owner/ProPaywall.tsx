import { Crown, Check, Loader2, ArrowRight, Sparkles, BarChart3, TrendingUp, Eye, MousePointerClick, Users, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useOwnerProCheckout } from '@/hooks/useOwnerProCheckout';

interface ProPaywallProps {
  /** What feature the user is trying to access (e.g. "Inzichten & Analytics"). */
  featureName: string;
  /** Short intro line shown under the title. */
  description: string;
  /** Bullet list of concrete benefits the user unlocks. */
  benefits: string[];
  /** Which visual preview mock to show next to the benefits. */
  previewVariant?: 'insights' | 'market';
}

/**
 * Full-section paywall shown when a non-Pro owner navigates to a Pro-only tab.
 * Replaces the gated content entirely (no blurred preview) so the value prop
 * and CTA are the only thing on screen.
 */
export function ProPaywall({ featureName, description, benefits, previewVariant = 'insights' }: ProPaywallProps) {
  const { startCheckout, loading } = useOwnerProCheckout();

  return (
    <Card className="overflow-hidden border-primary/30">
      {/* Hero band */}
      <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-background border-b border-primary/20 p-6 md:p-10">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
             style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 shrink-0">
            <Crown className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-bold uppercase tracking-wider mb-2">
              <Sparkles className="h-3 w-3" />
              Owner Pro
            </div>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight mb-1">
              {featureName}
            </h2>
            <p className="text-muted-foreground text-sm md:text-base">{description}</p>
          </div>
        </div>
      </div>

      <CardContent className="p-6 md:p-10">
        <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-start">
          {/* Benefits */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Wat krijg je?
            </p>
            <ul className="space-y-3">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Visual preview */}
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Voorbeeldweergave
            </p>
            <div className="relative rounded-xl border bg-muted/30 p-4 overflow-hidden">
              {previewVariant === 'insights' ? <InsightsPreview /> : <MarketPreview />}
              {/* Glass shimmer overlay to hint it's locked */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
              <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Ontgrendel met Pro
              </div>
            </div>
          </div>
        </div>

        {/* Pricing CTA row */}
        <div className="mt-8 pt-6 border-t">
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => startCheckout('monthly')}
              disabled={loading !== null}
              className="group relative rounded-xl border-2 border-primary bg-primary text-primary-foreground p-4 text-left transition hover:shadow-lg hover:shadow-primary/20 disabled:opacity-60"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider opacity-90">Maandelijks</span>
                <span className="text-[10px] font-bold uppercase bg-primary-foreground/20 px-1.5 py-0.5 rounded">Populair</span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-bold">€29</span>
                <span className="text-xs opacity-80">/maand</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold opacity-95">
                {loading === 'monthly' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Crown className="h-3.5 w-3.5" />
                )}
                Start nu
                <ArrowRight className="h-3.5 w-3.5 ml-auto transition group-hover:translate-x-0.5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => startCheckout('yearly')}
              disabled={loading !== null}
              className="group relative rounded-xl border-2 border-border bg-card p-4 text-left transition hover:border-primary/50 disabled:opacity-60"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Jaarlijks</span>
                <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">2 mnd gratis</span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-bold">€290</span>
                <span className="text-xs text-muted-foreground">/jaar</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                {loading === 'yearly' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Bespaar €58
                <ArrowRight className="h-3.5 w-3.5 ml-auto transition group-hover:translate-x-0.5" />
              </div>
            </button>
          </div>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            Direct toegang na betaling • Maandelijks opzegbaar • Veilig betalen via Stripe
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Visual preview mocks (no real data — pure illustration) ---------- */

function MiniStat({ icon: Icon, label, value, trend }: { icon: any; label: string; value: string; trend: string }) {
  return (
    <div className="bg-card border rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-bold">{value}</div>
      <div className="text-[10px] text-primary font-semibold">{trend}</div>
    </div>
  );
}

function InsightsPreview() {
  const bars = [40, 65, 55, 80, 70, 90, 75];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MiniStat icon={Eye} label="Weergaven" value="2.847" trend="+18%" />
        <MiniStat icon={MousePointerClick} label="Kliks" value="412" trend="+24%" />
      </div>
      <div className="bg-card border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-muted-foreground">7 dagen</span>
          <span className="text-[10px] text-primary font-semibold inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> +12%
          </span>
        </div>
        <div className="flex items-end gap-1 h-16">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-gradient-to-t from-primary/40 to-primary"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketPreview() {
  const rows = [
    { name: 'Jouw restaurant', rating: 4.6, you: true, w: 92 },
    { name: 'Concurrent A', rating: 4.3, w: 78 },
    { name: 'Concurrent B', rating: 4.1, w: 68 },
    { name: 'Concurrent C', rating: 3.9, w: 58 },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MiniStat icon={Users} label="Buurt-positie" value="#1" trend="van 12" />
        <MiniStat icon={Star} label="Rating-diff" value="+0.3" trend="boven gem." />
      </div>
      <div className="bg-card border rounded-lg p-3 space-y-1.5">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className={`text-[10px] w-24 truncate ${r.you ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
              {r.name}
            </span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${r.you ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                style={{ width: `${r.w}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold tabular-nums w-6 text-right">{r.rating}</span>
          </div>
        ))}
      </div>
    </div>
  );
}