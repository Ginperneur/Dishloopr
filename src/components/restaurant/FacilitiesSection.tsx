import { Bike, Leaf, ShoppingBag, Sun, BadgeCheck, Sprout, ListChecks, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FACILITY_LABELS, restaurantFacilities, type FacilityFlags, type FacilityKey } from '@/lib/facilities';

const ICONS: Record<FacilityKey, LucideIcon> = {
  halal: BadgeCheck, vegan: Sprout, vegetarian: Leaf, terrace: Sun, delivery: Bike, takeaway: ShoppingBag,
};

/** Dietary and service facilities the owner set (only the ones set to yes). */
export function FacilitiesSection({ restaurant }: { restaurant: FacilityFlags }) {
  const { i18n, t } = useTranslation();
  const keys = restaurantFacilities(restaurant);
  if (!keys.length) return null;
  const nl = (i18n.language || 'nl').startsWith('nl');
  return (
    <section aria-label={t('facilities.title', 'Faciliteiten')} className="space-y-3 py-2">
      <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-primary" /> {t('facilities.title', 'Faciliteiten')}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {keys.map(k => {
          const Icon = ICONS[k];
          return (
            <li key={k} title={nl ? FACILITY_LABELS[k].hint : undefined}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium">
              <Icon className="h-4 w-4 text-primary" aria-hidden />
              {nl ? FACILITY_LABELS[k].nl : FACILITY_LABELS[k].en}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
