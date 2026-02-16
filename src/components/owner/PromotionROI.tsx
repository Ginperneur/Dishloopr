import { TrendingUp, DollarSign, Eye, MousePointer, Crown, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PromotionROIData } from '@/hooks/useMarketInsights';

interface PromotionROIProps {
  promotions: PromotionROIData[];
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  active: { label: 'Actief', variant: 'default' },
  expired: { label: 'Verlopen', variant: 'secondary' },
  cancelled: { label: 'Geannuleerd', variant: 'destructive' },
  cooling_off: { label: 'Pauze', variant: 'outline' },
  pending_payment: { label: 'Wacht op betaling', variant: 'outline' },
};

export function PromotionROI({ promotions }: PromotionROIProps) {
  if (promotions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Geen promoties gevonden.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ga naar de Sponsoring tab om je eerste promotie te starten.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalSpent = promotions.reduce((s, p) => s + p.totalSpent, 0);
  const totalViews = promotions.reduce((s, p) => s + p.totalViews, 0);
  const totalClicks = promotions.reduce((s, p) => s + p.totalClicks, 0);
  const avgCTR = totalViews > 0 ? ((totalClicks / totalViews) * 100) : 0;
  const avgCPC = totalClicks > 0 ? totalSpent / totalClicks : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Totaal uitgegeven</p>
            <span className="text-xl font-bold">€{totalSpent.toFixed(0)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Totale weergaven</p>
            <span className="text-xl font-bold">{totalViews.toLocaleString('nl-NL')}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MousePointer className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Totale clicks</p>
            <span className="text-xl font-bold">{totalClicks.toLocaleString('nl-NL')}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Gem. CTR</p>
            <span className="text-xl font-bold">{avgCTR.toFixed(1)}%</span>
          </CardContent>
        </Card>
      </div>

      {/* Promotion Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Promotie Overzicht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {promotions.map((promo, i) => {
            const statusInfo = STATUS_MAP[promo.status] || { label: promo.status, variant: 'outline' as const };
            const Icon = promo.type === 'featured' ? Crown : Sparkles;

            return (
              <div key={i} className="p-3 rounded-lg border bg-card">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm truncate">{promo.label}</span>
                  </div>
                  <Badge variant={statusInfo.variant} className="text-xs shrink-0">
                    {statusInfo.label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Uitgegeven</p>
                    <p className="font-medium">€{promo.totalSpent.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Weergaven</p>
                    <p className="font-medium">{promo.totalViews.toLocaleString('nl-NL')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Clicks</p>
                    <p className="font-medium">{promo.totalClicks.toLocaleString('nl-NL')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Kosten/click</p>
                    <p className="font-medium">
                      {promo.costPerClick > 0 ? `€${promo.costPerClick.toFixed(2)}` : '–'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(promo.startDate).toLocaleDateString('nl-NL')} – {new Date(promo.endDate).toLocaleDateString('nl-NL')}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
