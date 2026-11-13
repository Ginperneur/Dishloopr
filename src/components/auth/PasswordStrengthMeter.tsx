import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { passwordStrength, pwnedCount } from '@/lib/passwordStrength';

export interface PasswordCheck { score: number; pwned: boolean | null; checking: boolean }

const BAR = ['bg-destructive', 'bg-destructive', 'bg-rating', 'bg-tag-vegan', 'bg-tag-vegan'];
const TEXT = ['text-destructive', 'text-destructive', 'text-rating', 'text-tag-vegan', 'text-tag-vegan'];

/**
 * Strength bar with the verdict on the right, tips underneath, and the same leaked-password
 * check Supabase runs on sign-up, so a breached password is caught before submitting.
 */
export function PasswordStrengthMeter({ password, context = [], onCheck, id }: {
  password: string; context?: string[]; onCheck?: (c: PasswordCheck) => void; id?: string;
}) {
  const local = useMemo(() => passwordStrength(password, context), [password, context]);
  const [pwned, setPwned] = useState<{ pw: string; count: number | null } | null>(null);

  useEffect(() => {
    if (password.length < 6) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const count = await pwnedCount(password, ctrl.signal);
      if (!ctrl.signal.aborted) setPwned({ pw: password, count });
    }, 500);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [password]);

  const current = pwned?.pw === password ? pwned.count : undefined;
  const checking = password.length >= 6 && current === undefined;
  const isPwned = current === undefined || current === null ? null : current > 0;
  const score = isPwned ? 0 : local.score;

  useEffect(() => { onCheck?.({ score, pwned: isPwned, checking }); }, [score, isPwned, checking, onCheck]);

  if (!password) return null;
  const label = isPwned ? 'Gelekt' : local.label;

  return (
    <div id={id} className="space-y-1.5" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`h-1.5 rounded-full transition-colors ${i <= Math.max(score, 1) ? BAR[score] : 'bg-muted'}`} />
          ))}
        </div>
        <span className={`min-w-[64px] text-right text-xs font-semibold ${TEXT[score]}`}>
          {checking ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Controleren" /> : label}
        </span>
      </div>
      {isPwned ? (
        <p className="flex gap-1.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Dit wachtwoord komt voor in gelekte wachtwoordlijsten en wordt geweigerd. Kies een ander, bijvoorbeeld drie losse woorden met een cijfer ertussen.
        </p>
      ) : (
        local.tips.length > 0 && <p className="text-xs text-muted-foreground">{local.tips[0]}</p>
      )}
    </div>
  );
}
