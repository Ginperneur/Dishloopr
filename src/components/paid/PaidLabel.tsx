import { Link } from 'react-router-dom';
import { PAID_EXPLAINED_PATH, type PaidKind } from '@/lib/paidPlacements';

/** The kind of paid place plus "Betaald": every paid place carries both, on every surface. */
export function PaidLabel({ kind, founding, className = '' }: { kind: PaidKind | 'spotlight'; founding?: boolean; className?: string }) {
  const name = kind === 'topplek' ? 'Topplek' : kind === 'spotlight' ? 'Stadsspotlight' : 'Uitgelicht';
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${kind === 'topplek' ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'}`}>{name}</span>
      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">Betaald</span>
      {founding && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">Founding Partner</span>}
    </span>
  );
}

export function WhyPaidLink({ className = '' }: { className?: string }) {
  return <Link to={PAID_EXPLAINED_PATH} className={`text-sm text-primary underline-offset-2 hover:underline ${className}`}>Waarom zie ik dit?</Link>;
}
