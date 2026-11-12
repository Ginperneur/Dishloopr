import { useEffect, useState, type ReactNode } from 'react';
import { Calendar } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useZenchefSdk } from '@/hooks/useZenchefSdk';
import { isZenchefId, widgetBookingId, zenchefBookingUrl, zenchefPartnerId } from '@/lib/zenchef';
import { trackReservationFunnel } from '@/lib/reservationFunnel';
import type { ReservationMode } from '@/lib/reservationIntegration';
import { NativeReservationFlow } from './NativeReservationFlow';

interface ReserveButtonProps {
  restaurantId: string;
  restaurantName: string;
  mode: ReservationMode;
  zenchefId?: string | null;
  lang?: string | null;
  timezone?: string;
  reservationUrl?: string | null;
  metricContext: string;
  onClickTrack?: (type: string) => void;
  className?: string;
  size?: ButtonProps['size'];
  children?: ReactNode;
}

/**
 * One reserve button for every placement on the restaurant page.
 * native -> Dishloopr booking flow; widget -> official Zenchef overlay (link while the
 * SDK loads, failed, or is bound to another restaurant); link -> restaurant's own URL.
 */
export function ReserveButton({
  restaurantId, restaurantName, mode, zenchefId, lang, timezone, reservationUrl, metricContext, onClickTrack, className, size = 'lg', children,
}: ReserveButtonProps) {
  const widgetId = mode === 'widget' && isZenchefId(zenchefId) ? zenchefId : null;
  const sdk = useZenchefSdk(widgetId, lang);
  const [nativeOpen, setNativeOpen] = useState(false);

  useEffect(() => {
    if (!widgetId || sdk !== 'ready') return;
    const opened = () => trackReservationFunnel(restaurantId, 'widget_opened', metricContext);
    const booked = (e: Event) => {
      const id = widgetBookingId((e as CustomEvent).detail);
      if (id) trackReservationFunnel(restaurantId, 'widget_booking_reported', metricContext, id);
    };
    window.addEventListener('zc-widget-opened', opened);
    window.addEventListener('zc-widget-booking-completed', booked);
    return () => {
      window.removeEventListener('zc-widget-opened', opened);
      window.removeEventListener('zc-widget-booking-completed', booked);
    };
  }, [widgetId, sdk, restaurantId, metricContext]);

  const label = (
    // pointer-events-none: the SDK only reacts when the click target itself has data-zc-action.
    <span className="pointer-events-none inline-flex items-center justify-center gap-2">
      {children ?? (<><Calendar className="h-5 w-5" />Reserveer een tafel</>)}
    </span>
  );

  if (mode === 'native') {
    return (
      <>
        <Button type="button" className={className} size={size} onClick={() => { onClickTrack?.('reservation'); trackReservationFunnel(restaurantId, 'flow_started', metricContext); setNativeOpen(true); }}>
          {label}
        </Button>
        <NativeReservationFlow open={nativeOpen} onOpenChange={setNativeOpen} restaurantId={restaurantId} restaurantName={restaurantName} timezone={timezone} metricContext={metricContext} />
      </>
    );
  }

  if (widgetId && sdk === 'ready') {
    return (
      <Button type="button" data-zc-action="open" className={className} size={size} onClick={() => onClickTrack?.('reservation')} aria-haspopup="dialog">
        {label}
      </Button>
    );
  }

  // Zenchef refused the widget for this restaurant: use the restaurant's own link, or show nothing.
  const href = widgetId && sdk === 'unavailable'
    ? reservationUrl ?? null
    : widgetId ? zenchefBookingUrl(widgetId, { lang, partnerId: zenchefPartnerId() }) : mode === 'link' ? reservationUrl : null;
  const viaZenchef = !!widgetId && sdk !== 'unavailable';
  if (!href) return null;
  return (
    <Button className={className} size={size} asChild>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => { onClickTrack?.('reservation'); if (viaZenchef) trackReservationFunnel(restaurantId, 'widget_opened', metricContext); }}
      >
        {label}
      </a>
    </Button>
  );
}
