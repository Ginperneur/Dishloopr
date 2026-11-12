import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { deepLinkToRoute, isNativeApp, nativePlatform } from '@/lib/native';
import { registerForPush } from '@/lib/nativePush';

/**
 * Native-only glue for the Capacitor app: deep links, Android back button,
 * status bar, splash, offline banner and push registration.
 * Renders nothing on the web.
 */
export function NativeBridge() {
  if (!isNativeApp()) return null;
  return <NativeBridgeInner />;
}

function NativeBridgeInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [offline, setOffline] = useState(false);
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  // Splash + status bar once the web app is up.
  useEffect(() => {
    SplashScreen.hide().catch(() => {});
    const dark = document.documentElement.classList.contains('dark');
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  }, []);

  // Deep links (com.dishloopr.app://… and dishloopr.nl links) and Android back button.
  useEffect(() => {
    const subs = [
      CapApp.addListener('appUrlOpen', ({ url }) => {
        const route = deepLinkToRoute(url);
        if (route) navigate(route);
      }),
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack && pathRef.current !== '/') window.history.back();
        else CapApp.exitApp();
      }),
    ];
    return () => {
      subs.forEach((p) => p.then((s) => s.remove()).catch(() => {}));
    };
  }, [navigate]);

  // Offline banner.
  useEffect(() => {
    Network.getStatus().then((s) => setOffline(!s.connected)).catch(() => {});
    const sub = Network.addListener('networkStatusChange', (s) => setOffline(!s.connected));
    return () => {
      sub.then((s) => s.remove()).catch(() => {});
    };
  }, []);

  // Push: ask only once someone is signed in, never on first launch.
  useEffect(() => {
    if (!user) return;
    if (nativePlatform() === 'android' && import.meta.env.VITE_ANDROID_PUSH_ENABLED !== 'true') return;
    registerForPush(user.id).catch((err) => console.warn('[push] registration failed', err));
  }, [user]);

  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-destructive px-4 pb-2 text-sm font-medium text-destructive-foreground"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      Geen internetverbinding. Restaurants laden zodra je weer online bent.
    </div>
  );
}
