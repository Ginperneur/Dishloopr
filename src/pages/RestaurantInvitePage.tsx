import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, CheckCircle2, Circle, Star, ArrowRight } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { optimizedImage } from '@/lib/imageUrl';
import { sendAnalyticsEvent } from '@/lib/cookieConsent';
import { missingItems } from '@/lib/inviteChecklist';

async function loadInvite(slug: string) {
  const { data: r, error } = await supabase.from('restaurants')
    .select('id, name, slug, address, images, opening_hours, ambience_tags, parking_info, claimed_by_owner_id')
    .eq('slug', slug).eq('is_active', true).maybeSingle();
  if (error) throw error;
  if (!r) return null;
  const [dishes, positions] = await Promise.all([
    supabase.from('restaurant_dishes').select('price').eq('restaurant_id', r.id)
      .in('status', ['approved_by_admin', 'verified_by_owner']),
    supabase.rpc('restaurant_positions', { p_slug: slug }),
  ]);
  if (dishes.error) throw dishes.error;
  if (positions.error) throw positions.error;
  return {
    restaurant: r,
    positions: positions.data ?? [],
    missing: missingItems({ dishPrices: (dishes.data ?? []).map(d => d.price), opening_hours: r.opening_hours,
      images: r.images, ambience_tags: r.ambience_tags, parking_info: r.parking_info }),
  };
}

export default function RestaurantInvitePage() {
  const { slug = '' } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['restaurant-invite', slug], queryFn: () => loadInvite(slug) });
  const logged = useRef(false);

  useEffect(() => {
    if (!data || logged.current) return;
    logged.current = true;
    supabase.from('analytics_events').insert({
      event_type: 'claimpagina_bekeken', restaurant_id: data.restaurant.id, metadata: { slug },
    }).then(() => undefined, () => undefined);
  }, [data, slug]);

  const r = data?.restaurant;
  const claimed = Boolean(r?.claimed_by_owner_id);
  const photo = r?.images?.[0];

  return (
    <Layout>
      <SEOHead title={r ? `${r.name} staat op Dishloopr` : 'Je staat op Dishloopr'} description="Bekijk hoe je restaurant gevonden wordt op Dishloopr." noindex />
      <div className="container max-w-3xl py-8 space-y-10">
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : !r ? (
          <div className="py-16 text-center space-y-4">
            <h1 className="text-2xl font-bold">Restaurant niet gevonden</h1>
            <Button asChild><Link to="/">Naar de homepage</Link></Button>
          </div>
        ) : (
          <>
            <section className="grid gap-6 md:grid-cols-[240px_1fr] items-center">
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                {photo && <img src={optimizedImage(photo, { width: 480 })} alt={r.name} width={480} height={360} fetchPriority="high" className="h-full w-full object-cover" />}
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold">{r.name} staat op Dishloopr</h1>
                {r.address && <p className="flex items-start gap-2 text-muted-foreground"><MapPin className="h-4 w-4 mt-1 shrink-0" />{r.address}</p>}
                {claimed ? (
                  <div className="space-y-1">
                    <p className="font-medium">Dit restaurant is al geclaimd</p>
                    <Link to="/login" className="text-primary underline">Inloggen</Link>
                  </div>
                ) : (
                  <Button asChild size="lg" className="min-h-11">
                    <Link to={`/claim/${r.slug}`} onClick={() => sendAnalyticsEvent('claim_start', { restaurant_slug: r.slug, source: 'claimpagina' })}>Claim gratis</Link>
                  </Button>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Hier word je gevonden</h2>
              {data.positions.length === 0 ? (
                <p className="text-muted-foreground">Je restaurant staat nog niet op een gerechtpagina.</p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {data.positions.map(p => (
                    <li key={p.page_slug}>
                      <Link to={`/eten/${p.page_slug}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                        <span>{p.dish_name}</span>
                        <span className="font-semibold text-primary">#{p.position} <span className="font-normal text-muted-foreground">van {p.total}</span></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Dit ontbreekt nog</h2>
              {data.missing.length === 0 ? (
                <p className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />Je profiel is compleet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.missing.map(m => (
                    <li key={m.key} className="flex items-start gap-3">
                      <Circle className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                      <span><span className="font-medium">{m.label}</span> <span className="text-muted-foreground">— na het claimen vul je dit zelf in</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border bg-muted/40 p-5 space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Star className="h-5 w-5 text-primary" />Extra zichtbaarheid</h2>
              <p>Word Founding Partner: een uitgelichte plek op een gerechtpagina voor €59 per maand excl. btw. Maximaal 2 plekken per gerechtpagina. Je betaalt pas vanaf de launchdatum.</p>
              <Button asChild variant="outline" className="min-h-11"><Link to={`/voor-restaurants/pakketten?slug=${encodeURIComponent(r.slug)}`}>Bekijk pakketten <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
            </section>

            <p className="text-sm text-muted-foreground">
              Klopt er iets niet of wil je niet op Dishloopr?{' '}
              <Link to={`/voor-restaurants/afmelden?slug=${encodeURIComponent(r.slug)}`} className="text-primary underline">Pas aan of verwijder</Link>
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}
