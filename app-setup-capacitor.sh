#!/usr/bin/env bash
#
# Dishloopr — Capacitor setup (stap 1)
# -----------------------------------
# Maakt van de Vite-webapp een native iOS + Android app met Capacitor,
# op dezelfde manier als Pantrics. Idempotent: je kunt 'm meerdere keren draaien.
#
# Draai dit op je Mac, in de root van de gecloonde repo:
#   chmod +x app-setup-capacitor.sh
#   ./app-setup-capacitor.sh
#
set -euo pipefail

say() { printf "\n\033[1;33m➜ %s\033[0m\n" "$1"; }
ok()  { printf "\033[1;32m✓ %s\033[0m\n" "$1"; }

# --- 0. Checks ---------------------------------------------------------------
command -v node >/dev/null || { echo "Node.js ontbreekt — installeer via https://nodejs.org"; exit 1; }
command -v npm  >/dev/null || { echo "npm ontbreekt"; exit 1; }
[ -f package.json ] || { echo "package.json niet gevonden — draai dit vanuit de root van de gecloonde Dishloopr-repo"; exit 1; }
say "Node $(node -v) / npm $(npm -v)"

# Capacitor-config aanmaken als die er nog niet is (zodat 1 bestand volstaat)
if [ ! -f capacitor.config.ts ]; then
  say "capacitor.config.ts aanmaken"
  cat > capacitor.config.ts <<'CFG'
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
CFG
  ok "capacitor.config.ts gemaakt"
fi

# --- 1. Dependencies ---------------------------------------------------------
say "Capacitor + native plugins installeren"
npm install \
  @capacitor/core@^6 \
  @capacitor/app@^6 \
  @capacitor/browser@^6 \
  @capacitor/geolocation@^6 \
  @capacitor/haptics@^6 \
  @capacitor/keyboard@^6 \
  @capacitor/local-notifications@^6 \
  @capacitor/network@^6 \
  @capacitor/preferences@^6 \
  @capacitor/push-notifications@^6 \
  @capacitor/splash-screen@^6 \
  @capacitor/status-bar@^6

npm install -D \
  @capacitor/cli@^6 \
  @capacitor/ios@^6 \
  @capacitor/android@^6 \
  @capacitor/assets@^3
ok "Dependencies geïnstalleerd"

# --- 2. Webbuild -------------------------------------------------------------
say "Webapp bouwen (vult dist/ die in de app gebundeld wordt)"
npm run build
ok "dist/ gebouwd"

# --- 3. Native platforms toevoegen (alleen als ze nog niet bestaan) ----------
if [ ! -d ios ]; then
  say "iOS-platform toevoegen"
  npx cap add ios
  ok "ios/ toegevoegd"
else
  ok "ios/ bestaat al — overslaan"
fi

if [ ! -d android ]; then
  say "Android-platform toevoegen"
  npx cap add android
  ok "android/ toegevoegd"
else
  ok "android/ bestaat al — overslaan"
fi

# --- 4. App-icoon + splash genereren -----------------------------------------
# @capacitor/assets zoekt in assets/ naar icon-only.png (1024x1024) en
# splash.png (2732x2732). We maken ze best-effort uit de bestaande PWA-iconen.
if [ ! -f assets/icon-only.png ]; then
  mkdir -p assets
  if [ -f public/icon-512.png ]; then
    cp public/icon-512.png assets/icon-only.png
    echo "ℹ︎  assets/icon-only.png gemaakt uit public/icon-512.png."
    echo "   Tip: vervang door een scherp 1024×1024 logo voor de beste kwaliteit."
  fi
fi
if [ -f assets/icon-only.png ]; then
  say "App-icoon + splash genereren"
  npx @capacitor/assets generate --iconBackgroundColor '#F26522' --splashBackgroundColor '#F26522' || \
    echo "ℹ︎  Icoon-generatie overgeslagen (lever later een 1024×1024 logo in assets/)."
fi

# --- 5. Syncen ---------------------------------------------------------------
say "Capacitor syncen (web → native)"
npx cap sync
ok "Sync klaar"

cat <<'EOF'

────────────────────────────────────────────────────────────
✅ Klaar. Dishloopr is nu een native app-project.

Volgende stap — in Xcode / Android Studio bouwen:

  npx cap open ios        # opent in Xcode  → Run op simulator/telefoon
  npx cap open android    # opent in Android Studio

Later web-wijzigingen uit Lovable overnemen in de app:
  git pull                # haal nieuwe webcode op
  npm run build && npx cap sync

────────────────────────────────────────────────────────────
EOF
