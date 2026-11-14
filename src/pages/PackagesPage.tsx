import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, BookOpen, CalendarDays, Check, Crown, Store } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sendAnalyticsEvent } from '@/lib/cookieConsent';
import { toast } from 'sonner';
import { CHECKOUT_ENABLED } from '@/lib/checkoutFlags';
import { OWNER_PRO_PRICES } from '@/lib/proPricing';
import { useOwnerProCheckout } from '@/hooks/useOwnerProCheckout';
import { Input } from '@/components/ui/input';
import { formatEuroCents } from '@/lib/promoSlots';

type PackageOption = 'founding_month' | 'founding_year' | 'menu_once' | 'menu_month';

// Founding Partner-actie: wie Uitgelicht koopt van nu tot en met dit einde van
// de actie wordt Founding Partner. Zelfde datum als
// create-package-checkout's FOUNDING_WINDOW_END, hier alleen voor de copy.
const FOUNDING_WINDOW_END = new Date('2027-01-05T23:59:59+01:00');
function foundingWindowOpen() { return new Date() <= FOUNDING_WINDOW_END; }

function track(pkg: string) { sendAnalyticsEvent('click_package', { package: pkg }); }

type Billing = 'month' | 'year';

function Features({ items, inverted }: { items: string[]; inverted?: boolean }) {
  return (
    <ul className="space-y-3 text-sm flex-1">
      {items.map(i => (
        <li key={i} className="flex gap-2.5">
          <Check className={`h-4 w-4 mt-0.5 shrink-0 ${inverted ? 'text-primary-foreground' : 'text-primary'}`} aria-hidden="true" />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}

/** Pantrics-style per-card switch; both labels are clickable and the switch is labelled for screen readers. */
function BillingToggle({ value, onChange, left = 'Maandelijks', right = 'Jaarlijks', hint, inverted, id }: {
  value: Billing; onChange: (v: Billing) => void; left?: string; right?: string; hint?: string; inverted?: boolean; id: string;
}) {
  const label = (active: boolean) => `text-sm font-medium transition-colors ${active ? '' : inverted ? 'text-primary-foreground/70' : 'text-muted-foreground'}`;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={`min-h-11 ${label(value === 'month')}`} onClick={() => onChange('month')}>{left}</button>
      <Switch id={id} checked={value === 'year'} onCheckedChange={c => onChange(c ? 'year' : 'month')} aria-label={`${right} betalen`}
        className={inverted ? 'data-[state=checked]:bg-primary-foreground/30 data-[state=unchecked]:bg-primary-foreground/20' : ''} />
      <button type="button" className={`min-h-11 ${label(value === 'year')}`} onClick={() => onChange('year')}>{right}</button>
      {hint && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${inverted ? 'bg-primary-foreground/20' : 'bg-primary/15 text-primary'}`}>{hint}</span>}
    </div>
  );
}

function BigPrice({ amount, per, was, note, inverted }: { amount: string; per: string; was?: string; note?: string; inverted?: boolean }) {
  return (
    <div className="min-h-[104px]">
      {was && <p className={`text-sm line-through ${inverted ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{was}</p>}
      <p className="flex items-baseline gap-1.5">
        <span className="font-display text-5xl font-bold tracking-tight">{amount}</span>
        <span className={`text-sm ${inverted ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{per}</span>
      </p>
      {note && <p className={`mt-1 text-sm ${inverted ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>{note}</p>}
    </div>
  );
}

function Card({ highlight, badge, children }: { highlight?: boolean; badge?: string; children: React.ReactNode }) {
  return (
    <div className={`relative flex flex-col gap-6 rounded-3xl p-7 ${highlight
      ? 'bg-gradient-to-br from-primary via-primary to-amber-500 text-primary-foreground shadow-xl shadow-primary/20 xl:-my-4 xl:py-11'
      : 'border bg-card'}`}>
      {badge && (
        <span className="absolute -top-3 right-6 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-950 shadow">{badge}</span>
      )}
      {children}
    </div>
  );
}

const CardLabel = ({ icon: Icon, children }: { icon: typeof Check; children: React.ReactNode }) => (
  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em]"><Icon className="h-5 w-5" aria-hidden="true" />{children}</h2>
);

const euro = (n: number) => `€${n.toLocaleString('nl-NL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export default function PackagesPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const paramSlug = params.get('slug') || '';

  useEffect(() => { sendAnalyticsEvent('view_packages', {}); }, []);

  const { data: restaurant } = useQuery({
    queryKey: ['packages-restaurant', paramSlug, user?.id],
    queryFn: async () => {
      let q = supabase.from('restaurants').select('id, slug, name').eq('is_active', true).limit(1);
      q = paramSlug ? q.eq('slug', paramSlug) : q.eq('claimed_by_owner_id', user!.id);
      const { data } = await q.maybeSingle();
      return data;
    },
    enabled: Boolean(paramSlug || user),
  });

  const { data: pages = [] } = useQuery({
    queryKey: ['packages-pages', restaurant?.slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('restaurant_positions', { p_slug: restaurant!.slug });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(restaurant?.slug),
  });

  const [founding, setFounding] = useState<null | Billing>(null);
  const [pageSlug, setPageSlug] = useState('');
  const [busy, setBusy] = useState<PackageOption | null>(null);

  const { data: placesLeft } = useQuery({
    queryKey: ['founding-places-left', pageSlug],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('founding_places_left', { p_page_slug: pageSlug });
      if (error) throw error;
      return data as number;
    },
    enabled: Boolean(pageSlug),
  });

  // After the Founding Partner window: price per page by demand, and bids when a page is full.
  const afterWindow = !foundingWindowOpen();
  const { data: pagePrice } = useQuery({
    queryKey: ['uitgelicht-price', pageSlug],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('uitgelicht_list_price', { p_page_slug: pageSlug });
      if (error) throw error;
      return data as number;
    },
    enabled: Boolean(pageSlug) && afterWindow,
  });
  const { data: pageStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['uitgelicht-status', pageSlug, restaurant?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('uitgelicht_page_status', { p_page_slug: pageSlug, p_restaurant: restaurant!.id });
      if (error) throw error;
      return data as { open_bids: number; highest_bid_cents: number | null; next_auction: string;
        my_bid: { status: 'open' | 'won'; amount_cents: number; clearing_cents: number | null } | null };
    },
    enabled: Boolean(pageSlug && restaurant?.id && user) && afterWindow,
    retry: false,
  });
  const [bidEuro, setBidEuro] = useState('');
  const othersWaiting = (pageStatus?.open_bids ?? 0) - (pageStatus?.my_bid?.status === 'open' ? 1 : 0) > 0;
  const mustBid = afterWindow && pageStatus?.my_bid?.status !== 'won' && (placesLeft === 0 || othersWaiting);
  const placeBid = async () => {
    const cents = Math.round(Number(bidEuro.replace(',', '.')) * 100);
    if (!restaurant || !Number.isFinite(cents) || cents <= 0) { toast.error('Vul een bedrag in euro in.'); return; }
    const { error } = await (supabase.rpc as any)('place_uitgelicht_bid', { p_page_slug: pageSlug, p_restaurant: restaurant.id, p_amount_cents: cents });
    if (error) { toast.error(error.message); return; }
    toast.success('Bod geplaatst. Komt er een plek vrij of wint je bod bij de veiling, dan krijg je bericht.');
    setBidEuro('');
    refetchStatus();
  };

  // Founding Partner and Menuservice go through create-package-checkout, which
  // checks verified ownership and the 5-per-page cap; payment is taken at checkout.
  const startPackage = async (option: PackageOption, page?: string) => {
    track(option);
    if (!restaurant) { toast.info('Claim eerst je restaurant of log in.'); return; }
    setBusy(option);
    try {
      const { data, error } = await supabase.functions.invoke('create-package-checkout', {
        body: { option, restaurant_id: restaurant.id, page_slug: page },
      });
      const message = data?.error ?? (error ? await error.context?.json?.().then((b: any) => b?.error).catch(() => null) : null);
      if (message || error || !data?.url) throw new Error(message || 'Geen checkout ontvangen');
      window.location.href = data.url;
    } catch (e) {
      toast.error('Afrekenen lukte niet', { description: e instanceof Error ? e.message : undefined });
      setBusy(null);
    }
  };

  const { startCheckout: startPro, loading: proLoading } = useOwnerProCheckout();

  const [uitBilling, setUitBilling] = useState<Billing>('month');
  const [proBilling, setProBilling] = useState<Billing>('month');
  const [menuBilling, setMenuBilling] = useState<Billing>('month');
  const promo = foundingWindowOpen();
  const uit = promo
    ? (uitBilling === 'month'
      ? { amount: '€59', per: 'per maand', was: 'Normaal €99 per maand', note: 'Je bespaart €480 per jaar.' }
      : { amount: '€590', per: 'per jaar', was: 'Normaal €990 per jaar', note: `Dat is ${euro(590 / 12)} per maand, je bespaart €400 per jaar.` })
    : { amount: 'vanaf €99', per: 'per maand', note: 'De prijs per gerechtpagina hangt af van de vraag. Pagina vol? Dan bied je mee.' };
  const pro = proBilling === 'month'
    ? { amount: `€${OWNER_PRO_PRICES.monthly.amount}`, per: 'per maand', note: `Of €${OWNER_PRO_PRICES.yearly.amount} per jaar, 2 maanden gratis.` }
    : { amount: `€${OWNER_PRO_PRICES.yearly.amount}`, per: 'per jaar', was: `${euro(OWNER_PRO_PRICES.monthly.amount * 12)} per jaar`, note: `Dat is ${euro(OWNER_PRO_PRICES.yearly.amount / 12)} per maand, 2 maanden gratis.` };
  const needLogin = () => toast.info('Log eerst in met je eigenaarsaccount.');

  const claimTo = restaurant ? `/claim/${restaurant.slug}` : '/claim';

  return (
    <Layout>
      <SEOHead title="Pakketten voor restaurants | Dishloopr" description="Gratis claimen, Uitgelicht, Menuservice, Evenementen en Pro: kies het pakket dat bij je restaurant past." />
      <div className="container py-12 md:py-16 space-y-14">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">Begin gratis, groei wanneer jij wilt.</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {restaurant ? `Voor ${restaurant.name}. ` : ''}Claimen is altijd gratis. Geen verborgen kosten, alle prijzen exclusief btw.
          </p>
        </header>

        <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardLabel icon={Store}>Gratis</CardLabel>
            <BigPrice amount="€0" per="altijd" note="Je basisprofiel blijft gratis." />
            <Features items={['Je pagina claimen', 'Menukaart, openingstijden en foto\'s beheren', 'Reageren op reviews', 'Basisstatistieken']} />
            <Button asChild size="lg" className="min-h-12 w-full rounded-full"><Link to={claimTo} onClick={() => track('free')}>Begin gratis</Link></Button>
          </Card>

          <Card highlight badge={promo ? 'Founding Partner actie' : 'Populair'}>
            <CardLabel icon={Crown}>Uitgelicht</CardLabel>
            {promo && <BillingToggle id="uit-billing" value={uitBilling} onChange={setUitBilling} hint="Tot 40% korting" inverted />}
            <BigPrice {...uit} inverted />
            <Features inverted items={[
              'Vaste plek bovenaan je gerechtpagina in je stad',
              'Maximaal 5 restaurants per gerechtpagina',
              'Je plek staat direct live',
              ...(promo ? ['Founding Partner badge voor altijd op je pagina', 'Actieprijs tot en met 31 december 2027'] : ['Per maand opzegbaar, elk kwartaal een veiling bij volle pagina\'s']),
            ]} />
            {promo && <p className="text-xs text-primary-foreground/85">Instappen kan tot en met 5 januari 2027. Minimale looptijd 6 maanden.</p>}
            {CHECKOUT_ENABLED.packages ? (
              <Button size="lg" variant="secondary" className="min-h-12 w-full rounded-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                onClick={() => { setPageSlug(''); setFounding(promo ? uitBilling : 'month'); }}>Kies Uitgelicht</Button>
            ) : (
              <Button size="lg" disabled variant="secondary" className="min-h-12 w-full rounded-full">Binnenkort beschikbaar</Button>
            )}
          </Card>

          <Card>
            <CardLabel icon={BarChart3}>Owner Pro</CardLabel>
            <BillingToggle id="pro-billing" value={proBilling} onChange={setProBilling} hint="2 maanden gratis" />
            <BigPrice {...pro} />
            <Features items={['Conversiefunnel: weergaven, kliks en reserveringen', 'Zoektermen waarop gasten je vinden', 'Vergelijking met restaurants in je buurt', 'Hulp van AI bij het beantwoorden van reviews']} />
            <Button size="lg" className="min-h-12 w-full rounded-full" disabled={!CHECKOUT_ENABLED.pro || proLoading !== null}
              onClick={() => user ? startPro(proBilling === 'month' ? 'monthly' : 'yearly') : needLogin()}>
              {proLoading ? 'Even geduld…' : 'Kies Owner Pro'}
            </Button>
          </Card>

          <Card>
            <CardLabel icon={BookOpen}>Menuservice</CardLabel>
            <BillingToggle id="menu-billing" value={menuBilling} onChange={setMenuBilling} left="Per maand" right="Eenmalig" />
            <BigPrice {...(menuBilling === 'month' ? { amount: '€19', per: 'per maand', note: 'Altijd actueel, wij houden hem bij.' } : { amount: '€79', per: 'eenmalig', note: 'Wij zetten je kaart één keer online.' })} />
            <Features items={['Je volledige menukaart online', 'Vertaald in het Engels, Duits en Frans', 'Als QR-menu', 'Voor je eigen website']} />
            {CHECKOUT_ENABLED.packages ? (
              <Button size="lg" variant="outline" className="min-h-12 w-full rounded-full" disabled={busy !== null}
                onClick={() => startPackage(menuBilling === 'month' ? 'menu_month' : 'menu_once')}>
                {busy === 'menu_month' || busy === 'menu_once' ? 'Even geduld…' : 'Kies Menuservice'}
              </Button>
            ) : (
              <Button size="lg" disabled variant="outline" className="min-h-12 w-full rounded-full">Binnenkort beschikbaar</Button>
            )}
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Plekken zijn beperkt en de prijs volgt de vraag.{' '}
          <Link to="/voor-restaurants/plekken-en-bieden" className="font-medium text-primary underline">Lees hoe plekken, prijzen en bieden werken</Link>
        </p>

        <div className="flex flex-col gap-5 rounded-3xl border bg-card p-7 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardLabel icon={CalendarDays}>Specials en evenementen</CardLabel>
              {!CHECKOUT_ENABLED.event && <Badge variant="secondary">Online betalen binnenkort</Badge>}
            </div>
            <p className="flex items-baseline gap-1.5"><span className="font-display text-4xl font-bold">€5</span><span className="text-sm text-muted-foreground">per maand per evenement, maandelijks opzegbaar</span></p>
            <Features items={['Je special of evenement op de evenementenpagina en op je restaurantpagina', 'Eenmalig op een datum of elke week terugkerend', 'Elke maand een mail met hoe vaak het in beeld was en is bekeken']} />
          </div>
          <Button asChild size="lg" variant="outline" className="min-h-12 w-full rounded-full md:w-auto">
            <Link to={user ? '/owner-dashboard?section=evenementen' : claimTo} onClick={() => track('event_promotion')}>
              {user ? 'Evenement toevoegen' : 'Claim eerst je restaurant'}
            </Link>
          </Button>
        </div>
      </div>

      <Dialog open={founding !== null} onOpenChange={o => !o && setFounding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Om welke gerechtpagina gaat het?</DialogTitle>
            <DialogDescription>Je uitgelichte plek komt op één gerechtpagina in je stad.</DialogDescription>
          </DialogHeader>
          {!restaurant ? (
            <div className="space-y-3">
              <p className="text-sm">We weten nog niet om welk restaurant het gaat. Claim eerst je restaurant of log in.</p>
              <div className="flex gap-2">
                <Button asChild><Link to="/claim">Restaurant claimen</Link></Button>
                <Button asChild variant="outline"><Link to="/login">Inloggen</Link></Button>
              </div>
            </div>
          ) : pages.length === 0 ? (
            <p className="text-sm">{restaurant.name} staat nog niet op een gerechtpagina. Neem contact op via info@dishloopr.com.</p>
          ) : (
            <div className="space-y-4">
              <Select value={pageSlug} onValueChange={setPageSlug}>
                <SelectTrigger className="min-h-11"><SelectValue placeholder="Kies een gerechtpagina" /></SelectTrigger>
                <SelectContent>
                  {pages.map(p => <SelectItem key={p.page_slug} value={p.page_slug}>{p.dish_name} (nu #{p.position} van {p.total})</SelectItem>)}
                </SelectContent>
              </Select>
              {pageSlug && typeof placesLeft === 'number' && (
                <p className={`text-sm ${placesLeft > 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
                  {placesLeft > 0 ? `Nog ${placesLeft} van de 5 plekken vrij op deze pagina.` : 'Alle 5 plekken op deze pagina zijn vergeven.'}
                </p>
              )}
              {afterWindow && pageSlug && typeof pagePrice === 'number' && (
                <p className="text-sm">
                  Prijs voor deze pagina: <strong>{formatEuroCents(pageStatus?.my_bid?.status === 'won' ? (pageStatus.my_bid.clearing_cents ?? pagePrice) : pagePrice)}</strong> per maand
                  {pageStatus && pageStatus.open_bids > 0 && <span className="text-muted-foreground">. {pageStatus.open_bids} {pageStatus.open_bids === 1 ? 'bod' : 'biedingen'} op de wachtlijst, hoogste {formatEuroCents(pageStatus.highest_bid_cents ?? 0)}</span>}
                </p>
              )}
              {mustBid ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm">
                    {pageStatus?.my_bid?.status === 'open'
                      ? `Je staat op de wachtlijst met ${formatEuroCents(pageStatus.my_bid.amount_cents)} per maand. Pas je bod aan of wacht op de veiling.`
                      : 'Deze pagina is vol of er wachten al bieders. Bied het bedrag dat je maximaal per maand wilt betalen.'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Komt er een plek vrij, dan gaat die naar het hoogste bod. Elk kwartaal is er een veiling: de hoogste bieders krijgen een plek
                    en betalen allemaal het hoogste bod dat net niet won, minimaal de lijstprijs.
                    {pageStatus?.next_auction && ` Volgende veiling: ${new Date(pageStatus.next_auction).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}.`}
                    {' '}<Link to="/voor-restaurants/plekken-en-bieden" className="text-primary underline">Zo werkt bieden</Link>
                  </p>
                  {user ? (
                    <div className="flex gap-2">
                      <Input inputMode="decimal" placeholder={typeof pagePrice === 'number' ? `Minimaal ${formatEuroCents(pagePrice)}` : 'Bedrag per maand'}
                        value={bidEuro} onChange={e => setBidEuro(e.target.value)} className="min-h-11" aria-label="Je bod per maand in euro" />
                      <Button variant="outline" className="min-h-11" disabled={!bidEuro} onClick={placeBid}>Bied</Button>
                    </div>
                  ) : <p className="text-sm">Log in om te bieden.</p>}
                </div>
              ) : (
                <Button className="min-h-11 w-full" disabled={!pageSlug || (!afterWindow && placesLeft === 0) || busy !== null}
                  onClick={() => founding && startPackage(founding === 'month' || afterWindow ? 'founding_month' : 'founding_year', pageSlug)}>
                  {busy ? 'Even geduld…' : pageStatus?.my_bid?.status === 'won' ? 'Rond je gewonnen plek af' : 'Verder naar betalen'}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Je betaalt direct bij het afrekenen; je plek staat meteen live.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
