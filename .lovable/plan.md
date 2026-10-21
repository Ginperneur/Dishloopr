# Zoeklog koppelen

## Wat je krijgt
- Elke nieuwe zoekopdracht (nieuwe term, stad of filter) wordt na het laden één keer gelogd, met het aantal resultaten (ook 0), de actieve filters en een anonieme browser-id.
- Klikt een bezoeker op een restaurant uit die resultaten, dan wordt de klik aan die zoekopdracht gekoppeld.
- Nieuwe admin-pagina "Zoeklog" met periode (1/7/30/90 dagen), schakelaar "alleen zonder resultaat", tabel en CSV-export.
- Loggen gebeurt op de achtergrond: zoeken wordt er nooit trager of kapot door.

## Waar wordt gelogd
- /search: bron `search` (term, stad, filters prijs/sfeer/maaltijdtype/open nu/dieet).
- Gerecht- en gerecht×stad-pagina's: bron `dish_page` (gerecht als term, stad, facet als filter).
- Stadspagina's: bron `city_page` (lege term, stadsnaam).
- Niet gelogd: suggesties in de zoekbalk, scrollen, sorteren, pagineren, terugkeren naar dezelfde zoekopdracht.

## Test in de preview
Zoeken op "xyzgerecht" (0 resultaten) en "ramen", een restaurant aanklikken, daarna in het admin-overzicht controleren dat beide termen er staan en "ramen" 1 klik heeft. Daarvoor is een ingelogde beheerder nodig: log in de preview in met je beheerdersaccount (of geef aan welk account ik mag gebruiken), anders kan alleen het loggen zelf gecontroleerd worden.

## Technische details
- `src/lib/searchLog.ts`:
  - `getSessionId()`: `crypto.randomUUID()` in localStorage `dl_search_session`, alles in try/catch (fallback: in-memory id).
  - `useSearchLogger({ query, city, filters, resultsCount, source, ready })`: bouwt een stabiele key (term+stad+gesorteerde filters); bij nieuwe key en `ready` een timer van 1,5 s; daarna `supabase.rpc('log_search', …)` zonder await in het zoekpad; fouten genegeerd. Retourneert het log-id (state) en bewaart het in sessionStorage `dl_last_search_log` (id + key), zodat de kaart het kan lezen en terugnavigatie niet opnieuw logt.
  - `logSearchClick(restaurantId)`: leest het laatste log-id, `rpc('log_search_click')` fire-and-forget.
  - Pure helper `buildFilterPayload` en `csvEscape` (prefix `'` voor waarden die met `= + - @` beginnen, plus quote-escaping).
- Koppelen in `SearchPage.tsx` (na `useSearch` klaar), `DishCityPage.tsx`/`DishPillarPage.tsx` (na `useSeoLandingPage`), `CityDetailPage.tsx` (na overview load).
- Klik: `onClick` op de link in `DatabaseRestaurantCard.tsx` en de kaartpopup-links op de zoekpagina.
- Admin: `src/components/admin/SearchLogReport.tsx` met `rpc('search_log_report', { p_days, p_only_zero })` (functie controleert zelf admin-rol); nieuwe sectie `search-log` in AdminPanel + sidebar-item "Zoeklog".
- Geen databasewijzigingen; de drie functies bestaan en zijn aanroepbaar.
- Unit-tests (`e2e/search-log.test.ts`): CSV-escaping, filter-key stabiel bij gelijke filters en anders bij ander filter, debounce logt één keer bij snelle wijzigingen.
