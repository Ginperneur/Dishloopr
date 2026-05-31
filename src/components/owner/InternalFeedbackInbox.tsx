import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Inbox, Check, Star, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Feedback {
  id: string; rating: number; comment: string | null; category: string | null;
  contact_email: string | null; is_resolved: boolean; created_at: string;
}

export function InternalFeedbackInbox({ restaurantId }: { restaurantId: string }) {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState<string>('');
  const feedbackLink = `${window.location.origin}/feedback/${restaurantId}`;

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('internal_feedback')
      .select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  useEffect(() => {
    QRCode.toDataURL(feedbackLink, { width: 320, margin: 1 }).then(setQrUrl).catch(() => {});
  }, [feedbackLink]);

  const resolve = async (id: string) => {
    await (supabase as any).from('internal_feedback').update({
      is_resolved: true, resolved_at: new Date().toISOString(),
    }).eq('id', id);
    toast.success('Gemarkeerd als opgelost');
    load();
  };

  const unresolved = items.filter(i => !i.is_resolved).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="h-5 w-5 text-primary" /> Interne gast-feedback
          {unresolved > 0 && <Badge variant="destructive" className="text-xs">{unresolved} nieuw</Badge>}
        </CardTitle>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><QrCode className="h-4 w-4 mr-1" />QR-code</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>QR voor interne feedback</DialogTitle></DialogHeader>
            <div className="flex flex-col items-center gap-3 py-2">
              {qrUrl && <img src={qrUrl} alt="QR" className="w-64 h-64" />}
              <p className="text-xs text-muted-foreground text-center break-all">{feedbackLink}</p>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(feedbackLink); toast.success('Link gekopieerd'); }}>
                Link kopiëren
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Plaats deze QR op tafels of de bon. Feedback komt rechtstreeks in jouw dashboard — niet publiek zichtbaar.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>
         ) : items.length === 0 ? (
          <OwnerEmptyState
            compact
            icon={Inbox}
            title="Geen feedback"
            description="Nog geen interne feedback ontvangen — gebruik de QR-code op tafel om gasten anoniem feedback te laten geven."
          />
        ) : (
          <ul className="space-y-2">
            {items.map((f) => (
              <li key={f.id} className={`rounded-md border p-3 ${f.is_resolved ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} className={`h-3.5 w-3.5 ${n <= f.rating ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString('nl-NL')}</span>
                    </div>
                    {f.comment && <p className="text-sm mt-1.5">{f.comment}</p>}
                    {f.contact_email && <p className="text-xs text-muted-foreground mt-1">📧 {f.contact_email}</p>}
                  </div>
                  {!f.is_resolved && (
                    <Button size="sm" variant="outline" onClick={() => resolve(f.id)}>
                      <Check className="h-4 w-4 mr-1" />Oplossen
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}