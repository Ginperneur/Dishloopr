import { Link } from 'react-router-dom';
import { Clock, ImageOff } from 'lucide-react';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useState } from 'react';
import { optimizedImage, imgLoadingProps } from '@/lib/imageUrl';

function SmallImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-5 h-5 text-muted-foreground/40" /></div>;
  return <img src={optimizedImage(src, { width: 160 })} alt={alt} width={160} height={160} className="w-full h-full object-cover" {...imgLoadingProps(false)} onError={() => setFailed(true)} />;
}

export function RecentlyViewed() {
  const { recentlyViewed } = useRecentlyViewed();

  if (recentlyViewed.length === 0) return null;

  return (
    <section className="py-4 md:py-6">
      <div className="container px-4 md:px-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground">Laatst bekeken</h3>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {recentlyViewed.slice(0, 8).map((item) => (
            <Link
              key={item.slug}
              to={`/restaurant/${item.slug}`}
              className="flex-shrink-0 w-[120px] group"
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-muted mb-1.5">
                {item.image ? (
                  <SmallImage src={item.image} alt={item.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageOff className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <p className="text-xs font-medium line-clamp-2 group-hover:text-primary transition-colors">
                {item.name}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
