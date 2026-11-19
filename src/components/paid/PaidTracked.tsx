import type { ReactNode } from 'react';
import { trackPaidMetric, usePaidImpression, type PaidSurface } from '@/lib/paidPlacements';

/** Counts impressions and clicks of a paid place on one surface for the owner's monthly report. */
export function PaidTracked({ restaurantId, pageSlug, surface, children }: {
  restaurantId: string; pageSlug: string; surface: PaidSurface; children: ReactNode;
}) {
  const ref = usePaidImpression<HTMLDivElement>(restaurantId, pageSlug, surface);
  return (
    <div ref={ref} onClickCapture={() => trackPaidMetric(restaurantId, pageSlug, surface, 'klik')}>
      {children}
    </div>
  );
}
