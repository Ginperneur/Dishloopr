export const CONSENT_KEY = 'dl_cookie_consent_v1';
export const CONSENT_DATE_KEY = `${CONSENT_KEY}_date`;
export const OPEN_COOKIE_SETTINGS = 'dl:open-cookie-settings';
export type CookieChoice = 'accepted' | 'necessary';

export const DENIED_CONSENT = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
} as const;

export function parseCookieChoice(value: string | null): CookieChoice | null {
  if (value === 'accepted') return 'accepted';
  if (value === 'necessary' || value === 'rejected') return 'necessary';
  return null;
}

export function getCookieConsent(): CookieChoice | null {
  try { return parseCookieChoice(localStorage.getItem(CONSENT_KEY)); } catch { return null; }
}

export function persistCookieChoice(storage: Pick<Storage, 'setItem'>, choice: CookieChoice, date = new Date()): void {
  try {
    storage.setItem(CONSENT_KEY, choice);
    storage.setItem(CONSENT_DATE_KEY, date.toISOString());
  } catch { /* The current-page choice still applies if storage is blocked. */ }
}

export function cookieDomains(hostname: string): string[] {
  const labels = hostname.split('.');
  return ['', ...labels.map((_, index) => labels.slice(index).join('.'))];
}

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

let measurementId = '';
let started = false;

function analyticsWindow(): AnalyticsWindow { return window as AnalyticsWindow; }

function queue(..._args: unknown[]) {
  // gtag expects an Arguments object, not an array.
  // eslint-disable-next-line prefer-rest-params
  analyticsWindow().dataLayer?.push(arguments);
}

export function clearAnalyticsCookies(): void {
  const names = document.cookie.split(';').map(cookie => cookie.trim().split('=')[0])
    .filter(name => /^_ga(?:_|$)/.test(name));
  const paths = new Set(['/', ...location.pathname.split('/').map((_, index, parts) => parts.slice(0, index + 1).join('/') || '/')]);
  for (const name of names) {
    for (const domain of cookieDomains(location.hostname)) {
      for (const path of paths) {
        document.cookie = `${name}=; Max-Age=0; path=${path}${domain ? `; domain=${domain}` : ''}; SameSite=Lax`;
      }
    }
  }
}

function startAnalytics(): void {
  if (started || !/^G-[A-Z0-9]+$/.test(measurementId)) return;
  started = true;
  analyticsWindow().gtag = queue;
  queue('consent', 'update', { analytics_storage: 'granted' });
  queue('set', 'developer_id.dZjgwMW', true);
  queue('js', new Date());
  queue('config', measurementId);
  const script = document.createElement('script');
  script.id = 'dl-google-analytics';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

export function initializeCookieAnalytics(id: string | undefined): void {
  measurementId = id ?? '';
  analyticsWindow().dataLayer = analyticsWindow().dataLayer || [];
  queue('consent', 'default', DENIED_CONSENT);
  if (getCookieConsent() === 'accepted') startAnalytics();
  else clearAnalyticsCookies();
}

export function chooseCookies(choice: CookieChoice): void {
  try { persistCookieChoice(localStorage, choice); } catch { /* Storage access can throw. */ }
  if (choice === 'accepted') {
    startAnalytics();
  } else {
    if (started) {
      (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true;
      queue('consent', 'update', DENIED_CONSENT);
      document.getElementById('dl-google-analytics')?.remove();
    }
    clearAnalyticsCookies();
    // Remove the already-running library and pending requests after withdrawal.
    if (started) location.reload();
  }
}

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS));
}