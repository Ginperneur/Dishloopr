import { vatBreakdown } from '@/lib/vat';

/** What the owner pays in the end, shown right before checkout: "€59 + €12,39 btw = €71,39 per maand". */
export function VatTotal({ exCents, per, className = '' }: { exCents: number; per?: string; className?: string }) {
  if (!Number.isFinite(exCents) || exCents <= 0) return null;
  return (
    <p className={`text-sm text-muted-foreground ${className}`}>
      Je betaalt <span className="font-medium text-foreground">{vatBreakdown(exCents)}</span>{per ? ` ${per}` : ''} inclusief btw.
    </p>
  );
}
