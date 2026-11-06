import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Loader2, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QRCodeGenerator } from './QRCodeGenerator';

// restaurant_menus and publish_restaurant_menu (migration 20261106200000) are not in the generated types yet.
const db = supabase as any;

/**
 * Menuservice for the owner: the import runs by itself after payment; the owner
 * checks the translated menu, publishes it and then gets the QR code and widget.
 * If the import failed, the owner can paste a link to the menu and retry.
 */
export function MenuServiceStatus({ restaurantId, restaurantSlug, restaurantName }: { restaurantId: string; restaurantSlug: string; restaurantName: string }) {
  const queryClient = useQueryClient();
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<'retry' | 'publish' | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: menu } = useQuery({
    queryKey: ['owner-menu-service', restaurantId],
    queryFn: async () => {
      const { data } = await db.from('restaurant_menus').select('status, error, items, source_url').eq('restaurant_id', restaurantId).maybeSingle();
      return data as { status: string; error: string | null; items: unknown[]; source_url: string | null } | null;
    },
    // Poll while the import is running.
    refetchInterval: q => ((q.state.data as { status?: string } | null)?.status === 'processing' ? 5000 : false),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['owner-menu-service', restaurantId] });
  const menuUrl = `https://dishloopr.com/menu/${restaurantSlug}`;
  const embedCode = `<iframe src="${menuUrl}?embed=1" title="Menukaart ${restaurantName}" style="width:100%;min-height:700px;border:0" loading="lazy"></iframe>`;

  const retry = async () => {
    setBusy('retry');
    const { data, error } = await supabase.functions.invoke('run-menu-service', { body: { restaurant_id: restaurantId, source_url: link.trim() || undefined } });
    setBusy(null);
    refresh();
    if (error || data?.status === 'failed') toast.error('Importeren lukte niet', { description: data?.error ?? error?.message });
    else toast.success('Je menukaart staat klaar om te controleren');
  };

  const publish = async () => {
    setBusy('publish');
    const { error } = await db.rpc('publish_restaurant_menu', { p_restaurant_id: restaurantId });
    setBusy(null);
    if (error) { toast.error('Live zetten lukte niet', { description: error.message }); return; }
    toast.success('Je menukaart staat live');
    refresh();
    queryClient.invalidateQueries({ queryKey: ['owner-packages', restaurantId] });
  };

  const copyEmbed = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const status = menu?.status ?? 'processing';
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <UtensilsCrossed className="mt-0.5 h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="font-medium">Menuservice</p>
          {status === 'processing' && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />We zetten je menukaart online en vertalen hem. Dit duurt meestal een paar minuten.</p>}
          {status === 'awaiting_owner' && <p className="text-sm text-muted-foreground">Je menukaart staat klaar, met {menu?.items.length ?? 0} gerechten in het Nederlands, Engels, Duits en Frans. Kijk of alles klopt en zet hem live.</p>}
          {status === 'published' && <p className="text-sm text-muted-foreground">Je menukaart staat live op <a className="text-primary underline" href={menuUrl} target="_blank" rel="noopener noreferrer">dishloopr.com/menu/{restaurantSlug}</a>.</p>}
          {status === 'failed' && <p className="text-sm text-destructive">{menu?.error ?? 'Importeren lukte niet.'} Plak hieronder een link naar je menukaart, of wacht: wij helpen binnen 3 werkdagen.</p>}
        </div>
      </div>

      {status === 'awaiting_owner' && (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11"><Link to={`/menu/${restaurantSlug}`} target="_blank">Bekijk je menukaart</Link></Button>
          <Button className="min-h-11" disabled={busy !== null} onClick={publish}>{busy === 'publish' ? 'Even geduld…' : 'Klopt, zet live'}</Button>
        </div>
      )}

      {(status === 'failed' || status === 'awaiting_owner') && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={link} onChange={e => setLink(e.target.value)} placeholder="Link naar je menu: webpagina, PDF of foto" aria-label="Link naar je menukaart" className="min-h-11" />
          <Button variant="outline" className="min-h-11 shrink-0" disabled={busy !== null || (status === 'failed' && !link.trim() && !menu?.source_url)} onClick={retry}>
            {busy === 'retry' ? 'Bezig…' : status === 'failed' ? 'Opnieuw proberen' : 'Opnieuw importeren'}
          </Button>
        </div>
      )}

      {status === 'published' && (
        <div className="grid gap-4 md:grid-cols-2">
          <QRCodeGenerator restaurantSlug={restaurantSlug} restaurantName={restaurantName} url={`${menuUrl}?utm_source=qr`}
            title="QR-code voor je menukaart" caption="Scan voor de menukaart"
            description="Print hem op tafel of bij de ingang. Gasten zien je menukaart in hun eigen taal." />
          <div className="space-y-2">
            <p className="text-sm font-medium">Widget voor je eigen website</p>
            <p className="text-xs text-muted-foreground">Plak deze code op je website. Pas je de menukaart hier aan, dan verandert hij daar ook.</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">{embedCode}</pre>
            <Button variant="outline" size="sm" onClick={copyEmbed}>{copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}{copied ? 'Gekopieerd' : 'Kopieer code'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
