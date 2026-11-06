import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { z } from 'zod';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useLaunchDate } from '@/hooks/useLaunchDate';

type PackageOption = 'founding_month' | 'founding_year' | 'menu_once' | 'menu_month';

function track(pkg: string) { sendAnalyticsEvent('click_package', { package: pkg }); }

function Features({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm flex-1">
      {items.map(i => <li key={i} className="flex gap-2"><Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />{i}</li>)}
    </ul>
  );
}

function Price({ main, sub, was }: { main: string; sub?: string; was?: string }) {
  return (
    <div>
      {was && <p className="text-sm text-muted-foreground line-through decoration-primary">{was}</p>}
      <p className="text-3xl font-bold">{main}</p>
      {sub && <p className="text-sm">{sub}</p>}
      <p className="text-xs text-muted-foreground mt-1">Alle prijzen exclusief btw</p>
    </div>
  );
}

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

  const [founding, setFounding] = useState<null | 'month' | 'year'>(null);
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

  // Founding Partner and Menuservice go through create-package-checkout, which
  // checks verified ownership, the 5-per-page cap and starts billing at launch.
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
  const launch = useLaunchDate();

  const [email, setEmail] = useState(user?.email ?? '');
  const [proMsg, setProMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const joinPro = async () => {
    const parsed = z.string().trim().toLowerCase().email().max(255).safeParse(email);
    if (!parsed.success) { setProMsg({ ok: false, text: 'Vul een geldig e-mailadres in.' }); return; }
    track('pro_waitlist');
    const { error } = await supabase.from('pro_waitlist').insert({ email: parsed.data, restaurant_id: restaurant?.id ?? null });
    if (error && error.code !== '23505') { setProMsg({ ok: false, text: 'Aanmelden lukte niet. Probeer het later opnieuw.' }); return; }
    setProMsg({ ok: true, text: error ? 'Je staat al op de lijst.' : 'Gelukt! We laten het je weten zodra Pro er is.' });
  };

  const claimTo = restaurant ? `/claim/${restaurant.slug}` : '/claim';

  return (
    <Layout>
      <SEOHead title="Pakketten voor restaurants | Dishloopr" description="Gratis claimen, Founding Partner, Menuservice, Evenementen en Pro: kies het pakket dat bij je restaurant past." />
      <div className="container py-10 space-y-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-bold">Pakketten</h1>
          <p className="text-muted-foreground mt-2">{restaurant ? `Voor ${restaurant.name}. ` : ''}Kies wat bij je restaurant past. Claimen is altijd gratis.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold">Gratis</h2>
            <Price main="€0" />
            <Features items={['Je pagina claimen', 'Menukaart, openingstijden en foto\'s beheren', 'Basisstatistieken']} />
            <Button asChild className="min-h-11 w-full"><Link to={claimTo} onClick={() => track('free')}>Claim gratis</Link></Button>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border-2 border-primary bg-card p-6">
            <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">Founding Partner</h2><Badge>Founding Partner</Badge></div>
            <Price main="€59 per maand" sub="of €590 per jaar" was="Normaal €99 per maand" />
            <p className="rounded-lg bg-primary/10 p-3 text-sm"><span className="font-semibold">Je bespaart €480 per jaar</span>, of €598 per jaar met het jaarabonnement. Dat is bijna de helft.</p>
            <p className="text-sm text-muted-foreground">Vaste prijs zolang je klant blijft, dus die besparing krijg je elk jaar opnieuw. Minimale looptijd 6 maanden.</p>
            <Features items={['Uitgelichte plek op 1 gerechtpagina in je stad', 'Bovenaan de pagina in het blok "Uitgelicht"', 'Maximaal 5 per gerechtpagina']} />
            <p className="text-sm">Je betaalt pas vanaf de launch op {launch.label}. Gaat de launch niet door, dan betaal je niets.</p>
            <div className="grid grid-cols-2 gap-2">
              {(['month', 'year'] as const).map(p => {
                const label = p === 'month' ? 'Per maand' : 'Per jaar';
                return CHECKOUT_ENABLED.packages
                  ? <Button key={p} className="min-h-11" onClick={() => { setPageSlug(''); setFounding(p); }}>{label}</Button>
                  : <Button key={p} disabled variant="outline" className="min-h-11 h-auto whitespace-normal text-xs">{label}: binnenkort beschikbaar</Button>;
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold">Menuservice</h2>
            <Price main="€79 eenmalig" sub="of €19 per maand" />
            <Features items={['Je volledige menukaart online', 'Vertaald in het Engels, Duits en Frans', 'Als QR-menu', 'Voor je eigen website']} />
            <div className="grid gap-2">
              {(['menu_once', 'menu_month'] as const).map(option => {
                const label = option === 'menu_once' ? 'Eenmalig' : 'Per maand';
                return CHECKOUT_ENABLED.packages
                  ? <Button key={option} variant={option === 'menu_once' ? 'default' : 'outline'} className="min-h-11 w-full" disabled={busy !== null} onClick={() => startPackage(option)}>{busy === option ? 'Even geduld…' : label}</Button>
                  : <Button key={option} disabled variant="outline" className="min-h-11 h-auto w-full whitespace-normal text-xs">{label}: binnenkort beschikbaar</Button>;
              })}
            </div>
          </div>

          <div className={`flex flex-col gap-4 rounded-xl border p-6 ${CHECKOUT_ENABLED.pro ? 'bg-card' : 'bg-muted/40'}`}>
            <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">Owner Pro</h2>{!CHECKOUT_ENABLED.pro && <Badge variant="secondary">Binnenkort</Badge>}</div>
            <Price main={`€${OWNER_PRO_PRICES.monthly.amount} per maand`} sub={`of €${OWNER_PRO_PRICES.yearly.amount} per jaar (${OWNER_PRO_PRICES.yearly.savingsLabel})`} />
            <Features items={['Conversiefunnel: weergaven, kliks en reserveringen', 'Zoektermen waarop gasten je vinden', 'Vergelijking met restaurants in je buurt', 'Hulp van AI bij het beantwoorden van reviews']} />
            {CHECKOUT_ENABLED.pro ? (
              <div className="grid grid-cols-2 gap-2">
                <Button className="min-h-11" disabled={proLoading !== null} onClick={() => user ? startPro('monthly') : toast.info('Log eerst in met je eigenaarsaccount.')}>Per maand</Button>
                <Button variant="outline" className="min-h-11" disabled={proLoading !== null} onClick={() => user ? startPro('yearly') : toast.info('Log eerst in met je eigenaarsaccount.')}>Per jaar</Button>
              </div>
            ) : (
            <div className="space-y-2">
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Je e-mailadres" aria-label="E-mailadres" aria-invalid={proMsg?.ok === false} />
              <Button variant="outline" className="min-h-11 w-full" onClick={joinPro}>Houd me op de hoogte</Button>
              {proMsg && <p className={`text-sm ${proMsg.ok ? 'text-primary' : 'text-destructive'}`}>{proMsg.text}</p>}
            </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">Evenementen</h2>
              {!CHECKOUT_ENABLED.event && <Badge variant="secondary">Online betalen binnenkort</Badge>}
            </div>
            <Price main="€5 per maand" sub="per evenement, maandelijks opzegbaar" />
            <Features items={['Je special of evenement op de evenementenpagina en op je restaurantpagina', 'Eenmalig op een datum of elke week terugkerend', 'Elke maand een mail met hoe vaak het in beeld was en is bekeken']} />
          </div>
          <Button asChild variant="outline" className="min-h-11 w-full md:w-auto">
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
              <Button className="min-h-11 w-full" disabled={!pageSlug || placesLeft === 0 || busy !== null}
                onClick={() => founding && startPackage(founding === 'month' ? 'founding_month' : 'founding_year', pageSlug)}>
                {busy ? 'Even geduld…' : 'Verder naar betalen'}
              </Button>
              <p className="text-xs text-muted-foreground">Je betaalt pas vanaf de launch op {launch.label}.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
