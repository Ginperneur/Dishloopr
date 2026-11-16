import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dishloopr.app',
  appName: 'Dishloopr',
  // De Vite-build levert een statische client-bundel in dist/.
  // Die wordt lokaal in de app gebundeld — een echte native app,
  // geen remote webview (belangrijk voor Apple review 4.2).
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  // WebView-achtergrond gelijk aan de site (gebroken wit #F7F4F1), zodat er
  // tussen splash en eerste render nooit een wit vlak verschijnt.
  backgroundColor: '#F7F4F1',
  plugins: {
    SplashScreen: {
      // De app verbergt de splash zelf zodra de eerste pagina staat
      // (NativeSplashGate), met een vangnet na 8 seconden.
      launchAutoHide: false,
      backgroundColor: '#F7F4F1',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'Light',
      backgroundColor: '#F26522',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
