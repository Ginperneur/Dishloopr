import { Link } from 'react-router-dom';
import { Clock, ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useState } from 'react';
import { optimizedImage, imgLoadingProps } from '@/lib/imageUrl';

function SmallImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-5 h-5 text-muted-foreground/40" /></div>;
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
              <div className="aspect-[16/10] rounded-lg overflow-hidden bg-muted mb-1">
                {item.image ? (
                  <SmallImage src={item.image} alt={item.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageOff className="w-6 h-6 text-muted-foreground/30" />
                  </div>
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
