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
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#F26522',
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
