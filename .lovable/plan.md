# Pagina "Je staat op Dishloopr" (/voor-restaurants/:slug)

## Wat er komt
Een persoonlijke pagina voor eigenaren die via de mail binnenkomen. Niet vindbaar in Google (noindex, niet in de sitemap). De vaste pagina's afmelden, pakketten en bedankt blijven voorgaan.

Volgorde op de pagina:
1. **Kop** – "<naam> staat op Dishloopr", foto, adres, knop "Claim gratis" naar /claim/<slug>. Al geclaimd: "Dit restaurant is al geclaimd" + link naar inloggen.
2. **Hier word je gevonden** – max. 10 gerechtpagina's met positie ("#2 van 14"), beste positie eerst, elk met link naar /eten/<slug>.
3. **Dit ontbreekt nog** – automatische checklist: gerechten zonder prijs (aantal), openingstijden, foto's, sfeertags, parkeerinfo; elk met "na het claimen vul je dit zelf in". Ontbreekt niets, dan een korte "alles compleet"-melding.
4. **Extra zichtbaarheid** – Founding Partner: €59 per maand excl. btw, maximaal 2 per gerechtpagina, betalen vanaf de launchdatum; knop naar /voor-restaurants/pakketten.
5. **Onderaan** – "Klopt er iets niet of wil je niet op Dishloopr? Pas aan of verwijder" → /voor-restaurants/afmelden?slug=<slug>.

Onbekende slug: nette "niet gevonden"-melding met link naar de homepage.

## Meten
- Bij openen: één regel in analytics_events met event "claimpagina_bekeken" en de slug (plus restaurant). Werkt ook voor niet-ingelogde bezoekers (bestaande insert-regel staat dit al toe), zonder persoonsgegevens.
- GA-event claim_start alleen bij klik op "Claim gratis" (via bestaande toestemmingsmodule), niet bij openen.

## Technische details
- Route `/voor-restaurants/:slug` in `App.tsx` ná de drie vaste routes; lazy geladen pagina `RestaurantInvitePage.tsx`; Helmet `robots=noindex,follow`; sitemapgenerator ongewijzigd (pakt deze route niet op – wordt gecontroleerd).
- Nieuwe databasefunctie `restaurant_positions(p_slug text)` (security definer, `search_path=public`, uitvoerbaar voor anon/authenticated) → `page_slug, dish_name, position, total`. Rekent per dish×stad-pagina waarop het restaurant een goedgekeurd gerecht heeft, met exact dezelfde volgorde als de gerechtpagina's: uitgelicht eerst, dan top-listing, dan rating aflopend; met dezelfde selectie (actief, goedgekeurd, zelfde stad, canonical_slug/hub-leden zoals `seoLandingLoader`). Gelijke ratings krijgen een vaste tie-break die ook in de loader wordt gezet (naam, dan id), zodat de cijfers op beide plekken altijd gelijk zijn. Alleen pagina's die bestaan (geen `gerecht`-slug). Gesorteerd op positie, limit 10.
- Checklist uit bestaande publieke velden van restaurant en menu (prijs null, opening_hours leeg, geen foto's, ambience_tags leeg, parking_info null).
- Kleine unit-test voor de checklistregels en de tie-break in de sortering.

## Testen
Drie bestaande slugs in de preview openen, posities uit de functie vergelijken met de werkelijke volgorde op de bijbehorende /eten-pagina's, en de posities rapporteren. Controleren: noindex aanwezig, afmelden/pakketten/bedankt werken nog, analytics-regel verschijnt, claim_start pas na klik.
