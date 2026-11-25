import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { QRCodeGenerator } from '@/components/owner/QRCodeGenerator';
import { CollectionPlaceDialog } from '@/components/owner/CollectionPlaceDialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

// owner_collection_status is not in the generated types yet (20261125100000_dish_collections.sql).
type UntypedRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;

interface Status {
  collection_slug: string;
  title: string;
  kind: 'dish' | 'dietary' | 'concept';
  city_name: string | null;
  city_slug: string | null;
  dish_name: string | null;
  dish_price: number | null;
  matching_dishes: number;
  matching_mains: number;
  has_photo: boolean;
  dish_priced: boolean;
  priced_dishes: number;
  hours_known: boolean;
  review_count: number;
  review_avg: number | null;
  review_minimum: number;
  reviews_enforced: boolean;
  eligible: boolean;
  position: number | null;
  in_list: number;
}

interface Check { ok: boolean; label: string; detail: string; action?: { label: string; tab: string }; meter?: number; note?: string }

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);
const score = (n: number) => n.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** "Beste ramen" → "ramen"; "Halal uit eten" stays as it is. */
const subject = (title: string) => title.replace(/^Beste /, '').toLowerCase();

function checksFor(s: Status): Check[] {
  const what = subject(s.title);
  const reviewsOk = s.review_count >= s.review_minimum;
  const reviewDetail = `${s.review_count} van ${s.review_minimum} reviews${s.review_avg != null && s.review_count > 0 ? `, gemiddeld ${score(Number(s.review_avg))}` : ''}`;
  const checks: Check[] = [{ ok: true, label: 'Actief op Dishloopr', detail: 'Je pagina is live' }];
  if (s.kind === 'dish') {
    checks.push({ ok: true, label: `${s.dish_name ?? what} staat goedgekeurd op je kaart`, detail: 'Daarom hoor je bij deze collectie' });
  } else if (s.kind === 'dietary') {
    const ok = s.matching_dishes >= 3 && s.matching_mains >= 1;
    checks.push({ ok, label: `Minimaal 3 ${s.collection_slug.startsWith('halal') ? 'halal' : 'glutenvrije'} gerechten, waarvan 1 hoofdgerecht`,
      detail: `${s.matching_dishes} ${s.matching_dishes === 1 ? 'gerecht' : 'gerechten'}, ${s.matching_mains} ${s.matching_mains === 1 ? 'hoofdgerecht' : 'hoofdgerechten'}`,
      action: ok ? undefined : { label: 'Gerechten markeren', tab: 'menu' } });
  } else {
    checks.push({ ok: true, label: `De tag ${s.title} staat aan`, detail: 'Een gratis basistag' });
  }
  checks.push({ ok: s.has_photo, label: 'Foto van je restaurant', detail: s.has_photo ? 'Staat op je pagina' : 'Nog geen foto', action: s.has_photo ? undefined : { label: 'Foto toevoegen', tab: 'profile' } });
  if (s.kind !== 'concept') {
    checks.push({ ok: s.dish_priced, label: `Prijs bij je ${what}`, detail: s.dish_priced ? (s.dish_price != null ? `${s.dish_name}: ${euro(Number(s.dish_price))}` : 'Staat erbij') : 'Nog geen prijs',
      action: s.dish_priced ? undefined : { label: 'Prijs toevoegen', tab: 'menu' } });
  }
  checks.push({ ok: s.priced_dishes >= 10, label: 'Minimaal 10 gerechten met een prijs', detail: `${s.priced_dishes} ${s.priced_dishes === 1 ? 'gerecht' : 'gerechten'} met een prijs`,
    action: s.priced_dishes >= 10 ? undefined : { label: 'Prijzen aanvullen', tab: 'menu' } });
  checks.push({ ok: s.hours_known, label: 'Openingstijden bekend', detail: s.hours_known ? 'Staan op je pagina' : 'Nog niet ingevuld',
    action: s.hours_known ? undefined : { label: 'Openingstijden invullen', tab: 'profile' } });
  checks.push({
    ok: reviewsOk,
    label: `Minimaal ${s.review_minimum} reviews van ${s.kind === 'concept' ? 'je restaurant' : what}`,
    detail: reviewDetail,
    meter: reviewsOk ? undefined : Math.round((s.review_count / s.review_minimum) * 100),
    note: !s.reviews_enforced && !reviewsOk ? 'Telt mee vanaf 1 april 2027. Tot die tijd sta je er ook zonder in.' : undefined,
  });
  return checks;
}

