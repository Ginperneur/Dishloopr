# Vijf kleine verbeteringen

## 1. Knop 'Uitgelicht' alleen tonen als er iets uitgelicht is
- Eén kleine controle telt of er minstens 1 actief restaurant is dat uitgelicht of bovenaan geplaatst is (`is_featured` of `is_top_listing`). Het resultaat wordt 5 minuten bewaard, zodat het menu niet bij elke pagina opnieuw vraagt.
- Bij 0 verdwijnt de knop 'Uitgelicht'. Zodra er 1 bij komt, staat hij er automatisch weer.
- De knop staat nu alleen in de bovenste navigatie. In de footer en het snelmenu onderaan staat hij niet. Duikt hij daar later toch op, dan geldt dezelfde regel.

## 2. Score op de collectiepagina (/collection/:slug)
- Score en aantal reviews komen uit `google_rating` en `google_reviews_count`, met dezelfde opmaak als op de zoekkaarten.
- Is `google_rating` leeg of 0, dan staan er geen sterren.
- `featured_reason` wordt gewone grijze tekst: niet cursief, zonder aanhalingstekens.

## 3. Titel van de zoekpagina
- "… restaurants in Europa" wordt "… restaurants in Nederland". Is er een stad gekozen, dan staat de stadsnaam erin.
- Dat geldt ook voor de omschrijving van de pagina, in alle vijf talen.

## 4. Foutpagina's niet laten indexeren
- De 404-pagina en de pagina 'Restaurant niet gevonden' krijgen allebei `noindex, nofollow`. Nu heeft de 404-pagina alleen `noindex` en heeft 'Restaurant niet gevonden' niets.

## 5. Leeg parkeerblok verbergen
- Het blok 'Parkeergelegenheid' op de restaurantpagina verschijnt alleen als de eigenaar of een beheerder iets heeft ingevuld. Dat kan een ja of nee zijn, een garage of een opmerking.
- Zonder ingevulde informatie verdwijnt het blok helemaal. De tekst "onbekend" verdwijnt dan ook.

## Technisch
- Nieuwe hook `useHasFeatured` (React Query, `count` met `head: true`, `.eq('is_active', true)` plus `.or('is_featured.eq.true,is_top_listing.eq.true')`). Wordt gebruikt in `Header.tsx` en, als de link daar ooit komt, in Footer en BottomNav.
- `useCollections.ts`: `google_rating` en `google_reviews_count` mee selecteren. `CollectionPage.tsx`: de ster-weergave van `DatabaseRestaurantCard` volgen, verbergen bij null of 0, en de `featured_reason`-klasse wordt `text-sm text-muted-foreground`.
- `SearchPage.tsx` en alle locale-bestanden: de keys `dishRestaurantsInCountry`, `descDishInCountry` en `descSearchInCountry` noemen Nederland (EN Netherlands, DE Niederlande, FR Pays-Bas, ES Países Bajos).
- `SEOHead` krijgt een optie `nofollow`. NotFound en de foutweergave in `RestaurantPage` gebruiken `noindex` + `nofollow`.
- `ParkingSection` geeft `null` terug als `hasParkingInfo(info)` false is. Er komt een unit-test bij voor `hasParkingInfo` (leeg = false, alleen garage = true).
