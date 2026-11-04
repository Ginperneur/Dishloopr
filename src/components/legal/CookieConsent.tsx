import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';

import { chooseCookies, getCookieConsent, OPEN_COOKIE_SETTINGS, type CookieChoice } from '@/lib/cookieConsent';
export { getCookieConsent } from '@/lib/cookieConsent';

export const COOKIE_BANNER_EVENT = 'dl:cookie-banner-visible';

export function CookieConsent() {
  // Shown on first paint (no delay) so the banner never becomes a late LCP element.
  const [visible, setVisible] = useState(() => typeof window !== 'undefined' && !getCookieConsent());

  useEffect(() => {
    const open = () => setVisible(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, open);
  }, []);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-cookie-banner', visible);
    window.dispatchEvent(new CustomEvent(COOKIE_BANNER_EVENT, { detail: visible }));
  }, [visible]);

  const decide = (val: CookieChoice) => {
    chooseCookies(val);
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
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-background/95 backdrop-blur shadow-lg p-3 md:p-5 flex flex-col md:flex-row gap-3 md:gap-4 md:items-center">
        <div className="flex items-start gap-3 flex-1">
          <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Cookie className="h-5 w-5" />
          </div>
          <p className="text-xs md:text-sm text-foreground/90 leading-relaxed">
            <span className="md:hidden">Mogen we Google Analytics gebruiken om de site te verbeteren? Noodzakelijke cookies staan altijd aan.</span>
            <span className="hidden md:inline">We gebruiken noodzakelijke cookies voor de werking van Dishloopr. Alleen met jouw toestemming gebruiken we Google Analytics voor optionele analyse om de site te verbeteren.</span>{' '}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-primary">
              Lees meer
            </Link>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => decide('necessary')}>
            Alleen noodzakelijk
          </Button>
          <Button size="sm" className="min-h-11 md:min-h-9" onClick={() => decide('accepted')}>
            Accepteren
          </Button>
        </div>
      </div>
    </div>
  );
}
