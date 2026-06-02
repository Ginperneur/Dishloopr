import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Share2 } from 'lucide-react';

interface Row { channel: string; views: number; clicks: number; conversions: number }

const CHANNEL_LABELS: Record<string, string> = {
  direct: 'Direct / onbekend',
  qr: 'QR-code',
  whatsapp: 'WhatsApp',
  copy: 'Gekopieerde link',
  share: 'Share-knop',
  email: 'E-mail',
  newsletter: 'Nieuwsbrief',
};

export function ChannelAttribution({ restaurantId, days = 30 }: { restaurantId: string; days?: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any).rpc('get_owner_attribution', {
        p_restaurant_id: restaurantId, p_days: days,
      });
      setRows(error ? [] : (data ?? []).map((r: any) => ({
        channel: r.channel,
        views: Number(r.views) || 0,
        clicks: Number(r.clicks) || 0,
        conversions: Number(r.conversions) || 0,
      })));
    })();
  }, [restaurantId, days]);

  if (rows === null) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Kanalen laden…</CardContent></Card>;
  }

  const maxConv = Math.max(1, ...rows.map(r => r.conversions));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Share2 className="h-5 w-5 text-primary" />
          Conversies per kanaal · {days} dagen
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nog geen kanaaldata. Gebruik UTM-tags op je QR / WhatsApp / share-links.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-xs text-muted-foreground uppercase tracking-wider pb-2 border-b">
              <span>Kanaal</span><span className="text-right">Views</span><span className="text-right">Clicks</span><span className="text-right">Conv.</span>
            </div>
            {rows.map(r => {
              const widthPct = (r.conversions / maxConv) * 100;
              return (
                <div key={r.channel} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium capitalize">{CHANNEL_LABELS[r.channel] ?? r.channel}</div>
                    <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.max(2, widthPct)}%` }} />
                    </div>
                  </div>
                  <span className="tabular-nums text-muted-foreground text-right">{r.views.toLocaleString('nl-NL')}</span>
                  <span className="tabular-nums text-muted-foreground text-right">{r.clicks.toLocaleString('nl-NL')}</span>
                  <span className="tabular-nums font-semibold text-right">{r.conversions.toLocaleString('nl-NL')}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}