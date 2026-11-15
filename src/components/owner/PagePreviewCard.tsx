import { Link } from 'react-router-dom';
import { ExternalLink, MapPin, Phone, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isOpenNow } from '@/lib/openingHours';
import { optimizedImage } from '@/lib/imageUrl';

interface Props {
  slug: string;
  name: string;
  cityName?: string;
  cuisines?: string[] | null;
  tags?: string[] | null;
  images?: string[] | null;
  rating?: number | null;
  reviewCount?: number | null;
  openingHours?: unknown;
  phone?: string | null;
  reservationUrl?: string | null;
  isActive: boolean;
}

/** A small live preview of what guests see, next to the profile editor. */
export function PagePreviewCard(p: Props) {
  const open = isOpenNow(p.openingHours);
  const cover = p.images?.[0];
  const meta = [p.cuisines?.slice(0, 2).join(', '), p.cityName].filter(Boolean).join(' · ');
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Zo ziet je pagina eruit</p>
      <Card className="overflow-hidden">
        {cover ? (
          <img src={optimizedImage(cover, { width: 640 })} alt="" width={640} height={300}
            className="h-36 w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-36 items-center justify-center bg-muted text-xs text-muted-foreground">Nog geen foto</div>
        )}
        <div className="space-y-2 p-4">
          <p className="font-display text-lg font-bold leading-tight">{p.name}</p>
          {meta && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{meta}</p>}
          {!!p.rating && Number(p.rating) > 0 && (
            <p className="flex items-center gap-1 text-xs"><Star className="h-3 w-3 fill-rating text-rating" />{Number(p.rating).toFixed(1)}
              <span className="text-muted-foreground">({p.reviewCount ?? 0})</span></p>
          )}
          {!!p.tags?.length && (
            <div className="flex flex-wrap gap-1">{p.tags.slice(0, 4).map(t => <Badge key={t} variant="secondary" className="text-[11px]">{t}</Badge>)}</div>
          )}
          <p className={`text-xs font-medium ${open === true ? 'text-emerald-700' : open === false ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
            {open === true ? 'Nu open' : open === false ? 'Nu gesloten' : 'Openingstijden onbekend'}
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button size="sm" variant="outline" disabled={!p.phone} className="pointer-events-none"><Phone className="mr-1 h-3.5 w-3.5" />Bellen</Button>
            <Button size="sm" disabled={!p.reservationUrl} className="pointer-events-none">Reserveren</Button>
          </div>
        </div>
      </Card>
      {!p.isActive && (
        <p className="text-xs text-muted-foreground">Je pagina is nog niet zichtbaar voor gasten. Voeg gerechten toe onder Menu.</p>
      )}
      <Button variant="outline" className="w-full min-h-11" asChild>
        <Link to={`/restaurant/${p.slug}`} target="_blank" rel="noopener"><ExternalLink className="mr-2 h-4 w-4" />Open je echte pagina</Link>
      </Button>
    </div>
  );
}
