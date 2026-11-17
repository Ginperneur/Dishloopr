import { Capacitor } from '@capacitor/core';

/** Public web origin. In the native app `window.location.origin` is capacitor://localhost or https://localhost. */
export const WEB_ORIGIN = 'https://dishloopr.nl';

/** Custom URL scheme registered in Info.plist and AndroidManifest.xml. */
export const APP_SCHEME = 'com.dishloopr.app';

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

export const nativePlatform = (): 'ios' | 'android' | 'web' =>
  Capacitor.getPlatform() as 'ios' | 'android' | 'web';

/**
 * Origin to put in links that leave the device (auth e-mails, shares).
 * Those links must open a real web page, never the app's local origin.
 */
export const publicOrigin = (): string => (isNativeApp() ? WEB_ORIGIN : window.location.origin);

/**
 * Turn an incoming deep link into an in-app route.
 * Accepts com.dishloopr.app://restaurant/x and https://dishloopr.nl/restaurant/x.
 */
export function deepLinkToRoute(url: string): string | null {
  try {
    if (url.startsWith(`${APP_SCHEME}://`)) {
      const rest = url.slice(`${APP_SCHEME}://`.length);
      return `/${rest.replace(/^\/+/, '')}`;
    }
    const parsed = new URL(url);
    if (/(^|\.)dishloopr\.(nl|com)$/.test(parsed.hostname)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
    }
  } catch {
    /* not a URL we handle */
  }
  return null;
}
