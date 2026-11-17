# Dishloopr — native app (Capacitor)

Deze repo is de Lovable-webapp. Met **Capacitor** verpakken we diezelfde
webcode tot een echte native iOS- en Android-app (lokaal gebundeld, geen
remote webview) — zodat Dishloopr door de App Store (richtlijn 4.2) en
Google Play komt. Zelfde aanpak als Pantrics.

## Eenmalige setup (op je Mac)

```bash
# 1. Repo clonen (als je dat nog niet hebt)
git clone https://github.com/Ginperneur/Dishloopr.git dishloopr-web
cd dishloopr-web
git checkout capacitor-setup

# 2. Setup-script draaien: installeert Capacitor, bouwt de web-app,
#    voegt ios/ + android/ toe, genereert icoon/splash en synct alles.
chmod +x app-setup-capacitor.sh
./app-setup-capacitor.sh

# 3. Openen en bouwen
npx cap open ios        # Xcode → Run
npx cap open android    # Android Studio → Run
```

Je hebt hiervoor **Xcode** (iOS) en/of **Android Studio** nodig — net als bij
Pantrics.

## Web-updates uit Lovable overnemen in de app

Lovable blijft `main` beheren. Nieuwe webwijzigingen haal je zo in de app:

```bash
git pull
npm run build && npx cap sync
```

## Wat er al klaarstaat

- `capacitor.config.ts` — appId `com.dishloopr.app`, oranje splash/statusbar,
  push-notificaties voorbereid
- `app-setup-capacitor.sh` — idempotent setup-script
- Native plugins geïnstalleerd: geolocation, push- & lokale notificaties,
  network (offline), app, browser, status-bar, splash-screen, haptics,
  preferences, keyboard

## Volgende stappen (fase 2 — native functies inbouwen)

Dit zijn de native haakjes die we in de React-code zetten; ze geven de app
de "minimum functionality" die Apple wil zien:

1. **"Bij mij in de buurt"** — `@capacitor/geolocation` → restaurants sorteren op afstand
2. **Push-notificaties** — registratie + token opslaan in Supabase
3. **Offline-melding** — `@capacitor/network` → nette offline-status
4. **Native login-redirect** — Supabase deep link `com.dishloopr.app://` instellen

## Store-checklist

- App-icoon: lever een scherp **1024×1024** logo in `assets/icon-only.png`
- Apple Developer ($99/jr) + Google Play Console ($25 eenmalig)
- Screenshots per vereiste maat (zie Pantrics-flow)
