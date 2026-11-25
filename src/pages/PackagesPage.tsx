import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, BookOpen, CalendarDays, Check, Crown, Mail, Megaphone, Rocket, Store, Trophy } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sendAnalyticsEvent } from '@/lib/cookieConsent';
import { toast } from 'sonner';
import { CHECKOUT_ENABLED } from '@/lib/checkoutFlags';
import { OWNER_PRO_PRICES } from '@/lib/proPricing';
import { useOwnerProCheckout } from '@/hooks/useOwnerProCheckout';
import { VatTotal } from '@/components/common/VatTotal';
import { FOUNDING_MIN_MONTHS, PACKAGE_NAMES, PRICES, TERM_MONTHS, euroCents, foundingWindowOpen, packageCents, placeKind, type PlacePackage, type TermMonths } from '@/lib/paidPricing';

type Billing = 'month' | 'year';
type Offer = { page_slug: string; dish_name: string; position: number | null; total: number; searches_per_month: number;
  places_left: number; list_price_cents: number; page_kind: 'dish' | 'cuisine' | 'ambience'; topplek_left: number; topplek_price_cents: number };
type PageStatus = { open_bids: number; highest_bid_cents: number | null; next_auction: string; list_price_cents: number;
  my_bid: { status: 'open' | 'won'; amount_cents: number; clearing_cents: number | null } | null };

function track(pkg: string) { sendAnalyticsEvent('click_package', { package: pkg }); }

