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
import { clientReferenceId, isUsableLink, withReference } from '@/lib/packageLinks';

type LinkKey = 'founding_month_url' | 'founding_year_url' | 'menu_once_url' | 'menu_month_url';

function track(pkg: string) { sendAnalyticsEvent('click_package', { package: pkg }); }

function Features({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm flex-1">
      {items.map(i => <li key={i} className="flex gap-2"><Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />{i}</li>)}
    </ul>
  );
}

function Price({ main, sub }: { main: string; sub?: string }) {
  return (
    <div>
      <p className="text-3xl font-bold">{main}</p>
      {sub && <p className="text-sm">{sub}</p>}
      <p className="text-xs text-muted-foreground mt-1">Alle prijzen exclusief btw</p>
    </div>
  );
}

function LinkButton({ url, label, pkg, variant = 'default' }: { url?: string; label: string; pkg: string; variant?: 'default' | 'outline' }) {
  if (!isUsableLink(url)) return <Button disabled variant="outline" className="min-h-11 w-full">{label}: binnenkort beschikbaar</Button>;
  return (
    <Button asChild variant={variant} className="min-h-11 w-full">
      <a href={url} onClick={() => track(pkg)} rel="noopener">{label}</a>
    </Button>
  );
}

export default function PackagesPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const paramSlug = params.get('slug') || '';

  useEffect(() => { sendAnalyticsEvent('view_packages', {}); }, []);

  const { data: links = {} } = useQuery({
    queryKey: ['package-links'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('public_package_links');
      if (error) throw error;
      return Object.fromEntries((data ?? []).map(r => [r.key, r.url])) as Partial<Record<LinkKey, string>>;
    },
  });

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
  const foundingUrl = founding === 'month' ? links.founding_month_url : links.founding_year_url;

  const goFounding = () => {
    if (!restaurant || !pageSlug || !isUsableLink(foundingUrl)) return;
    track(founding === 'month' ? 'founding_month' : 'founding_year');
    window.location.href = withReference(foundingUrl, clientReferenceId(restaurant.id, pageSlug));
  };

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
      <SEOHead title="Pakketten voor restaurants | Dishloopr" description="Gratis claimen, Founding Partner, Menuservice en Pro: kies het pakket dat bij je restaurant past." />
      <div className="container py-10 space-y-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-bold">Pakketten</h1>
          <p className="text-muted-foreground mt-2">{restaurant ? `Voor ${restaurant.name}. ` : ''}Kies wat bij je restaurant past. Claimen is altijd gratis.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold">Gratis</h2>
            <Price main="€0" />
            <Features items={['Je pagina claimen', 'Menukaart, openingstijden en foto\'s beheren', 'Basisstatistieken']} />
            <Button asChild className="min-h-11 w-full"><Link to={claimTo} onClick={() => track('free')}>Claim gratis</Link></Button>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border-2 border-primary bg-card p-6">
            <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">Founding Partner</h2><Badge>Founding Partner</Badge></div>
            <Price main="€59 per maand" sub="of €590 per jaar" />
            <p className="text-sm text-muted-foreground">Vaste prijs zolang je klant blijft.</p>
            <Features items={['Uitgelichte plek op 1 gerechtpagina in je stad, met het label "Uitgelicht"', 'Maximaal 2 per gerechtpagina', 'Badge "Founding Partner"', 'Maandrapport']} />
            <p className="text-sm">Je betaalt pas vanaf de launchdatum. Gaat de launch niet door, dan krijg je je geld terug.</p>
            <div className="grid grid-cols-2 gap-2">
              {(['month', 'year'] as const).map(p => {
                const url = p === 'month' ? links.founding_month_url : links.founding_year_url;
                const label = p === 'month' ? 'Per maand' : 'Per jaar';
                return isUsableLink(url)
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
              <LinkButton url={links.menu_once_url} label="Eenmalig" pkg="menu_once" />
              <LinkButton url={links.menu_month_url} label="Per maand" pkg="menu_month" variant="outline" />
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border bg-muted/40 p-6">
            <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-semibold">Pro</h2><Badge variant="secondary">Binnenkort</Badge></div>
            <Price main="vanaf €29" sub="per maand" />
            <Features items={['Uitgebreide statistieken', 'Reageren op reviews', 'Meertalig menu']} />
            <div className="space-y-2">
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Je e-mailadres" aria-label="E-mailadres" aria-invalid={proMsg?.ok === false} />
              <Button variant="outline" className="min-h-11 w-full" onClick={joinPro}>Houd me op de hoogte</Button>
              {proMsg && <p className={`text-sm ${proMsg.ok ? 'text-primary' : 'text-destructive'}`}>{proMsg.text}</p>}
            </div>
          </div>
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
              <Button className="min-h-11 w-full" disabled={!pageSlug} onClick={goFounding}>Verder naar betalen</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
