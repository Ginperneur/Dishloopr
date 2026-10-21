import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'dl_cookie_consent_v1';

type Consent = 'accepted' | 'rejected' | null;

export function getCookieConsent(): Consent {
  try { return (localStorage.getItem(STORAGE_KEY) as Consent) ?? null; } catch { return null; }
}

export function CookieConsent() {
  // Shown on first paint (no delay) so the banner never becomes a late LCP element.
  const [visible, setVisible] = useState(() => typeof window !== 'undefined' && !getCookieConsent());

  const decide = (val: 'accepted' | 'rejected') => {
    try { localStorage.setItem(STORAGE_KEY, val); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie toestemming"
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-4"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-background/95 backdrop-blur shadow-lg p-4 md:p-5 flex flex-col md:flex-row gap-4 md:items-center">
        <div className="flex items-start gap-3 flex-1">
          <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="text-sm text-foreground/90 leading-relaxed">
            We gebruiken functionele cookies van Dishloopr en verwerkers (Supabase voor auth/data, Stripe voor betalingen, Google Maps voor locaties) en optionele analyse om de site te verbeteren.{' '}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-primary">
              Lees meer
            </Link>
            .
          </div>
        </div>
        <div className="flex gap-2 md:shrink-0">
          <Button variant="outline" size="sm" onClick={() => decide('rejected')}>
            Alleen noodzakelijk
          </Button>
          <Button size="sm" onClick={() => decide('accepted')}>
            Accepteren
          </Button>
          <button
            aria-label="Sluiten"
            onClick={() => decide('rejected')}
            className="md:hidden absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}