/** How the restaurant stands in each collection it belongs to, what is missing, and the way to more reviews. */
export function OwnerCollectionStatus({ restaurantId, restaurantSlug, restaurantName, onGo }: {
  restaurantId: string; restaurantSlug: string; restaurantName: string;
  /** Opens a dashboard section (menu, profile) where the missing piece is filled in. */
  onGo: (tab: string) => void;
}) {
  const [buying, setBuying] = useState<{ slug: string; title: string } | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: ['owner-collection-status', restaurantId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as UntypedRpc)('owner_collection_status', { p_restaurant: restaurantId });
      if (error) throw error;
      return (data ?? []) as Status[];
    },
  });

  if (isPending) return <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  if (isError) return <p className="text-sm text-muted-foreground">Je collecties konden niet worden geladen. Probeer het later opnieuw.</p>;

  const visible = data.filter(s => s.eligible).length;
  const reviewUrl = `https://dishloopr.com/restaurant/${restaurantSlug}?utm_source=qr-review#review-form`;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {data.length === 0
          ? 'Je restaurant hoort nog bij geen enkele collectie. Collecties gaan over gerechten op je kaart (zoals ramen of pizza), halal of glutenvrij eten, all you can eat en shared dining.'
          : `Je staat in ${visible} van de ${data.length} ${data.length === 1 ? 'collectie' : 'collecties'} waar je bij hoort. Voldoe je aan alles, dan sta je er gratis in; je plek hangt vooral af van de reviews van gasten op dat gerecht.`}
      </p>

      {data.map(s => {
        const checks = checksFor(s);
        const done = checks.filter(c => c.ok).length;
        const where = s.city_name ? ` in ${s.city_name}` : '';
        const link = `/collection/${s.collection_slug}${s.city_slug ? `?stad=${s.city_slug}` : ''}`;
        return (
          <section key={s.collection_slug} className="space-y-4 rounded-xl border p-4" aria-labelledby={`col-${s.collection_slug}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id={`col-${s.collection_slug}`} className="text-lg font-semibold">{s.title}{where}</h3>
                <p className="text-sm text-muted-foreground">{s.in_list} {s.in_list === 1 ? 'restaurant' : 'restaurants'} in de lijst van je stad</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${s.eligible ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200'}`}>
                {s.eligible ? (s.position ? `Zichtbaar · #${s.position}` : 'Zichtbaar vanaf vannacht') : 'Nog niet zichtbaar'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={checks.length} aria-valuenow={done} aria-label="Voldaan">
                <div className={`h-full rounded-full ${s.eligible ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${(done / checks.length) * 100}%` }} />
              </div>
              <span className="whitespace-nowrap text-sm text-muted-foreground">{done} van {checks.length} voldaan</span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {checks.map(c => (
                <li key={c.label} className="flex gap-3 rounded-lg bg-muted/40 p-3">
                  {c.ok
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" aria-label="Voldaan" />
                    : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" aria-label="Nog niet voldaan" />}
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.detail}</p>
                    {c.meter != null && (
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-orange-500" style={{ width: `${Math.max(3, c.meter)}%` }} /></div>
                    )}
                    {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
                    {c.action && <button type="button" onClick={() => onGo(c.action!.tab)} className="min-h-9 text-left text-sm font-medium text-primary underline">{c.action.label}</button>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-sm">Nu al bovenaan staan? Een collectieplek staat apart boven de ranglijst, gemarkeerd als betaald.</p>
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => setBuying({ slug: s.collection_slug, title: s.title })}>Collectieplek kiezen</Button>
            </div>
            {s.eligible && (
              <p className="text-sm">
                {s.position ? `Je staat op #${s.position} van ${s.in_list}. ` : ''}Meer en betere reviews van gasten op dit gerecht brengen je hoger.{' '}
                <Link to={link} className="font-medium text-primary underline">Bekijk de collectie</Link>
              </p>
            )}
          </section>
        );
      })}

      {buying && (
        <CollectionPlaceDialog restaurantId={restaurantId} collectionSlug={buying.slug} title={buying.title}
          open={buying !== null} onOpenChange={o => !o && setBuying(null)} />
      )}

      <QRCodeGenerator
        restaurantSlug={restaurantSlug}
        restaurantName={restaurantName}
        url={reviewUrl}
        title="Vraag gasten om een review"
        description="Zet deze QR-code op tafel of op de bon. Gasten kiezen zelf het gerecht dat ze aten; elke review telt mee voor je collecties."
        caption="Hoe was je gerecht? Laat een review achter"
      />
    </div>
  );
}
