import { Button } from '@/components/ui/button';
import { ExternalLink, Calendar, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ReserveButton } from './ReserveButton';
import { reservationMode, type PublicReservationOption } from '@/lib/reservationIntegration';
import { NATIVE_RESERVATIONS_ENABLED } from '@/hooks/useReservationOptions';
import { isZenchefId, zenchefBookingUrl, zenchefPartnerId } from '@/lib/zenchef';
import { useZenchefSdk } from '@/hooks/useZenchefSdk';

interface ReservationWidgetProps {
  restaurantId: string;
  zenchefId?: string | null;
  reservationUrl?: string | null;
  restaurantName: string;
  variant?: 'full' | 'button';
  phone?: string | null;
  googleMapsUrl?: string | null;
  googlePlaceId?: string | null;
  option?: PublicReservationOption | null;
  metricContext?: string;
  onClickTrack?: (type: string) => void;
}

export function ReservationWidget({
  restaurantId,
  zenchefId,
  reservationUrl,
  restaurantName,
  variant = 'full',
  phone,
  googleMapsUrl,
  googlePlaceId,
  option,
  metricContext = 'zoek',
  onClickTrack
}: ReservationWidgetProps) {
  const { t } = useTranslation();
  const providerId = option?.external_restaurant_id ?? (isZenchefId(zenchefId) ? zenchefId : null);
  const mode = reservationMode({ option, zenchefId: providerId, reservationUrl, nativeEnabled: NATIVE_RESERVATIONS_ENABLED });
  // Shared, load-once SDK state: lets the card hide Zenchef hints when Zenchef refuses the widget.
  const sdk = useZenchefSdk(mode === 'widget' ? providerId : null, option?.lang);
  const zenchefUnavailable = sdk === 'unavailable';

  // No digital reservation — show phone or Google Maps fallback
  if (mode === 'none' || (zenchefUnavailable && !reservationUrl)) {
    // Google Reserve fallback: opens the GBP profile where the Reserve button is shown
    const googleReserveUrl = googlePlaceId
      ? `https://www.google.com/maps/place/?q=place_id:${googlePlaceId}`
      : null;

    if (variant === 'button') {
      if (googleReserveUrl) {
        return (
          <Button className="flex-1" size="default" onClick={() => onClickTrack?.('reservation_google')} asChild>
            <a href={googleReserveUrl} target="_blank" rel="noopener noreferrer">
              <Calendar className="h-4 w-4 mr-2" />
              {t('restaurant.reserve')}
            </a>
          </Button>
        );
      }
      if (phone) {
        return (
          <Button className="flex-1" size="default" variant="outline" asChild>
            <a href={`tel:${phone}`}>
              <Phone className="h-4 w-4 mr-2" />
              {t('openingHours.callNow', 'Bellen')}
            </a>
          </Button>
        );
      }
      return null;
    }

    // Full variant fallback
    if (googleReserveUrl || phone || googleMapsUrl) {
      return (
        <div className="p-6 rounded-2xl border border-border bg-card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Reserveren
          </h3>
          <div className="space-y-3">
            {googleReserveUrl ? (
              <p className="text-sm text-muted-foreground">
                Reserveer direct via het Google-profiel van {restaurantName}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Dit restaurant heeft geen online reserveringssysteem. Neem direct contact op:
              </p>
            )}
            {googleReserveUrl && (
              <Button className="w-full" size="lg" onClick={() => onClickTrack?.('reservation_google')} asChild>
                <a href={googleReserveUrl} target="_blank" rel="noopener noreferrer">
                  <Calendar className="h-4 w-4 mr-2" />
                  Reserveer via Google
                </a>
              </Button>
            )}
            {phone && (
              <Button variant={googleReserveUrl ? 'outline' : 'default'} className="w-full" size={googleReserveUrl ? 'default' : 'lg'} asChild>
                <a href={`tel:${phone}`}>
                  <Phone className="h-4 w-4 mr-2" />
                  Bel {phone}
                </a>
              </Button>
            )}
            {googleMapsUrl && (
              <Button variant="outline" className="w-full" size="default" asChild>
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Bekijk op Google Maps
                </a>
              </Button>
            )}
          </div>
        </div>
      );
    }
    return null;
  }

  const reserve = (className: string) => (
    <ReserveButton
      restaurantId={restaurantId}
      restaurantName={restaurantName}
      mode={mode}
      zenchefId={providerId}
      lang={option?.lang}
      timezone={option?.timezone}
      reservationUrl={reservationUrl}
      metricContext={metricContext}
      onClickTrack={onClickTrack}
      className={className}
      size={variant === 'button' ? 'default' : 'lg'}
    >
      <Calendar className="h-4 w-4" />
      {t('restaurant.reserve')}
    </ReserveButton>
  );

  // Button-only variant for mobile/compact views
  if (variant === 'button') return reserve('flex-1');

  // Full variant for the sidebar: the official Zenchef widget opens as an overlay.
  return (
    <div className="p-6 rounded-2xl border border-border bg-card">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        Reserveren
      </h3>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {mode === 'link' || zenchefUnavailable ? `Reserveer direct bij ${restaurantName}` : `Kies datum, tijd en aantal personen in het reserveringssysteem van ${restaurantName}.`}
        </p>
        {reserve('w-full')}
        {mode === 'widget' && providerId && !zenchefUnavailable && (
          <a
            href={zenchefBookingUrl(providerId, { lang: option?.lang, partnerId: zenchefPartnerId() })}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onClickTrack?.('reservation')}
          >
            <ExternalLink className="h-3 w-3" />
            Opent het niet? Reserveer in een nieuw tabblad
          </a>
        )}
        {mode === 'widget' && !zenchefUnavailable && reservationUrl && (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href={reservationUrl} target="_blank" rel="noopener noreferrer" onClick={() => onClickTrack?.('reservation')}>
              <ExternalLink className="h-3 w-3 mr-2" />
              Reserveer via website
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
