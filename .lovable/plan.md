# Pakketpagina en bedankpagina voor restaurants

## Wat er komt
**/voor-restaurants/pakketten**: vier kaarten naast elkaar, op mobiel onder elkaar. Onder elke prijs staat "excl. btw".
1. **Gratis, €0**: je pagina claimen, menukaart, openingstijden en foto's beheren, basisstatistieken. Knop "Claim gratis".
2. **Founding Partner**: €59 per maand of €590 per jaar, vaste prijs zolang je klant blijft. Uitgelichte plek op 1 gerechtpagina in je stad met het label "Uitgelicht", maximaal 2 per gerechtpagina, badge "Founding Partner", maandrapport. Daaronder: "Je betaalt pas vanaf de launchdatum. Gaat de launch niet door, dan krijg je je geld terug." Knoppen "Per maand" en "Per jaar".
3. **Menuservice**: €79 eenmalig of €19 per maand. Je volledige menukaart online, vertaald in het Engels, Duits en Frans, als QR-menu en voor je eigen website. Knoppen "Eenmalig" en "Per maand".
4. **Pro**, label "Binnenkort", vanaf €29 per maand: uitgebreide statistieken, reageren op reviews, meertalig menu. Knop "Houd me op de hoogte".

**Founding-knop**: eerst kies je uit een lijst om welke gerechtpagina het gaat. Dat zijn de pagina's waarop het restaurant staat, met hun positie. Daarna ga je naar de Stripe-betaallink, met die keuze erin meegestuurd (client_reference_id = restaurant + pagina). Welk restaurant het is, haalt de pagina uit `?slug=`: de knop op de "Je staat op Dishloopr"-pagina geeft die mee. Voor ingelogde eigenaren komt hij van hun eigen restaurant. Is er geen restaurant bekend, dan vraagt de keuzelijst om eerst je restaurant te claimen of in te loggen.

**Lege betaallink**: zolang een link in de instellingen leeg is, staat bij die knop "Binnenkort beschikbaar" in plaats van een kapotte link. Er komt geen eigen checkout.

**"Nog <n> plekken in <stad>" wordt weggelaten.** Aankopen via betaallinks komen nu niet in de database terecht, dus het aantal vrije plekken is niet betrouwbaar te tellen.

**Pro-wachtlijst**: een nieuwe, aparte lijst met e-mailadres en optioneel restaurant. Iedereen kan zich aanmelden en alleen admins kunnen de lijst lezen. Een tweede aanmelding met hetzelfde adres krijgt de melding "Je staat al op de lijst".

**/voor-restaurants/bedankt**: "Bedankt! We zetten je plek binnen 1 werkdag live en sturen je een bevestiging." Met links naar het dashboard en de homepage. Deze pagina staat op "niet indexeren".

**Links**: een link "Pakketten" in de footer onder "Voor restaurants" en een kaart of knop naar de pakketpagina op het eigenaarsdashboard.

**Meten**: bij het openen van de pagina gaat `view_packages` naar Google Analytics, en bij elke knopklik `click_package {package}` (bijv. free, founding_month, founding_year, menu_once, menu_month, pro_waitlist). Dat gebeurt alleen na cookietoestemming, zoals nu ook.

## Technische details
- De instellingen zijn alleen voor admins leesbaar. Daarom komt er een databasefunctie `public_package_links()` (security definer) die uitsluitend de vier sleutels `founding_month_url`, `founding_year_url`, `menu_once_url` en `menu_month_url` teruggeeft, en alleen geldige https-links. Anon en ingelogde bezoekers mogen hem aanroepen.
- Nieuwe tabel `pro_waitlist` (id, email, restaurant_id nullable, created_at, unique lower(email)). GRANT INSERT aan anon/authenticated, ALL aan service_role. RLS: insert voor iedereen met een geldig e-mailadres (max 255 tekens), select alleen voor admins.
- De client_reference_id wordt opgebouwd als `<restaurant_id>__<page_slug>` en blijft binnen de Stripe-grens van 200 tekens en de toegestane tekens. Er komt een helper met een unit-test.
- De gerechtpagina's voor de keuzelijst komen uit de bestaande functie `restaurant_positions(slug)`.
- De huidige route `/voor-restaurants/pakketten` (nu de oude pagina "Voor restaurants") wordt vervangen door de nieuwe `PackagesPage`. De route `bedankt` wijst nu naar `ThanksPage` in plaats van door te sturen naar het dashboard. Beide routes blijven vóór de `:slug`-route staan.
- Testen in de preview: kaarten op desktop en mobiel, lege links tonen "Binnenkort beschikbaar", de keuzelijst plus doorverwijzing zet client_reference_id in de link, de Pro-aanmelding wordt opgeslagen en de GA-events gaan af.
