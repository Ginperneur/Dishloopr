import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ReservationWidgetProps {
  zenchefId?: string | null;
  reservationUrl?: string | null;
  restaurantName: string;
  variant?: 'full' | 'button';
}

declare global {
  interface Window {
    zenchefWidget?: {
      init: (options: { restaurantId: string; container: HTMLElement }) => void;
    };
  }
}

export function ReservationWidget({ 
  zenchefId, 
  reservationUrl, 
  restaurantName,
  variant = 'full'
}: ReservationWidgetProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [widgetError, setWidgetError] = useState(false);

  useEffect(() => {
    if (!zenchefId || !containerRef.current) return;

    // Load Zenchef SDK script
    const script = document.createElement('script');
    script.src = 'https://sdk.zenchef.com/sdk/zenchef-sdk.min.js';
    script.async = true;
    script.onload = () => {
      if (window.zenchefWidget && containerRef.current) {
        try {
          window.zenchefWidget.init({
            restaurantId: zenchefId,
            container: containerRef.current
          });
          setWidgetLoaded(true);
        } catch (error) {
          console.error('Zenchef widget init error:', error);
          setWidgetError(true);
        }
      }
    };
    script.onerror = () => {
      console.error('Failed to load Zenchef SDK');
      setWidgetError(true);
    };

    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [zenchefId]);

  // No reservation option available
  if (!zenchefId && !reservationUrl) {
    return null;
  }

  // Button-only variant for mobile/compact views
  if (variant === 'button') {
    if (zenchefId && !widgetError) {
      return (
        <Button className="flex-1" size="default" asChild>
          <a 
            href={`https://widget.zenchef.com/reservation/${zenchefId}`} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Calendar className="h-4 w-4 mr-2" />
            {t('restaurant.reserve')}
          </a>
        </Button>
      );
    }
    
    if (reservationUrl) {
      return (
        <Button className="flex-1" size="default" asChild>
          <a href={reservationUrl} target="_blank" rel="noopener noreferrer">
            <Calendar className="h-4 w-4 mr-2" />
            {t('restaurant.reserve')}
          </a>
        </Button>
      );
    }
    
    return null;
  }

  // Full widget variant for sidebar
  return (
    <div className="p-6 rounded-2xl border border-border bg-card">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        Reserveren
      </h3>

      {/* Zenchef embedded widget */}
      {zenchefId && !widgetError && (
        <div 
          ref={containerRef}
          className="min-h-[300px] rounded-lg overflow-hidden"
          aria-label={`Reserveer bij ${restaurantName}`}
        >
          {!widgetLoaded && (
            <div className="flex items-center justify-center h-[300px] bg-muted/50 rounded-lg animate-pulse">
              <span className="text-sm text-muted-foreground">Widget laden...</span>
            </div>
          )}
        </div>
      )}

      {/* Fallback to external reservation link */}
      {(widgetError || !zenchefId) && reservationUrl && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Reserveer direct bij {restaurantName}
          </p>
          <Button className="w-full" size="lg" asChild>
            <a href={reservationUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('restaurant.reserve')}
            </a>
          </Button>
        </div>
      )}

      {/* Show both options if Zenchef widget loaded but also has fallback */}
      {zenchefId && widgetLoaded && reservationUrl && (
        <div className="mt-4 pt-4 border-t border-border">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href={reservationUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-2" />
              Reserveer via website
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
