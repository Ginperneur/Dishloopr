import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { MoodImage } from '@/components/restaurant/MoodImage';
import { useTranslation } from 'react-i18next';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useState } from 'react';
import { optimizedImage, imgLoadingProps } from '@/lib/imageUrl';

function SmallImage({ src, alt, slug }: { src: string; alt: string; slug: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <MoodImage seed={slug} name={alt} size="thumb" />;
  return <img src={optimizedImage(src, { width: 160 })} alt={alt} width={160} height={160} className="w-full h-full object-cover" {...imgLoadingProps(false)} onError={() => setFailed(true)} />;
}

export function RecentlyViewed() {
  const { t } = useTranslation();
  const { recentlyViewed, clear } = useRecentlyViewed();

  if (recentlyViewed.length === 0) return null;

  return (
    <section className="py-3 md:py-4" aria-labelledby="recently-viewed-heading">
      <div className="container px-4 md:px-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 id="recently-viewed-heading" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden="true" />{t('home.recentlyViewed')}
          </h2>
          <button type="button" onClick={clear} className="min-h-9 px-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {t('home.clearRecentlyViewed', 'Wissen')}
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {recentlyViewed.slice(0, 8).map((item) => (
            <Link
              key={item.slug}
              to={`/restaurant/${item.slug}`}
              className="flex-shrink-0 w-[104px] group"
            >
              <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-muted mb-1">
                {item.image ? (
                  <SmallImage src={item.image} alt={item.name} slug={item.slug} />
                ) : (
                  <MoodImage seed={item.slug} name={item.name} size="thumb" />
                )}
              </div>
              <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                {item.name}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
