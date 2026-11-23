# Collecties-blok op de homepage

Het blok "Getest door Dishloopr" onderaan de stadsdelen op de homepage wordt een collectie-rij met foto's.

## Wat je ziet
- Kop "Collecties".
- Eerste kaart: **Getest door Dishloopr**, met foto en korte uitleg ("De favoriete restaurants van onze redactie"). Klikken opent de collectiepagina.
- Daarna de andere actieve collecties (Beste Ramen in Amsterdam, Date Night Restaurants, Hidden Gems, enz.), in hun huidige volgorde, elk met omslagfoto en titel.
- Mobiel: horizontaal swipebare rij; desktop: raster van 3-4 kolommen.
- Collecties zonder foto (zoals "Perfect voor de kleintjes") krijgen een nette oranje vlakvulling met titel in plaats van een lege plek.

## Getest door Dishloopr als collectie
- Nieuwe collectie "Getest door Dishloopr" (`getest-door-dishloopr`) aanmaken, actief, bovenaan gesorteerd, met een passende omslagfoto (gegenereerd en opgeslagen in de opslag).
- De redactie vult de restaurants via het bestaande Collecties-beheer in admin. Zolang hij leeg is, toont de collectiepagina de bestaande lege melding.

## Technisch
- `EditorsPicks` in `src/components/home/HomeCityBlocks.tsx` vervangen door `HomeCollections` die `useCollections` hergebruikt; Dishloopr-slug vooraan, overige op `sort_order`.
- Foto's via `optimizedImage` met vaste breedte/hoogte (aspect 4:3), eerste lazy.
- Data: één insert in `collections` + upload omslagfoto; geen schemawijziging.
