import { Car, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { hasParkingInfo, parseParkingInfo } from '@/lib/parking';

export function ParkingSection({ value, cityName }: { value: unknown; cityName?: string }) {
  const { t } = useTranslation();
  const info = parseParkingInfo(value);
  const query = [info.garage_name, info.garage_address, cityName].filter(Boolean).join(', ');

  return (
    <section aria-label={t('parking.title')} className="space-y-3 py-2">
      <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
        <Car className="h-5 w-5 text-primary" /> {t('parking.title')}
      </h2>
      {!hasParkingInfo(info) ? <p className="text-sm text-muted-foreground">{t('parking.unknown')}</p> : (
        <div className="space-y-3 text-sm">
          {info.own_parking !== null && <p>{t(info.own_parking ? 'parking.ownYes' : 'parking.ownNo')}</p>}
          {info.street_parking !== null && <p>{t(info.street_parking ? 'parking.streetYes' : 'parking.streetNo')}</p>}
          {info.garage_name && (
            <div className="space-y-1">
              <p className="font-medium">{t('parking.garage')}: {info.garage_name}</p>
              {info.garage_address && <p className="text-muted-foreground break-words">{info.garage_address}</p>}
              <Button variant="outline" size="sm" asChild>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer">
                  <MapPin className="h-4 w-4 mr-2" /> {t('parking.viewGarage')}
                </a>
              </Button>
            </div>
          )}
          {info.notes && <p className="whitespace-pre-line break-words text-muted-foreground">{info.notes}</p>}
        </div>
      )}
    </section>
  );
}