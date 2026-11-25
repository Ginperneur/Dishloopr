import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VatTotal } from '@/components/common/VatTotal';
import { FOUNDING_MIN_MONTHS, TERM_MONTHS, euroCents, foundingWindowOpen, type TermMonths } from '@/lib/paidPricing';
import { CHECKOUT_ENABLED } from '@/lib/checkoutFlags';
import { toast } from 'sonner';

// collection_place_offers, collectie_page_status and place_collectie_bid are not in the generated types yet.
type UntypedRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
const rpc = (fn: string, args: Record<string, unknown>) => (supabase.rpc as unknown as UntypedRpc)(fn, args);

interface Offer {
  collection_slug: string; title: string; page_slug: string; is_national: boolean; city_name: string | null;
  for_sale: boolean; can_buy: boolean; list_price_cents: number; founding_price_cents: number; places_left: number; holds_place: boolean;
}
interface PageStatus {
  list_price_cents: number; open_bids: number; highest_bid_cents: number | null; next_auction: string;
  my_bid: { status: 'open' | 'won'; amount_cents: number; clearing_cents: number | null } | null;
}

/** Buy (or bid on) a paid place in one collection: in the restaurant's city or across the Netherlands. */
export function CollectionPlaceDialog({ restaurantId, collectionSlug, title, open, onOpenChange }: {
  restaurantId: string; collectionSlug: string; title: string; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const promo = foundingWindowOpen();
  const [pageSlug, setPageSlug] = useState<string>('');
  const [term, setTerm] = useState<TermMonths>(FOUNDING_MIN_MONTHS);
  const [busy, setBusy] = useState(false);
  const [bidEuro, setBidEuro] = useState('');

  const offers = useQuery({
    queryKey: ['collection-place-offers', restaurantId],
    queryFn: async () => {
      const { data, error } = await rpc('collection_place_offers', { p_restaurant: restaurantId });
      if (error) throw error;
      return (data ?? []) as Offer[];
    },
    enabled: open,
  });
  const pages = (offers.data ?? []).filter(o => o.collection_slug === collectionSlug);
  const sel = pages.find(p => p.page_slug === pageSlug) ?? pages.find(p => !p.is_national && p.for_sale) ?? pages[0];
  const founding = promo && term >= FOUNDING_MIN_MONTHS;

  const status = useQuery({
    queryKey: ['collection-place-status', sel?.page_slug, restaurantId],
    queryFn: async () => {
      const { data, error } = await rpc('collectie_page_status', { p_page_slug: sel!.page_slug, p_restaurant: restaurantId });
      if (error) throw error;
      return data as PageStatus;
    },
    enabled: open && Boolean(sel?.for_sale) && !founding,
    retry: false,
  });
  const othersWaiting = (status.data?.open_bids ?? 0) - (status.data?.my_bid?.status === 'open' ? 1 : 0) > 0;
  const mustBid = !founding && status.data?.my_bid?.status !== 'won' && (sel?.places_left === 0 || othersWaiting);
  const monthCents = !sel ? null
    : status.data?.my_bid?.status === 'won' && status.data.my_bid.clearing_cents ? status.data.my_bid.clearing_cents
    : founding ? sel.founding_price_cents : sel.list_price_cents;

  const checkout = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-package-checkout', {
        body: { option: 'collectie_month', restaurant_id: restaurantId, page_slug: sel.page_slug, months: promo ? term : 1 },
      });
      const message = data?.error ?? (error ? await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.().then(b => b?.error).catch(() => null) : null);
      if (message || error || !data?.url) throw new Error(message || 'Geen checkout ontvangen');
      window.location.href = data.url;
    } catch (e) {
      toast.error('Afrekenen lukte niet', { description: e instanceof Error ? e.message : undefined });
      setBusy(false);
    }
  };

  const placeBid = async () => {
    const cents = Math.round(Number(bidEuro.replace(',', '.')) * 100);
    if (!sel || !Number.isFinite(cents) || cents <= 0) { toast.error('Vul een bedrag in euro in.'); return; }
    const { error } = await rpc('place_collectie_bid', { p_page_slug: sel.page_slug, p_restaurant: restaurantId, p_amount_cents: cents });
    if (error) { toast.error(error.message); return; }
    toast.success('Bod geplaatst. Komt er een plek vrij of wint je bod bij de veiling, dan krijg je bericht.');
    setBidEuro('');
    status.refetch();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Collectieplek in {title}</DialogTitle>
          <DialogDescription>
            Bovenaan de collectie, in het blok Uitgelicht, gemarkeerd als betaald. Maximaal 3 per collectie per stad, en 3 voor heel Nederland.
          </DialogDescription>
        </DialogHeader>

        {offers.isPending ? <p className="text-sm text-muted-foreground">Even laden…</p> : pages.length === 0 ? (
          <p className="text-sm">Je restaurant hoort (nog) niet bij deze collectie.</p>
        ) : (
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Waar?</legend>
              {pages.map(p => (
                <label key={p.page_slug} className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-2 ${sel?.page_slug === p.page_slug ? 'border-primary bg-primary/10' : ''} ${!p.for_sale || !p.can_buy || p.holds_place ? 'opacity-60' : ''}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="collection-page" className="h-4 w-4" checked={sel?.page_slug === p.page_slug}
                      disabled={!p.for_sale || !p.can_buy || p.holds_place} onChange={() => setPageSlug(p.page_slug)} />
                    <span>
                      <span className="block text-sm font-medium">{p.is_national ? 'Heel Nederland' : p.city_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {p.holds_place ? 'Je hebt hier al een plek'
                          : !p.for_sale ? 'Nog geen plekken te koop (vanaf 10 restaurants)'
                          : !p.can_buy ? 'Voeg eerst een foto toe'
                          : p.places_left === 0 ? 'Vol, je kunt bieden' : `Nog ${p.places_left} van de 3 plekken vrij`}
                      </span>
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">{euroCents(founding ? p.founding_price_cents : p.list_price_cents)} p/m</span>
                </label>
              ))}
            </fieldset>

            {promo && (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">Looptijd</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Looptijd">
                  {TERM_MONTHS.map(t => (
                    <button key={t} type="button" role="radio" aria-checked={term === t} onClick={() => setTerm(t)}
                      className={`min-h-14 rounded-xl border px-3 py-2 text-left text-sm ${term === t ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted'}`}>
                      <span className="block font-semibold">{t === 1 ? '1 maand' : `${t} maanden`}</span>
                      {t >= FOUNDING_MIN_MONTHS && <span className="mt-1 inline-block rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-950">Founding Partner</span>}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {founding
                    ? `Founding Partner-prijs tot en met 31 december 2027. Minimaal ${term} maanden, daarna per maand opzegbaar.`
                    : `Korter dan ${FOUNDING_MIN_MONTHS} maanden: je betaalt de normale prijs en wordt geen Founding Partner.${term > 1 ? ` Minimaal ${term} maanden, daarna per maand opzegbaar.` : ' Per maand opzegbaar.'}`}
                </p>
              </fieldset>
            )}

            {sel && monthCents != null && !mustBid && (
              <>
                <p className="text-sm">Prijs: <strong>{euroCents(monthCents)}</strong> per maand excl. btw</p>
                <VatTotal exCents={monthCents} per="per maand" />
              </>
            )}

            {mustBid ? (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm">{status.data?.my_bid?.status === 'open'
                  ? `Je staat op de wachtlijst met ${euroCents(status.data.my_bid.amount_cents)} per maand excl. btw.`
                  : 'Deze collectie is hier vol of er wachten al bieders. Bied wat je maximaal per maand wilt betalen, excl. btw.'}</p>
                <p className="text-xs text-muted-foreground">
                  Elk kwartaal is er een veiling: de hoogste bieders krijgen de plekken en betalen allemaal het hoogste bod dat net niet won, minimaal de lijstprijs.
                  {status.data?.next_auction && ` Volgende veiling: ${new Date(status.data.next_auction).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}.`}
                </p>
                <div className="flex gap-2">
                  <Input inputMode="decimal" placeholder={status.data ? `Minimaal ${euroCents(status.data.list_price_cents)}` : 'Bedrag per maand'}
                    value={bidEuro} onChange={e => setBidEuro(e.target.value)} className="min-h-11" aria-label="Je bod per maand in euro" />
                  <Button variant="outline" className="min-h-11" disabled={!bidEuro} onClick={placeBid}>Bied</Button>
                </div>
              </div>
            ) : (
              <Button className="min-h-11 w-full" onClick={checkout}
                disabled={!CHECKOUT_ENABLED.packages || busy || !sel || !sel.for_sale || !sel.can_buy || sel.holds_place || (founding && sel.places_left === 0)}>
                {busy ? 'Even geduld…' : status.data?.my_bid?.status === 'won' ? 'Rond je gewonnen plek af' : 'Verder naar betalen'}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Je betaalt direct bij het afrekenen; je plek staat meteen live. Je plek in de ranglijst eronder verandert er niet door.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