function Features({ items, inverted }: { items: string[]; inverted?: boolean }) {
  return (
    <ul className="flex-1 space-y-3 text-sm">
      {items.map(i => (
        <li key={i} className="flex gap-2.5">
          <Check className={`mt-0.5 h-4 w-4 shrink-0 ${inverted ? 'text-current' : 'text-primary'}`} aria-hidden="true" />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}

function Tier({ tone, badge, children }: { tone?: 'accent' | 'dark'; badge?: string; children: React.ReactNode }) {
  const cls = tone === 'accent' ? 'bg-primary text-primary-foreground shadow-xl shadow-primary/20'
    : tone === 'dark' ? 'bg-secondary text-secondary-foreground' : 'border bg-card';
  return (
    <div className={`relative flex flex-col gap-5 rounded-3xl p-7 ${cls}`}>
      {badge && <span className="absolute -top-3 right-6 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground shadow">{badge}</span>}
      {children}
    </div>
  );
}

const Label = ({ icon: Icon, children }: { icon: typeof Check; children: React.ReactNode }) => (
  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em]"><Icon className="h-5 w-5" aria-hidden="true" />{children}</h2>
);

function Price({ amount, per, note, muted }: { amount: string; per: string; note?: string; muted?: string }) {
  return (
    <div className="min-h-[88px]">
      <p className="flex flex-wrap items-baseline gap-1.5"><span className="font-display text-4xl font-bold tracking-tight">{amount}</span><span className={`text-sm ${muted ?? 'text-muted-foreground'}`}>{per}</span></p>
      {note && <p className={`mt-1 text-sm ${muted ?? 'text-muted-foreground'}`}>{note}</p>}
    </div>
  );
}

const PAGE_KIND_LABEL = { dish: 'Gerecht', cuisine: 'Keuken', ambience: 'Sfeer' } as const;

export default function PackagesPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const paramSlug = params.get('slug') || '';
  const promo = foundingWindowOpen();
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
      const { data, error } = await (supabase.rpc as any)('uitgelicht_page_offers', { p_slug: restaurant!.slug });
      if (error) throw error;
      return (data ?? []) as Offer[];
    },
    enabled: Boolean(restaurant?.slug),
  });

  const [buy, setBuy] = useState<null | PlacePackage>(null);
  // Term picked before paying: 1, 3, 6 or 12 months, or a year up front (Uitgelicht only).
  const [term, setTerm] = useState<TermMonths | 'year'>(FOUNDING_MIN_MONTHS);
  const [pageSlug, setPageSlug] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [bidEuro, setBidEuro] = useState('');

  // A link from the dashboard (?page=&pakket=) opens the dialog with that page chosen.
  const wantedPage = params.get('page');
  const wantedPkg = params.get('pakket') as PlacePackage | null;
  useEffect(() => {
    if (wantedPage && pages.some(p => p.page_slug === wantedPage)) {
      setPageSlug(wantedPage);
      setBuy(wantedPkg && wantedPkg in PACKAGE_NAMES ? wantedPkg : 'uitgelicht');
    }
  }, [wantedPage, wantedPkg, pages]);

  const kind = buy ? placeKind(buy) : 'uitgelicht';
  // Founding Partner prices (Uitgelicht and Groei) apply until 5 January 2027, and only with a term of
  // at least 6 months; a shorter term pays the normal price of the page. Topplek is always priced by demand.
  const termable = promo && (buy === 'uitgelicht' || buy === 'groei');
  const termMonths = term === 'year' ? 12 : term;
  const founding = termable && termMonths >= FOUNDING_MIN_MONTHS;
  const yearly = buy === 'uitgelicht' && founding && term === 'year';
  const sel = pages.find(p => p.page_slug === pageSlug);
  const left = sel ? (kind === 'topplek' ? sel.topplek_left : sel.places_left) : null;

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['place-status', kind, pageSlug, restaurant?.id],
    queryFn: async () => {
      const fn = kind === 'topplek' ? 'topplek_page_status' : 'uitgelicht_page_status';
      const { data, error } = await (supabase.rpc as any)(fn, { p_page_slug: pageSlug, p_restaurant: restaurant!.id });
      if (error) throw error;
      return data as PageStatus;
    },
    enabled: Boolean(buy && pageSlug && restaurant?.id && user && !founding),
    retry: false,
  });
  const othersWaiting = (status?.open_bids ?? 0) - (status?.my_bid?.status === 'open' ? 1 : 0) > 0;
  const mustBid = !founding && status?.my_bid?.status !== 'won' && (left === 0 || othersWaiting);
  const monthCents = sel && buy ? (status?.my_bid?.status === 'won' && status.my_bid.clearing_cents
    ? status.my_bid.clearing_cents + (buy === 'groei' ? PRICES.groei.surcharge : buy === 'dominant' ? PRICES.dominant.surcharge : 0)
    : packageCents(buy, sel, founding)) : null;

  const placeBid = async () => {
    const cents = Math.round(Number(bidEuro.replace(',', '.')) * 100);
    if (!restaurant || !Number.isFinite(cents) || cents <= 0) { toast.error('Vul een bedrag in euro in.'); return; }
    const fn = kind === 'topplek' ? 'place_topplek_bid' : 'place_uitgelicht_bid';
    const { error } = await (supabase.rpc as any)(fn, { p_page_slug: pageSlug, p_restaurant: restaurant.id, p_amount_cents: cents });
    if (error) { toast.error(error.message); return; }
    toast.success('Bod geplaatst. Komt er een plek vrij of wint je bod bij de veiling, dan krijg je bericht.');
    setBidEuro('');
    refetchStatus();
  };

  const startCheckout = async (option: string, page?: string) => {
    track(option);
    if (!restaurant) { toast.info('Claim eerst je restaurant of log in.'); return; }
    setBusy(option);
    try {
      const months = termable && page ? termMonths : 1;
      const { data, error } = await supabase.functions.invoke('create-package-checkout', { body: { option, restaurant_id: restaurant.id, page_slug: page, ...(page ? { months } : {}) } });
      const message = data?.error ?? (error ? await error.context?.json?.().then((b: any) => b?.error).catch(() => null) : null);
      if (message || error || !data?.url) throw new Error(message || 'Geen checkout ontvangen');
      window.location.href = data.url;
    } catch (e) {
      toast.error('Afrekenen lukte niet', { description: e instanceof Error ? e.message : undefined });
      setBusy(null);
    }
  };
  const placeOption = (p: PlacePackage) => (p === 'uitgelicht' ? (yearly ? 'founding_year' : 'founding_month') : `${p}_month`);

  const { startCheckout: startPro, loading: proLoading } = useOwnerProCheckout();
  const [proBilling, setProBilling] = useState<Billing>('month');
  const [menuBilling, setMenuBilling] = useState<'month' | 'once'>('month');
  const claimTo = restaurant ? `/claim/${restaurant.slug}` : '/claim';
  const open = (p: PlacePackage) => { track(p); setPageSlug(''); setTerm(FOUNDING_MIN_MONTHS); setBuy(p); };
  // Monthly price per term option, for the term buttons: the normal price is the page's list price once a page is chosen.
  const normalCents = buy === 'groei'
    ? (sel ? sel.list_price_cents : PRICES.uitgelicht.from) + PRICES.groei.surcharge
    : sel ? sel.list_price_cents : PRICES.uitgelicht.from;
  const foundingCents = buy === 'groei' ? PRICES.groei.founding : PRICES.uitgelicht.founding;
  const offerPages = useMemo(() => pages, [pages]);

  return (
    <Layout>
      <SEOHead title="Pakketten voor restaurants | Dishloopr" description="Gratis claimen, Pro, Groei en Dominant, plus losse plekken: Topplek, Uitgelicht, Stadsspotlight en de nieuwsbrief in je stad." />
      <div className="container space-y-14 py-12 md:py-16">
        <header className="mx-auto max-w-3xl space-y-4 text-center">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">Begin gratis, groei wanneer jij wilt.</h1>
          <p className="text-lg text-muted-foreground">{restaurant ? `Voor ${restaurant.name}. ` : ''}Claimen is altijd gratis. Alle prijzen zijn exclusief 21% btw; bij het afrekenen zie je het totaalbedrag.</p>
        </header>

        {promo && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            <p><strong>Founding Partner-actie:</strong> Uitgelicht voor {euroCents(PRICES.uitgelicht.founding)} in plaats van {euroCents(PRICES.uitgelicht.from)} per maand, Groei voor {euroCents(PRICES.groei.founding)}, tot en met 31 december 2027, en de Founding Partner-badge voor altijd. Dat geldt bij een looptijd van minimaal {FOUNDING_MIN_MONTHS} maanden; je kiest de looptijd voordat je afrekent. Instappen kan tot en met 5 januari 2027.</p>
          </div>
        )}

        <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Tier>
            <Label icon={Store}>Gratis</Label>
            <Price amount="€0" per="altijd" note="Je basisprofiel blijft gratis." />
            <Features items={['Je pagina claimen', 'Menukaart, openingstijden en foto\'s beheren', 'Reageren op reviews', 'Basisstatistieken']} />
            <Button asChild size="lg" variant="outline" className="min-h-12 w-full rounded-full"><Link to={claimTo} onClick={() => track('free')}>Begin gratis</Link></Button>
          </Tier>

          <Tier>
            <Label icon={BarChart3}>Pro</Label>
            <div className="flex items-center gap-3 text-sm">
              <button type="button" className="min-h-11" onClick={() => setProBilling('month')}>Maandelijks</button>
              <Switch checked={proBilling === 'year'} onCheckedChange={c => setProBilling(c ? 'year' : 'month')} aria-label="Jaarlijks betalen" />
              <button type="button" className="min-h-11" onClick={() => setProBilling('year')}>Jaarlijks</button>
            </div>
            <Price amount={`€${proBilling === 'month' ? OWNER_PRO_PRICES.monthly.amount : OWNER_PRO_PRICES.yearly.amount}`}
              per={proBilling === 'month' ? 'per maand' : 'per jaar'} note={proBilling === 'month' ? `Of €${OWNER_PRO_PRICES.yearly.amount} per jaar, 2 maanden gratis.` : '2 maanden gratis.'} />
            <Features items={['Zoektermen waarop gasten je vinden', 'Vergelijking met je buurt', 'Hulp van AI bij reviews', 'Onbeperkt simulaties', 'Stempelkaart en social posts']} />
            <Button size="lg" className="min-h-12 w-full rounded-full" disabled={!CHECKOUT_ENABLED.pro || proLoading !== null}
              onClick={() => user ? startPro(proBilling === 'month' ? 'monthly' : 'yearly') : toast.info('Log eerst in met je eigenaarsaccount.')}>
              {proLoading ? 'Even geduld…' : 'Kies Pro'}
            </Button>
          </Tier>

          <Tier tone="accent" badge="Aanrader">
            <Label icon={Rocket}>Groei</Label>
            <Price amount={promo ? euroCents(PRICES.groei.founding) : `vanaf ${euroCents(PRICES.uitgelicht.from + PRICES.groei.surcharge)}`} per="per maand"
              note={promo ? `Normaal ${euroCents(PRICES.uitgelicht.from + PRICES.groei.surcharge)}. Los ${euroCents(PRICES.uitgelicht.founding + 2900 + PRICES.event)}.` : `Los ${euroCents(PRICES.uitgelicht.from + 2900 + PRICES.event)}, je bespaart ${euroCents(2900 + PRICES.event - PRICES.groei.surcharge)}.`}
              muted="text-primary-foreground/85" />
            <Features inverted items={['1 Uitgelicht-plek op een pagina in je stad', 'Ook bovenaan bij zoeken, op de kaart en met een badge', 'Pro inbegrepen', '1 evenement of special per maand', 'Maandrapport met vertoningen en kliks per plek']} />
            <Button size="lg" variant="secondary" className="min-h-12 w-full rounded-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              disabled={!CHECKOUT_ENABLED.packages} onClick={() => open('groei')}>Kies Groei</Button>
          </Tier>

          <Tier tone="dark">
            <Label icon={Trophy}>Dominant</Label>
            <Price amount={`vanaf ${euroCents(PRICES.topplek.from + PRICES.dominant.surcharge)}`} per="per maand" note="De prijs volgt de Topplek van je pagina." muted="text-secondary-foreground/80" />
            <Features inverted items={['De Topplek op een pagina in je stad', 'Vraag doorsturen voor hetzelfde gerecht', '1 nieuwsbriefplaatsing per maand in je stad', 'Pro en 1 evenement per maand inbegrepen']} />
            <Button size="lg" variant="secondary" className="min-h-12 w-full rounded-full" disabled={!CHECKOUT_ENABLED.packages} onClick={() => open('dominant')}>Kies Dominant</Button>
          </Tier>
        </div>

        <section aria-labelledby="los" className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="los" className="font-display text-3xl font-bold">Of kies losse plekken</h2>
            <Link to="/voor-restaurants/plekken-en-bieden" className="text-sm font-medium text-primary underline">Zo werken plekken en bieden</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Trophy, name: 'Topplek', price: `vanaf ${euroCents(PRICES.topplek.from)}`, per: 'per maand', text: '1 per pagina: de grote kaart bovenaan, ook als eerste bij zoeken, op de kaart en op de homepage van je stad.', action: () => open('topplek'), cta: 'Kies Topplek' },
              { icon: Crown, name: 'Uitgelicht', price: promo ? euroCents(PRICES.uitgelicht.founding) : `vanaf ${euroCents(PRICES.uitgelicht.from)}`, per: 'per maand', text: '3 per pagina, direct onder de Topplek. Pagina vol? Dan bied je mee.', action: () => open('uitgelicht'), cta: 'Kies Uitgelicht' },
              { icon: Megaphone, name: 'Stadsspotlight', price: euroCents(PRICES.spotlightWeek), per: 'per week', text: '3 plekken per stad op de homepage en stadspagina, met je eigen haakje zoals een nieuw menu.', to: '/owner-dashboard?section=promotions', cta: 'Boek een week' },
              { icon: Mail, name: 'Nieuwsbrief in je stad', price: euroCents(PRICES.newsletterPer1000), per: 'per 1.000 lezers', text: `Maximaal 4 restaurants per editie, minimaal ${euroCents(PRICES.newsletterMin)}. Je ziet vooraf hoeveel lezers.`, to: '/owner-dashboard?section=promotions', cta: 'Kies een editie' },
              { icon: CalendarDays, name: 'Evenement', price: euroCents(PRICES.event), per: 'per maand', text: 'Je special of evenement op de evenementenpagina, je restaurantpagina en de homepage van je stad.', to: user ? '/owner-dashboard?section=evenementen' : claimTo, cta: 'Evenement toevoegen' },
              { icon: BookOpen, name: 'Menuservice', price: menuBilling === 'month' ? euroCents(PRICES.menuMonth) : euroCents(PRICES.menuOnce), per: menuBilling === 'month' ? 'per maand' : 'eenmalig', text: 'Wij zetten je kaart online, vertaald en als QR-menu.', action: () => startCheckout(menuBilling === 'month' ? 'menu_month' : 'menu_once'), cta: busy?.startsWith('menu') ? 'Even geduld…' : 'Kies Menuservice', toggle: true },
            ].map(c => (
              <div key={c.name} className="flex flex-col gap-3 rounded-2xl border bg-card p-6">
                <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground"><c.icon className="h-4 w-4" aria-hidden="true" />{c.name}</p>
                <p className="flex items-baseline gap-1.5"><span className="font-display text-2xl font-bold">{c.price}</span><span className="text-sm text-muted-foreground">{c.per}</span></p>
                {c.toggle && (
                  <div className="flex gap-2 text-sm">
                    <button type="button" className={`min-h-9 rounded-full px-3 ${menuBilling === 'month' ? 'bg-secondary text-secondary-foreground' : 'border'}`} onClick={() => setMenuBilling('month')}>Per maand</button>
                    <button type="button" className={`min-h-9 rounded-full px-3 ${menuBilling === 'once' ? 'bg-secondary text-secondary-foreground' : 'border'}`} onClick={() => setMenuBilling('once')}>Eenmalig</button>
                  </div>
                )}
                <p className="flex-1 text-sm text-muted-foreground">{c.text}</p>
                {'to' in c && c.to
                  ? <Button asChild variant="outline" className="min-h-11 rounded-full"><Link to={c.to}>{c.cta}</Link></Button>
                  : <Button variant="outline" className="min-h-11 rounded-full" disabled={!CHECKOUT_ENABLED.packages || busy !== null} onClick={c.action}>{c.cta}</Button>}
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Betaalde plekken zijn er alleen op pagina's met minstens 10 restaurants, en alleen voor een gerecht dat op je eigen kaart staat. Elke betaalde plek is voor gasten herkenbaar als betaald.</p>
        </section>
      </div>

      <Dialog open={buy !== null} onOpenChange={o => !o && setBuy(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{buy ? `${PACKAGE_NAMES[buy]}: op welke pagina?` : ''}</DialogTitle>
            <DialogDescription>Je plek komt op één gerecht-, keuken- of sfeerpagina in je stad, en overal waar die pagina verschijnt.</DialogDescription>
          </DialogHeader>
          {!restaurant ? (
            <div className="space-y-3">
              <p className="text-sm">We weten nog niet om welk restaurant het gaat. Claim eerst je restaurant of log in.</p>
              <div className="flex gap-2"><Button asChild><Link to="/claim">Restaurant claimen</Link></Button><Button asChild variant="outline"><Link to="/login">Inloggen</Link></Button></div>
            </div>
          ) : offerPages.length === 0 ? (
            <p className="text-sm">{restaurant.name} staat nog niet op een pagina met betaalde plekken. Die zijn er vanaf 10 restaurants, voor gerechten waar gasten een restaurant voor kiezen. Voeg je gerechten toe in je dashboard onder Menu, of mail info@dishloopr.com.</p>
          ) : (
            <div className="space-y-4">
              {termable && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Looptijd</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Looptijd">
                    {[...TERM_MONTHS, ...(buy === 'uitgelicht' ? ['year' as const] : [])].map(t => {
                      const months = t === 'year' ? 12 : t;
                      const deal = months >= FOUNDING_MIN_MONTHS;
                      const active = term === t;
                      return (
                        <button key={t} type="button" role="radio" aria-checked={active} onClick={() => setTerm(t)}
                          className={`min-h-14 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${active ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted'}`}>
                          <span className="block font-semibold">{t === 'year' ? '1 jaar vooruit' : t === 1 ? '1 maand' : `${t} maanden`}</span>
                          <span className="block text-xs text-muted-foreground">
                            {t === 'year' ? `${euroCents(PRICES.uitgelicht.foundingYear)} per jaar` : `${!deal && !sel ? 'vanaf ' : ''}${euroCents(deal ? foundingCents : normalCents)} per maand`}
                          </span>
                          {deal && <span className="mt-1 inline-block rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-950">Founding Partner</span>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {founding
                      ? `Founding Partner-prijs tot en met 31 december 2027 en de badge voor altijd. ${yearly ? 'Je betaalt het jaar vooruit, daarna per jaar opzegbaar.' : `Minimaal ${termMonths} maanden, daarna per maand opzegbaar.`}`
                      : `Korter dan ${FOUNDING_MIN_MONTHS} maanden: je betaalt de normale prijs van de pagina en wordt geen Founding Partner. ${termMonths > 1 ? `Minimaal ${termMonths} maanden, daarna per maand opzegbaar.` : 'Per maand opzegbaar.'}`}
                  </p>
                </fieldset>
              )}
              <Select value={pageSlug} onValueChange={setPageSlug}>
                <SelectTrigger className="min-h-11"><SelectValue placeholder="Kies een pagina" /></SelectTrigger>
                <SelectContent>
                  {offerPages.map(p => {
                    const l = kind === 'topplek' ? p.topplek_left : p.places_left;
                    return (
                      <SelectItem key={p.page_slug} value={p.page_slug} disabled={founding && l === 0}>
                        {PAGE_KIND_LABEL[p.page_kind]}: {p.dish_name}{p.position ? `, nu #${p.position} van ${p.total}` : `, ${p.total} restaurants`}
                        {l === 0 ? ', vol' : kind === 'topplek' ? ', Topplek vrij' : `, nog ${l} ${l === 1 ? 'plek' : 'plekken'}`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {sel && (
                <div className="rounded-lg bg-primary/5 p-3 text-sm">
                  {sel.position ? <>Je staat nu op <strong>#{sel.position} van {sel.total}</strong>. </> : null}
                  {kind === 'topplek' ? 'Met de Topplek sta je als enige helemaal bovenaan' : 'Met Uitgelicht sta je direct onder de Topplek'}
                  {sel.searches_per_month > 0 ? <>, voor zo'n <strong>{Math.round(sel.searches_per_month).toLocaleString('nl-NL')} zoekopdrachten per maand</strong></> : null}.
                </div>
              )}
              {sel && monthCents != null && !mustBid && (
                <p className="text-sm">Prijs: <strong>{euroCents(yearly ? PRICES.uitgelicht.foundingYear : monthCents)}</strong> {yearly ? 'per jaar' : 'per maand'} excl. btw
                  {status && status.open_bids > 0 && <span className="text-muted-foreground">. {status.open_bids} {status.open_bids === 1 ? 'bod' : 'biedingen'} op de wachtlijst</span>}
                </p>
              )}
              {mustBid ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm">{status?.my_bid?.status === 'open'
                    ? `Je staat op de wachtlijst met ${euroCents(status.my_bid.amount_cents)} per maand excl. btw. Pas je bod aan of wacht op de veiling.`
                    : `Deze ${kind === 'topplek' ? 'Topplek is bezet' : 'pagina is vol'} of er wachten al bieders. Bied het bedrag dat je maximaal per maand wilt betalen voor de plek, excl. btw.`}</p>
                  <p className="text-xs text-muted-foreground">Elk kwartaal is er een veiling: de hoogste bieders krijgen de plek en betalen allemaal het hoogste bod dat net niet won, minimaal de lijstprijs.
                    {status?.next_auction && ` Volgende veiling: ${new Date(status.next_auction).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}.`}
                    {(buy === 'groei' || buy === 'dominant') && ` Bij ${PACKAGE_NAMES[buy]} komt er ${euroCents(buy === 'groei' ? PRICES.groei.surcharge : PRICES.dominant.surcharge)} bij voor wat er verder in zit.`}</p>
                  {user ? (<>
                    <div className="flex gap-2">
                      <Input inputMode="decimal" placeholder={status ? `Minimaal ${euroCents(status.list_price_cents)}` : 'Bedrag per maand'} value={bidEuro}
                        onChange={e => setBidEuro(e.target.value)} className="min-h-11" aria-label="Je bod per maand in euro" />
                      <Button variant="outline" className="min-h-11" disabled={!bidEuro} onClick={placeBid}>Bied</Button>
                    </div>
                    {Number(bidEuro.replace(',', '.')) > 0 && <VatTotal exCents={Math.round(Number(bidEuro.replace(',', '.')) * 100)} per="per maand als je wint (je betaalt nooit meer dan je bod)" />}
                  </>) : <p className="text-sm">Log in om te bieden.</p>}
                </div>
              ) : (
                <Button className="min-h-11 w-full" disabled={!pageSlug || (founding && left === 0) || busy !== null} onClick={() => buy && startCheckout(placeOption(buy), pageSlug)}>
                  {busy ? 'Even geduld…' : status?.my_bid?.status === 'won' ? 'Rond je gewonnen plek af' : 'Verder naar betalen'}
                </Button>
              )}
              {!mustBid && monthCents != null && <VatTotal exCents={yearly ? PRICES.uitgelicht.foundingYear : monthCents} per={yearly ? 'per jaar' : 'per maand'} />}
              <p className="text-xs text-muted-foreground">Je betaalt direct bij het afrekenen; je plek staat meteen live.{termable ? '' : ' Per maand opzegbaar.'}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
