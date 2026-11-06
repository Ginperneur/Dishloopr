import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import NotFound from './NotFound';

type Lang = 'nl' | 'en' | 'de' | 'fr';
const LANGS: { code: Lang; label: string }[] = [{ code: 'nl', label: 'NL' }, { code: 'en', label: 'EN' }, { code: 'de', label: 'DE' }, { code: 'fr', label: 'FR' }];
const HEADINGS: Record<Lang, string> = { nl: 'Menukaart', en: 'Menu', de: 'Speisekarte', fr: 'Carte' };

interface MenuItem {
  category: string;
  name: string;
  description: string | null;
  price: number | null;
  translations?: Partial<Record<Exclude<Lang, 'nl'>, { category: string; name: string; description: string | null }>>;
}

// restaurant_menus (migration 20261106200000) is not in the generated types yet.
const db = supabase as any;
const euro = (n: number) => `€${n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Menuservice menu in four languages. Target of the restaurant's QR code and,
 * with ?embed=1, of the widget on its own website. Owners also see their
 * unpublished menu here (RLS) to check it before publishing.
 */
export default function MenuServicePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const embed = params.get('embed') === '1';
  const [lang, setLang] = useState<Lang>(() => {
    const p = params.get('lang');
    if (p === 'en' || p === 'de' || p === 'fr' || p === 'nl') return p;
    const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'nl';
    return (['en', 'de', 'fr'] as string[]).includes(nav) ? (nav as Lang) : 'nl';
  });

  const { data, isLoading } = useQuery({
    queryKey: ['menu-service', slug],
    queryFn: async () => {
      const { data: restaurant } = await supabase.from('restaurants').select('id, name, slug').eq('slug', slug).eq('is_active', true).maybeSingle();
      if (!restaurant) return null;
      const { data: menu } = await db.from('restaurant_menus').select('status, items').eq('restaurant_id', restaurant.id).maybeSingle();
      return menu ? { restaurant, status: menu.status as string, items: (menu.items ?? []) as MenuItem[] } : null;
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; items: { name: string; description: string | null; price: number | null }[] }>();
    for (const item of data?.items ?? []) {
      const t = lang === 'nl' ? null : item.translations?.[lang];
      const key = item.category;
      const group = map.get(key) ?? { title: t?.category ?? item.category, items: [] };
      group.items.push({ name: t?.name ?? item.name, description: t?.description ?? item.description, price: item.price });
      map.set(key, group);
    }
    return [...map.values()];
  }, [data, lang]);

  if (isLoading) return <div className="container py-16 text-center text-muted-foreground">…</div>;
  if (!data || !data.items.length) return embed ? <div className="p-6 text-sm text-muted-foreground">Menukaart niet beschikbaar.</div> : <NotFound />;

  const body = (
    <div className={embed ? 'p-4' : 'container max-w-3xl py-10'}>
      {data.status !== 'published' && (
        <p className="mb-6 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-sm">
          Voorbeeld: alleen jij ziet deze menukaart. Zet hem live in je dashboard onder Promoties.
        </p>
      )}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{HEADINGS[lang]}</p>
          <h1 className="font-display text-3xl font-bold">{data.restaurant.name}</h1>
        </div>
        <div className="flex gap-1 rounded-full border p-1" role="tablist" aria-label="Taal">
          {LANGS.map(l => (
            <button key={l.code} role="tab" aria-selected={lang === l.code} onClick={() => setLang(l.code)}
              className={`min-h-9 rounded-full px-3 text-sm font-semibold ${lang === l.code ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-8">
        {groups.map(g => (
          <section key={g.title}>
            <h2 className="mb-3 border-b pb-2 text-lg font-semibold">{g.title}</h2>
            <ul className="space-y-3">
              {g.items.map((i, idx) => (
                <li key={`${i.name}-${idx}`} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{i.name}</p>
                    {i.description && <p className="text-sm text-muted-foreground">{i.description}</p>}
                  </div>
                  {i.price != null && <span className="shrink-0 tabular-nums font-medium">{euro(i.price)}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-10 text-center text-xs text-muted-foreground">
        {embed
          ? <a href={`https://dishloopr.com/restaurant/${data.restaurant.slug}`} target="_blank" rel="noopener noreferrer">Menukaart via Dishloopr</a>
          : <Link to={`/restaurant/${data.restaurant.slug}`} className="underline">Bekijk {data.restaurant.name} op Dishloopr</Link>}
      </p>
    </div>
  );

  if (embed) return body;
  return (
    <Layout>
      <SEOHead title={`${HEADINGS[lang]} ${data.restaurant.name} | Dishloopr`} description={`De menukaart van ${data.restaurant.name} in het Nederlands, Engels, Duits en Frans.`} canonical={`https://dishloopr.com/menu/${data.restaurant.slug}`} />
      {body}
    </Layout>
  );
}
