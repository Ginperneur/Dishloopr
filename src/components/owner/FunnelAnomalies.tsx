import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, TrendingUp, ShieldCheck, Loader2, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AnomalyRow {
  metric: string;
  current_value: number;
  previous_value: number;
  delta_pct: number;
  severity: 'critical' | 'warning' | 'ok' | 'none';
}

const METRIC_LABEL: Record<string, { label: string; suffix?: string; advice: string }> = {
  views: {
    label: 'Profielweergaven',
    advice: 'Boost zichtbaarheid: deel je restaurant via social, refresh openingsuren of overweeg een Featured-plek.',
  },
  clicks: {
    label: 'Klikken',
    advice: 'Check of CTA-knoppen (website, telefoon, reserveren) up-to-date zijn en goed zichtbaar staan.',
  },
  conversions: {
    label: 'Conversies (reserveer / bel / website)',
    advice: 'Voeg een reserveerlink toe, controleer telefoonnummer en zorg voor sterke menu-foto’s.',
  },
  conversion_rate: {
    label: 'Conversieratio',
    suffix: '%',
    advice: 'Bezoekers haken af — verbeter de pagina met sterke openingstekst, signatuur-gerechten en duidelijke CTA’s.',
  },
  avg_review_rating: {
    label: 'Gem. review-score (30d)',
    advice: 'Reageer snel op recente negatieve reviews en check Review-intelligence voor terugkerende klachten.',
  },
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-destructive/40 bg-destructive/5',
  warning: 'border-amber-500/40 bg-amber-500/5',
  ok: 'border-emerald-500/30 bg-emerald-500/5',
  none: 'border-muted bg-muted/30',
};

const SEVERITY_BADGE: Record<string, { label: string; variant: any }> = {
  critical: { label: 'Kritiek', variant: 'destructive' },
  warning: { label: 'Aandacht', variant: 'secondary' },
  ok: { label: 'Stabiel', variant: 'outline' },
  none: { label: 'Geen data', variant: 'outline' },
};

interface Props {
  restaurantId: string;
}

export function FunnelAnomalies({ restaurantId }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AnomalyRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (supabase.rpc as any)('get_owner_funnel_anomalies', { p_restaurant_id: restaurantId })
      .then(({ data, error }: any) => {
        if (cancelled) return;
        if (error) {
          console.error('Anomalies error', error);
          setRows([]);
        } else {
          setRows((data ?? []) as AnomalyRow[]);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const alerts = rows.filter((r) => r.severity === 'critical' || r.severity === 'warning');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" />
          Funnel-alerts (afgelopen 7 dagen vs. de week ervoor)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Anomalieën berekenen…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nog te weinig data om te vergelijken.</p>
        ) : alerts.length === 0 ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium">Geen significante dalingen.</p>
              <p className="text-xs text-muted-foreground">Alle kerncijfers zijn stabiel of stijgend.</p>
            </div>
          </div>
        ) : (
          alerts.map((r) => {
            const cfg = METRIC_LABEL[r.metric] ?? { label: r.metric, advice: '' };
            const sev = SEVERITY_BADGE[r.severity];
            const TrendIcon = r.delta_pct < 0 ? TrendingDown : TrendingUp;
            return (
              <div
                key={r.metric}
                className={`p-3 rounded-lg border ${SEVERITY_STYLES[r.severity]}`}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={`h-4 w-4 ${r.severity === 'critical' ? 'text-destructive' : 'text-amber-600'}`}
                    />
                    <span className="font-medium text-sm">{cfg.label}</span>
                  </div>
                  <Badge variant={sev.variant} className="text-xs shrink-0">
                    {sev.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendIcon className={`h-3.5 w-3.5 ${r.delta_pct < 0 ? 'text-destructive' : 'text-emerald-600'}`} />
                  <span>
                    {r.previous_value}
                    {cfg.suffix ?? ''} → <span className="font-semibold text-foreground">{r.current_value}{cfg.suffix ?? ''}</span>
                  </span>
                  <span className={r.delta_pct < 0 ? 'text-destructive' : 'text-emerald-600'}>
                    ({r.delta_pct > 0 ? '+' : ''}{r.delta_pct}%)
                  </span>
                </div>
                {cfg.advice && <p className="text-xs text-muted-foreground">{cfg.advice}</p>}
              </div>
            );
          })
        )}

        {!loading && rows.length > 0 && alerts.length > 0 && (
          <p className="text-xs text-muted-foreground pt-1">
            Stabiele metrics ({rows.length - alerts.length}) zijn verborgen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
