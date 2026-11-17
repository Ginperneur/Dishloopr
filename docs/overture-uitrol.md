# Uitrol: restaurants uit Overture Maps naar Dishloopr

Stand 17-11-2026. Landelijk klaar: 5.937 "zeker goed", 1.856 "sterk, extra controle",
13.377 "twijfel", in 12 provinciebestanden (`scripts/overture-discovery/output/nl/*.csv`).

## 1. Code naar main (gedaan 17-11-2026)

Eén PR voor `feat/overture-discovery-import` naar `main`. Die bevat ook de Google-compliance
van PR #34, bijgewerkt op de nieuwe beheerindeling (#44); GitHub markeert #34 daardoor als
gemerged. Migratie heet nu `0055_overture_discovery` (0052 tot 0054 waren al bezet op main).

## 2. Gemini-sleutel van Google zelf (in plaats van de Lovable AI-gateway)

1. Ga naar Google AI Studio (aistudio.google.com) en klik op "Get API key".
2. Maak de sleutel aan in een Google Cloud-project en zet **billing** aan op dat project.
   Verplicht in de EER (alleen de betaalde variant mag) en op de betaalde variant gebruikt
   Google je aanvragen niet om modellen te verbeteren.
3. Zet in Google Cloud Billing een budget met e-mailalert, bijvoorbeeld €100.
4. Kopieer de sleutel nog niet naar een chat; die gaat in stap 3 via het geheimenformulier.

Mag dit? Ja (gecontroleerd in de Gemini API Additional Terms, 17-11-2026): de beperkingen gaan
over Grounding with Google Search/Maps (resultaten niet opslaan of indexeren) en over het
bouwen van concurrerende AI-modellen. Wij sturen alleen tekst van de eigen website van het
restaurant en zetten geen Google-grounding aan. Dat is iets anders dan de Google Maps
Platform-regels die het opslaan van Places-data verbieden.

## 3. Lovable: geheim, migratie, functies

Prompt 1 (geheim):

> Voeg een Supabase-secret toe met de naam `GEMINI_API_KEY`. Vraag mij om de waarde via het
> beveiligde secret-formulier; ik plak hem niet in de chat. Wijzig verder geen code.

Prompt 2 (migratie):

> Voer de migratie `drizzle/migrations/0055_overture_discovery.sql` uit op de database. Hij is
> idempotent geschreven, dus een nieuw nummer of dubbele run is geen probleem. Wijzig de SQL niet.
> Bevestig daarna dat `discovery_results` de kolommen `source`, `external_id`, `triage` en
> `triage_reason` heeft, dat `place_id` nullable is, en dat `restaurants.overture_id` bestaat.

Prompt 3 (functies):

> Deploy deze edge functions opnieuw zonder de code te wijzigen: `approve-discovery-restaurant`,
> `scrape-menu`, `classify-restaurants`, `classify-dishes`, `discover-restaurants`,
> `enrich-restaurants`, `fetch-google-photos`, `geocode-restaurants`, `google-places-search`.
> Publiceer daarna de frontend.

## 4. Controleren

1. Admin, Discovery: bovenaan staat "Stad importeren uit Overture Maps", de oranje melding
   noemt Overture.
2. Over-pagina (`/about`): de regel "Databronnen" staat onderaan.
3. Firecrawl: genoeg credits (Standard-abonnement, 100.000 per maand).

## 5. Uploaden en goedkeuren

1. Begin klein: upload `flevoland.csv` (98 zeker goed). De import kiest zelf
   "Stad per rij uit het bestand"; nieuwe steden worden inactief aangemaakt.
2. Filter de wachtrij op "Overture: zeker goed", kies een stad en keur 10 restaurants goed.
3. Controleer: restaurant aangemaakt met adres en kaartpunt, gerechten toegevoegd, en in
   Google AI Studio (Usage) zie je de aanroepen binnenkomen (dan loopt het via Google, niet Lovable).
4. Daarna de andere provincies uploaden en "zeker goed" per stad goedkeuren. Goedkeuren draait
   in de browser (10 tot 20 seconden per restaurant, tab openhouden).
5. "Sterk, extra controle" (1.856) kort nalopen; "twijfel" alleen als er tijd is.

## 6. Bulkroute voor alle "zeker goed" (vanaf 17-11-2026)

Eén voor één goedkeuren kost 10 tot 20 seconden per restaurant en zet gerechten op "suggested".
Voor de 5.937 "zeker goed" is er een bulkroute in Admin, Wachtrijen, Discovery, kaart
"Overture in bulk: zeker goed" (edge function `overture-bulk`):

1. Upload eerst alle provinciebestanden met de importkaart (stap 5.1).
2. **Alle zeker goed aanmaken.** Maakt de restaurants aan met PDOK-adres, verborgen
   (`restaurants_verborgen`, reden "menu: ..."). Ze gaan vanzelf live zodra ze 5 goedgekeurde
   gerechten hebben (drank telt niet): de trigger op `restaurant_dishes` regelt dat.
3. **Python-gerechten (CSV).** Op de Mac: `menu_scraper_v5.py` met het Overture-id als
   restaurant-id, daarna `dish_screen_local_v5.py` en
   `scripts/overture-discovery/build_dish_import.py`. Upload de CSV; de gerechten komen meteen
   goedgekeurd binnen (alleen screening "approve", menu-only alleen met prijs of sectie).
4. **Websiteroute voor de rest.** Restaurants die daarna nog verborgen zijn en nooit gescand,
   gaan door `scrape-menu` (Firecrawl + Gemini) en meteen door `dish-screening`.

5. **Server-pijplijn (aanbevolen voor stap 1 en 3).** Knop "Server-pijplijn aanzetten" in dezelfde
   kaart (tabel `overture_pipeline`, migratie `0056_overture_pipeline`). pg_cron roept elke minuut
   `overture-bulk` met actie `tick` aan: eerst resterende "zeker goed" aanmaken, daarna per stap 6
   verborgen restaurants door de websiteroute, en sinds 17-11-2026 per stap ook 10 "sterk, extra
   controle" erbij (zelfde route als zeker goed). Geen open tabblad nodig; uitzetten stopt de kosten.
   Zet hem pas aan na stap 3 (Python-import), anders betaal je voor restaurants die Python al dekt.

Gemeten op 10 restaurants in Almere: Python alleen 4 van 10 met 5+ gerechten, website alleen 6,
samen 8.

## Kosten (schatting)

| Onderdeel | Kosten |
|---|---|
| Overture, PDOK, websitecheck | $0 |
| Haiku-check | $2,27 (betaald) |
| Firecrawl, ~13.000 credits voor 5.937 restaurants | binnen één maand Standard ($83 tot $99) |
| Gemini via Google (gerechten met gemini-3.8-flash + classificatie), ~$0,015 per restaurant tot 31-12-2026, daarna het dubbele | ~$90 |
| Optioneel: gerechten classificeren | ~$15 tot $25 |
