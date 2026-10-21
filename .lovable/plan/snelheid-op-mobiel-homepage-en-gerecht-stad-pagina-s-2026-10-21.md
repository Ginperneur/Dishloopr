# Snelheid op mobiel: homepage en gerecht×stad-pagina's

## Wat ik al heb gecontroleerd
- 2.184 van de actieve restaurants hebben hun foto's in de eigen opslag. 13 gebruiken nog Unsplash.
- De beeldverkleining van de opslag werkt. Een voorbeeldfoto gaat van 383 kB (JPG, volledig formaat) naar 47 kB (WebP, 400 px breed, kwaliteit 70).
- Lettertypes: er worden nu 8 gewichten geladen (DM Sans 400 tot 900 en Bricolage 700 en 800).
- De meeste pagina's laden al pas als je ze opent, waaronder admin en dashboards. Alleen de homepage en de zoekpagina zitten direct in de app.
- De hulpchat en de cookiemelding worden op elke pagina meteen geladen.

## 1. Afbeeldingen
- Er komt één hulpfunctie die een foto uit de eigen opslag omzet naar een verkleinde WebP-versie: ongeveer 400 px voor kaartjes, 800 px voor tweekoloms-tegels en 1200 px voor de grote foto bovenaan, kwaliteit 70. Foto's van andere bronnen, zoals Unsplash, krijgen hun eigen breedte-instelling.
- Elke foto krijgt een vaste breedte en hoogte of verhouding. Zo springt de pagina niet als de foto binnenkomt.
- Alleen de eerste zichtbare foto laadt met voorrang. Dat is de grote foto op de restaurantpagina, of het eerste kaartje op de homepage of de gerechtpagina. Alle andere foto's laden pas als ze in beeld komen.
- Deze aanpak geldt voor alle 25 plekken met foto's: restaurantkaartjes, uitgelichte restaurants, collecties, "Laatst bekeken", de steden, het fotoalbum op de restaurantpagina, de kaart-popups en de foto's in het menu.

## 2. Verspringen op de homepage voorkomen
- Collecties, "Laatst bekeken", de stedenlijst, de statistiekbalk, uitgelichte restaurants en trending gerechten krijgen tijdens het laden een grijze plaatshouder. Die heeft dezelfde vaste hoogte als het blok dat erna komt.
- "Laatst bekeken" leest meteen wat er in de browser bewaard is. Is er niets, dan neemt het blok vanaf het begin geen ruimte in.
- Blokken die leeg blijken, verdwijnen alleen als ze onder de vouw staan. Bovenaan blijft de ruimte gereserveerd.

## 3. Minder blokkering bij het eerste beeld
- Er worden nog maar 5 gewichten van de lettertypes geladen: DM Sans 400, 500, 600 en 700, en Bricolage Grotesque 700. Alleen DM Sans 400 en Bricolage 700 laden vooraf. Tekst verschijnt meteen in een reservelettertype (font-display: swap).
- Waar nu 800 of 900 staat, wordt dat 700. Dat geldt voor de koppen en de cijferbalk.
- De hulpchat en de cookiemelding laden pas als de pagina rustig is na de eerste weergave.
- Google Analytics laadt ook pas daarna, en alleen na toestemming zoals nu.

## 4. Zware onderdelen apart laden
- De grafieken (recharts) laden alleen op de dashboards en admin-pagina's waar ze gebruikt worden.
- De homepage laadt "Verras me", persoonlijke aanbevelingen, evenementen en "Hoe werkt het" pas als ze in beeld komen. De kaart op de zoekpagina laadt pas als je de kaartweergave opent.
- De zoekpagina blijft direct beschikbaar. De rest van de pagina's laadt al pas als je ze opent.

## 5. Opnieuw meten
- Ik maak een productieversie en meet die met Lighthouse in mobiele modus (Moto G-profiel, trage 4G). Dat doe ik voor de homepage en voor /eten/ramen-amsterdam, en ik meld de score, LCP, CLS en het aantal geladen MB's naast de oude cijfers.
- De officiële PageSpeed-score van dishloopr.com verandert pas na het publiceren. Na het publiceren meet ik die met PageSpeed Insights, zodat de cijfers vergelijkbaar zijn met de jouwe.

## Technische details
- `src/lib/imageUrl.ts`: `optimizedImage(url, { width, quality: 70 })` maakt van `/storage/v1/object/public/` de route `/storage/v1/render/image/public/?width=…&quality=70&format=webp`. Bij Unsplash: `w=`, `q=70` en `fm=webp`. Andere URL's blijven ongewijzigd. Daarnaast een `srcSet`-helper voor 1x en 2x. Unit-tests horen erbij.
- `ImageWithFallback` (en losse `<img>`'s) krijgen de props `width`, `height`, `sizes`, `priority`. Bij `priority` worden het `fetchpriority="high"`, `loading="eager"` en `decoding="async"`, anders `loading="lazy"`.
- `index.html`: één Google Fonts-URL met `wght@400;500;600;700` en `Bricolage+Grotesque:wght@700&display=swap`. Twee font-preloads met de juiste woff2-URL's (opnieuw opgehaald). gtag via `requestIdleCallback`.
- `Layout.tsx` en `App.tsx`: `SupportChat` en `CookieConsent` via `lazy()` plus mount na `requestIdleCallback` of na een time-out van 2 seconden.
- Homepage-secties onder de vouw via `lazy()` en een `IntersectionObserver`-wrapper (`LazySection` met `minHeight`).
- Lighthouse via `npx lighthouse` tegen `vite preview` met de standaard mobiele preset. Daarna PSI API tegen de gepubliceerde URL.
