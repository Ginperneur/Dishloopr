# Google Places: compliance-inventaris en uitfaseerplan

Status, 15-11-2026: inventaris klaar; fase 1 (instroom stoppen) is in code gebouwd, zie hoofdstuk 10. Er is geen data verwijderd, niets gedeployed en geen query op productie gedraaid. Fase 1 werkt pas na het deployen van de edge functions en de frontend. De beslissingen in hoofdstuk 7 liggen bij de eigenaar van Dishloopr.

## 1. Samenvatting

Dishloopr haalt via zes edge functions gegevens op bij Google (Places API en Geocoding API) en bewaart die blijvend in de database en in Supabase Storage. Bijna alles wat wordt opgeslagen valt buiten wat de Google Maps Platform EEA-voorwaarden toestaan:

| Wat | Waar opgeslagen | Mag het? |
| --- | --- | --- |
| `place_id` | `restaurants.google_place_id`, `discovery_results.place_id` | Ja, onbeperkt |
| lat/lng | `restaurants.geo_lat/geo_lng`, `discovery_results.lat/lng` | Alleen maximaal 30 dagen; er is geen verloopmechanisme |
| Naam, adres | `restaurants.name/address`, `discovery_results.name/address` | Nee |
| Rating, aantal reviews | `restaurants.google_rating`, `google_reviews_count`, `google_review_count`, en deels `restaurants.rating` / `review_count` | Nee |
| Openingstijden | `restaurants.opening_hours` | Nee |
| Telefoon, website | `restaurants.phone`, `restaurants.website_url` | Nee (het is Google Maps Content, ook al is het feitelijk) |
| Prijsniveau, types | `restaurants.price_level`, `discovery_results.types/price_level` | Nee |
| Foto's | Supabase Storage `restaurant-images` + `restaurants.images` | Nee, en publiek getoond zonder Google-attributie |
| Volledige API-respons | `discovery_results.raw_data` (jsonb) | Nee |
| Kopieën van alles hierboven | `restaurants_backup_20260624`, `restaurants_import_stage_20260624` | Nee |

De drie zwaarste punten:

1. **Foto's** worden als bestand gedownload en voor altijd in onze eigen bucket gezet (`fetch-google-photos`). Dat is kopiëren van Google-content in de meest letterlijke vorm, en ze staan publiek op restaurantpagina's.
2. **`discovery_results.raw_data`** bewaart de complete Google-respons per plek, voor elke scan, ook voor afgewezen en dubbele resultaten.
3. **Google-ratings lekken in onze eigen `rating`-kolom.** `BulkRestaurantUpload`, `ClaimPage` en `AddRestaurantPage` schrijven de Google-score naar `restaurants.rating` (en `review_count`). Die kolom bepaalt de rangorde op `/eten`-pagina's (`compareLandingOrder`) en in `restaurant_positions()`. Daardoor is de herkomst van `rating` per rij niet meer te zien.

## 2. Getoetste regels

Bron: de achtergrond die bij deze taak is meegegeven (gecontroleerd op 15-11-2026 in de Google Maps Platform EEA Terms en de EEA Service Specific Terms).

- Google Maps Content niet exporteren of opslaan buiten de Services. Uitdrukkelijk geen "business names, addresses, or user reviews" kopiëren en bewaren.
- Places: alleen `place_id` mag onbeperkt gecachet worden. lat/lng maximaal 30 dagen.

Niet in deze sessie gecontroleerd en dus nog te bevestigen:

- De Service Specific Terms voor de **Geocoding API** (`geocode-restaurants`). Aangenomen is hier dezelfde 30-dagenregel voor lat/lng als bij Places. Klopt dat niet, dan wordt de regel strenger, niet soepeler.
- Of Google-coördinaten op een niet-Google-kaart (onze Leaflet/OpenStreetMap-kaart) getoond mogen worden. Dit wordt vanzelf irrelevant zodra de coördinaten uit PDOK/Overture komen.
- Attributie-eisen bij het tonen van Places-foto's en -ratings.

## 3. Inventaris per bron

### 3.1 `supabase/functions/discover-restaurants/index.ts`

Roept Nearby Search (`grid`) en Text Search (`hotspot`) aan en schrijft per nieuwe plek een rij in `discovery_results` (regels 259 tot 277).

| Veld | Bron in respons | Mag? | Vervanger |
| --- | --- | --- | --- |
| `place_id` | `place_id` | Ja | Behouden als koppelsleutel, of Overture `sources[].record_id` als die naar Google verwijst |
| `name` | `name` | Nee | Overture `names.primary` |
| `address` | `formatted_address` / `vicinity` | Nee | Overture `addresses[]`, gecontroleerd tegen PDOK/BAG |
| `lat`, `lng` | `geometry.location` | Max. 30 dagen | Overture-geometrie, of PDOK Locatieserver op het BAG-adres |
| `rating`, `user_ratings_total` | `rating`, `user_ratings_total` | Nee | Geen. Eigen Dishloopr-reviews |
| `price_level` | `price_level` | Nee | Eigenaar, of afleiden uit menuprijzen (bestaat al via `price_source`) |
| `types` | `types` | Nee | Overture `categories.primary/alternate` |
| `photo_reference` | `photos[0].photo_reference` | Nee (verloopt ook bij Google zelf) | Geen; foto's van de eigenaar of eigen website |
| `raw_data` | de volledige respons | Nee | Weglaten |

Overige punten:

- Dubbele en afgewezen resultaten blijven bewaard (status `duplicate`/`rejected`). Alleen `duplicate` kan handmatig worden opgeruimd via de RPC in `20260520083714_...sql`. Er is geen automatische opschoning.
- De hotspot-zoekterm bevat hard `Amsterdam` (regel 175). Niet relevant voor compliance, wel voor dekking in andere steden.

### 3.2 `supabase/functions/approve-discovery-restaurant/index.ts`

Stap 1 (regels 100 tot 113) kopieert uit `discovery_results` naar `restaurants`: `name`, `address`, `google_place_id`, `geo_lat`, `geo_lng`, `google_rating`, `google_reviews_count`, `price_level`. De slug wordt afgeleid van de Google-naam plus de laatste 6 tekens van de `place_id`.

Stap 2 (regels 143 tot 166) roept Place Details aan en schrijft: `website_url`, `phone`, `opening_hours` (`{weekday_text: [...]}`), `google_rating`, `google_reviews_count`, `price_level`, `geo_lat`, `geo_lng`.

Stap 4b (regels 259 tot 296) roept `fetch-google-photos` aan als het restaurant nog geen foto's heeft.

Stap 5 activeert het restaurant als `address` en `geo_lat` gevuld zijn. Activering hangt dus volledig aan Google-data.

Alleen `google_place_id` mag blijven. Al het andere moet uit een andere bron komen (zie hoofdstuk 5).

Dit is de stroom achter de ~1.391 discovery-restaurants (`added_by_source = 'discovery'`).

### 3.3 `supabase/functions/google-places-search/index.ts` en de vier afnemers

De functie zelf slaat niets op: hij zoekt eerst in de eigen database, dan Text Search plus Place Details voor de top 5, en geeft naam, adres, lat/lng, telefoon, website, rating, aantal reviews, prijsniveau, openingstijden en `photo_references` terug aan de browser. Tonen tijdens het zoeken binnen de sessie is gewoon gebruik van de dienst. Het probleem zit bij de afnemers die het resultaat opslaan:

| Afnemer | Slaat op in `restaurants` | Foto's | Bijzonderheid |
| --- | --- | --- | --- |
| `src/components/admin/BulkRestaurantUpload.tsx` (r. 96 tot 268) | `address`, `geo_lat/lng`, `phone`, `website_url`, `rating` (= Google-score), `price_level`, `opening_hours`; overschrijft ook bestaande restaurants met dezelfde naam (r. 214 tot 228) | via `fetch-google-photos` | Slaat `google_place_id` níet op; het commentaar op r. 134 zegt ten onrechte dat die kolom niet bestaat |
| `src/pages/ClaimPage.tsx` (r. 118, 227 tot 262) | `name`, `address`, `geo_lat/lng`, `phone`, `website_url`, `rating`, `review_count` (= Google), `price_level`, `opening_hours`; direct `is_active: true` | via `fetch-google-photos` | Publiek bereikbaar voor ingelogde gebruikers; slaat ook geen `google_place_id` op |
| `src/pages/AddRestaurantPage.tsx` (r. 107, 256 tot 279, 333) | `name`, `address`, `phone`, `website_url`, `price_level`, `geo_lat/lng`, `opening_hours`, `rating` (= Google) | via `fetch-google-photos` | Formulier wordt voorgevuld; de eigenaar kan aanpassen, maar de standaardwaarden zijn van Google |
| `src/components/admin/PhotosManager.tsx` (r. 106 tot 125) | niets direct | ja, bulk foto's ophalen voor restaurants zonder foto | |
| `src/components/admin/RestaurantAudit.tsx` (r. 342 tot 360) | niets direct | ja, knop "Geen foto's" | |

Opmerking bij ClaimPage en AddRestaurantPage: als een eigenaar zelf zijn naam, adres en openingstijden bevestigt, worden het in feite gegevens van de eigenaar. Dat is een verdedigbare vervanging, maar alleen als de eigenaar de velden zelf invult of actief bevestigt, niet als ze stil worden overgenomen. De `rating` uit Google hoort er in geen geval bij.

### 3.4 `supabase/functions/fetch-google-photos/index.ts`

Haalt maximaal 10 `photo_reference`s op (uit Place Details of uit het verzoek), downloadt elke foto via de Place Photo-endpoint (1920x1080) en uploadt hem naar de publieke bucket `restaurant-images` als `{restaurant_id}/{timestamp}-{i}.jpg` (r. 185). De publieke URL wordt toegevoegd aan `restaurants.images` en `photos_fetched_at` wordt gezet.

- Mag niet: dit is opslaan van Google Maps Content (en mogelijk ook van foto's van derden met eigen auteursrecht, want Places-foto's zijn vaak door gebruikers geüpload).
- Herkenbaarheid: Google-foto's zijn `.jpg` met het patroon `/{13 cijfers}-{1 cijfer}.jpg`. Handmatige uploads (`RestaurantImageUpload.tsx`) en eventfoto's (`OwnerEventsManager.tsx`) zijn `.webp` met een willekeurige suffix. Dat maakt een selectieve opruiming mogelijk, maar controleer vooraf of geen andere bron ook `.jpg` met dit patroon schrijft.
- Vervanger: foto's van de eigenaar (uploaden bestaat al), og:image of foto's van de eigen website van het restaurant met toestemming, of een neutrale placeholder.

### 3.5 `supabase/functions/enrich-restaurants/index.ts`

Text Search op `naam + stad`, dan Place Details. Velden (r. 180 tot 228):

| Veld | Mag? | Vervanger |
| --- | --- | --- |
| `google_rating`, `google_reviews_count` | Nee | Geen; eigen reviews |
| `price_level` | Nee | Eigenaar of menuprijzen |
| `website_url` (alleen als leeg) | Nee | Overture `websites[]`, KvK, of eigenaar |
| `opening_hours` (dag-naam als sleutel, bv. `maandag`) | Nee | Eigenaar (`set_restaurant_opening_hours`), schema.org `openingHours` van de eigen website, Overture heeft geen openingstijden |
| `google_enriched_at` | Ja (eigen metadata) | |

Extra: bij mislukte zoekopdrachten schrijft de functie de sentinel `{_no_hours_from_google: true}` in `opening_hours` en `google_rating = 0`. Dat is geen Google-content, maar wel vervuiling die bij de opruiming mee moet. De `place_id` uit de zoekopdracht wordt hier niet opgeslagen.

Aangeroepen vanuit `GoogleEnrichManager.tsx` en `MissingWebsiteUrls.tsx`.

### 3.6 `supabase/functions/geocode-restaurants/index.ts`

Google Geocoding API op `adres, postcode stad, Netherlands`; schrijft `geo_lat`, `geo_lng` (r. 130 tot 133) zonder vervaldatum. Aangeroepen vanuit `GeocodeManager.tsx` en `RestaurantAudit.tsx`.

- Mag niet langer dan 30 dagen (onder voorbehoud, zie hoofdstuk 2).
- Vervanger: PDOK Locatieserver (gratis, BAG-gebaseerd, open data) op adres plus postcode. Dit is een directe vervanging met dezelfde invoer.

### 3.7 Database: kolommen en tabellen met Google-herkomst

| Tabel / kolom | Gevuld door | Actie |
| --- | --- | --- |
| `restaurants.google_place_id` | approve, (niet door bulk/claim/add) | Behouden |
| `restaurants.google_rating`, `google_reviews_count` (`20260406081840`) | approve, enrich | Leegmaken en kolommen schrappen |
| `restaurants.google_status`, `google_primary_type`, `google_dine_in`, `google_review_count` (`20260624195026`) | CSV-import via `restaurants_import_stage_20260624` | Leegmaken en kolommen schrappen; `google_status` wordt nog getoond in `ManualReviewQueue.tsx` |
| `restaurants.rating`, `review_count` | deels Google (bulk, claim, add), deels eigen | Herkomst bepalen; zie 3.8 |
| `restaurants.name`, `address`, `geo_lat`, `geo_lng`, `phone`, `website_url`, `opening_hours`, `price_level`, `images` | discovery, bulk, claim, add, enrich, geocode, photos | Per rij vervangen uit andere bron; zie hoofdstuk 5 |
| `restaurants.slug` | afgeleid van Google-naam + stuk `place_id` | Een slug is een eigen identifier; aanpassen is niet nodig en zou SEO-URL's breken. Wel noemen als restpunt |
| `discovery_results` (alle inhoudskolommen + `raw_data`) | discover | Inhoud schrappen, alleen `place_id`, status en eigen metadata houden; of de tabel ombouwen naar Overture-kandidaten |
| `restaurants_backup_20260624` (volledige kopie van `restaurants`) | migratie `20260624195026` | Verwijderen (bevat alle bovenstaande Google-velden) |
| `restaurants_import_stage_20260624` | migratie `20260624202621` | Verwijderen |
| `restaurants_backup_fase4` | migratie `20260707204735` (`price_level` en tags) | Waarschijnlijk deels Google `price_level`; verwijderen als hij niet meer nodig is |
| Storage `restaurant-images/{id}/{ts}-{i}.jpg` | fetch-google-photos | Verwijderen en uit `restaurants.images` halen |

`restaurant_positions()` staat niet in de migraties van deze repo (aangemaakt via Lovable), maar volgens `AGENTS.md` sorteert hij op featured, top listing, `rating`, id, net als `compareLandingOrder` in `src/lib/inviteChecklist.ts`.

### 3.8 Publieke weergave

| Plek | Wat | Probleem |
| --- | --- | --- |
| `RatingSummary` via `RestaurantPage.tsx` r. 349, `DatabaseRestaurantCard.tsx` r. 216, `CollectionPage.tsx`, `useCollections.ts`, `seoLandingLoader.ts` r. 174 | `google_rating` + `google_reviews_count` als score (`src/lib/ratingDisplay.ts`, modus `google-only` en `both`) | Toont opgeslagen Google-ratings publiek |
| `compareLandingOrder`, `restaurant_positions()` | rangorde op `rating` | Bevat voor bulk/claim/add-restaurants een Google-score |
| `SEOHead.tsx` JSON-LD | `aggregateRating` | In orde: `RestaurantPage.tsx` r. 221 geeft alleen de eigen score door. Adres, geo en openingstijden in de JSON-LD erven wel de Google-herkomst van de kolommen |
| Restaurantpagina, kaart (`RestaurantMap.tsx`, OSM-tegels) | adres, coördinaten, openingstijden, foto's | Erven de herkomst van de kolommen |
| Links naar `google.com/maps` (RestaurantPage, ReservationWidget, OpeningHoursDisplay, ParkingSection, QuickShareMenu, RestaurantDiscovery) | link met coördinaten of `place_id` | In orde: een link is geen opgeslagen content |

### 3.9 Export

`DataExportManager.tsx` r. 184 tot 194 biedt een export van `discovery_results` aan ("Restaurants gevonden via Google Places discovery scans"). Exporteren is uitdrukkelijk verboden. De query vraagt bovendien kolommen op die niet bestaan (`city`, `google_place_id`, `source`, `created_at`), dus de export werkt vermoedelijk nu al niet.

## 4. Omvang meten (alleen-lezen queries, nog niet gedraaid)

Om de beslissingen te onderbouwen kunnen deze queries in de SQL-editor worden gedraaid. Ze lezen alleen.

```sql
-- Restaurants per bron en met Google-velden
select added_by_source,
       count(*)                                   as totaal,
       count(*) filter (where is_active)          as actief,
       count(google_place_id)                     as met_place_id,
       count(*) filter (where google_rating > 0)  as met_google_rating,
       count(*) filter (where opening_hours ? 'weekday_text'
                           or opening_hours ? 'maandag')  as uren_google_formaat,
       count(*) filter (where opening_hours ? 'mon')      as uren_eigenaar_formaat
from restaurants group by 1 order by 2 desc;

-- Restaurants met Google-foto's in de eigen bucket
select count(*) as restaurants,
       sum((select count(*) from unnest(images) u
            where u ~ '/restaurant-images/[0-9a-f-]+/[0-9]{13}-[0-9]\.jpg$')) as fotos
from restaurants
where exists (select 1 from unnest(images) u
              where u ~ '/restaurant-images/[0-9a-f-]+/[0-9]{13}-[0-9]\.jpg$');

-- Omvang discovery_results
select status, count(*), pg_size_pretty(sum(pg_column_size(raw_data))::bigint) as raw_data
from discovery_results group by 1;

-- Restaurants waarvan rating niet uit eigen reviews kan komen
select count(*) from restaurants r
where r.rating > 0
  and not exists (select 1 from reviews v where v.restaurant_id = r.id);
```

De reviewtabel heet `reviews` (migratie `20260104082600`); controleer of ook verborgen of afgekeurde reviews moeten worden uitgesloten.

## 5. Vervangende bronnen per veld

| Veld | Eerste keuze | Terugval |
| --- | --- | --- |
| Bestaan van een restaurant (discovery) | Overture Maps Places, categorie restaurant/cafe/bakery, bounding box per stad (CDLA Permissive 2.0, naamsvermelding "Overture Maps Foundation") | Aanmelding door eigenaar (`AddRestaurantPage`) |
| Naam | Overture `names.primary` | Eigen website, eigenaar |
| Adres | BAG via PDOK (adres uit Overture, genormaliseerd op postcode + huisnummer) | Overture `addresses[]` |
| lat/lng | PDOK Locatieserver op het BAG-adres | Overture-geometrie |
| Website | Overture `websites[]` | Eigenaar, KvK |
| Telefoon | Overture `phones[]` | Eigen website, eigenaar |
| Openingstijden | Eigenaar (`set_restaurant_opening_hours`) | schema.org `openingHours` op de eigen website (de bestaande scrape-stap kan dat meenemen); anders leeg laten (`hasOpeningHoursData` toont dan "onbekend") |
| Prijsniveau | Afgeleid uit menuprijzen (`price_source`) | Eigenaar |
| Categorie | Overture `categories` + bestaande AI-classificatie | |
| Rating | Alleen eigen Dishloopr-reviews | Geen score tonen |
| Foto's | Eigenaar | Eigen website met toestemming; anders placeholder |
| Dedup-sleutel | `google_place_id` (mag blijven) + Overture `id` (nieuwe kolom) | Naam + BAG-adres |

## 6. Uitfaseerplan

Elke fase kan los worden opgeleverd. Fase 1 en 2 raken geen bestaande data. Fase 4 wel, en wacht op de beslissingen in hoofdstuk 7.

### Fase 1: geen nieuwe Google-content meer opslaan (code, geen data)

Doel: de instroom stoppen. Na deze fase groeit het probleem niet meer.

1. `fetch-google-photos`: functie uitschakelen (meteen 410 teruggeven) en alle aanroepen verwijderen uit `approve-discovery-restaurant` (stap 4b), `BulkRestaurantUpload.tsx`, `ClaimPage.tsx`, `AddRestaurantPage.tsx`, `PhotosManager.tsx`, `RestaurantAudit.tsx`.
2. `enrich-restaurants`: functie uitschakelen; `GoogleEnrichManager.tsx` en de Google-knop in `MissingWebsiteUrls.tsx` uit het admin-menu (`AdminSidebar.tsx`, `AdminPanel.tsx`) halen.
3. `discover-restaurants`: alleen nog `place_id`, `city_id`, grid point, zoekterm, `venue_category` en status opslaan; `name` voorlopig alleen voor de beoordelaar en met een vervaldatum, of de functie meteen uitzetten tot fase 3 klaar is. `raw_data`, `rating`, `user_ratings_total`, `price_level`, `types`, `photo_reference`, `address`, `lat`, `lng` niet meer schrijven.
4. `approve-discovery-restaurant`: stap 2 (Place Details) en stap 4b verwijderen; in stap 1 alleen `google_place_id` meenemen. Naam, adres en coördinaten komen dan uit de nieuwe bron (fase 3). Tot die er is: de functie uitzetten.
5. `google-places-search`: voor de zoekbox in ClaimPage/AddRestaurantPage mag Google tijdens de sessie blijven helpen zoeken, maar de opslag moet anders:
   - `ClaimPage.tsx` en `AddRestaurantPage.tsx`: alleen `google_place_id` opslaan, nooit `rating`/`review_count`; naam, adres, telefoon, website en openingstijden alleen als de eigenaar ze in het formulier zelf bevestigt (velden leeg laten of duidelijk als "controleer" markeren, en `added_by_source = 'owner'`). Coördinaten via PDOK op het bevestigde adres in plaats van Google-geometrie.
   - Eenvoudiger alternatief: de Google-zoekstap in beide pagina's vervangen door zoeken in de eigen database plus Overture-kandidaten.
6. `BulkRestaurantUpload.tsx`: Google-verrijking verwijderen; CSV-import alleen naam + stad, daarna koppelen aan Overture/PDOK. Vooral het overschrijven van bestaande restaurants (r. 214 tot 228) moet weg.
7. `geocode-restaurants`: Google Geocoding vervangen door PDOK Locatieserver (`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=...&fq=type:adres`). Zelfde invoer, zelfde uitvoer, geen sleutel nodig.
8. `DataExportManager.tsx`: de export `discovery_results` verwijderen.
9. Weergave: `RatingSummary` en `getRatingDisplay` de modus `google-only` laten vervallen en in `both` de Google-score weglaten; `google_rating`/`google_reviews_count` uit de selects halen in `RestaurantPage.tsx`, `DatabaseRestaurantCard.tsx`, `CollectionPage.tsx`, `useCollections.ts`, `seoLandingLoader.ts`; `ManualReviewQueue.tsx` geen `google_status`/`google_rating` meer tonen. Let op: restaurants zonder eigen reviews tonen daarna geen score; de i18n-teksten voor "Google" in `src/i18n/locales/*.json` nalopen.
10. `GOOGLE_PLACES_API_KEY` blijft voorlopig bestaan voor de zoekbox (punt 5); als die ook vervangen wordt, de secret intrekken in Google Cloud en Supabase.

### Fase 2: herkomst vastleggen (migratie, additief)

Zonder herkomst per veld is niet te bewijzen welke data van Google komt, en is een gerichte opruiming niet mogelijk.

1. Nieuwe kolommen op `restaurants`: `name_source`, `address_source`, `geo_source`, `hours_source`, `contact_source` (waarden bv. `google`, `overture`, `pdok`, `owner`, `website`, `admin`), plus `overture_id text` met een unieke index. Idempotent schrijven (`ADD COLUMN IF NOT EXISTS`), zie de Lovable-werkwijze.
2. Eenmalige backfill op basis van heuristiek (alleen markeren, niets wijzigen):
   - `added_by_source = 'discovery'` → alle velden `google`, tenzij later door eigenaar gewijzigd.
   - `opening_hours` met sleutel `weekday_text` of Nederlandse dagnamen → `google`; met `mon..sun` → `owner`.
   - foto-URL's met het `.jpg`-patroon uit 3.4 → `google`.
   - `geo_*` gevuld via `geocode-restaurants` is niet te onderscheiden; behandelen als `google` tot overschreven door PDOK.
3. Alle schrijvende code (eigenaar-RPC's, admin-editors, de nieuwe Overture/PDOK-import) zet de `*_source`-kolom mee.
4. `restaurants.rating`: voortaan alleen door eigen reviews laten schrijven (trigger of RPC). De kolom niet meer vanuit de browser laten zetten.

### Fase 3: vervangende bronnen bouwen

1. **Overture-import** (nieuwe edge function of script, bv. `import-overture-places`): per stad een bounding box uit de maandelijkse Overture Places-release (GeoParquet op S3/Azure, te filteren met DuckDB), filter op categorieën restaurant/cafe/bakery en `confidence`, schrijf kandidaten naar `discovery_results` (omgebouwd: `source = 'overture'`, `overture_id`, naam, adres, geometrie, website, telefoon, categorie; dat mag, want CDLA Permissive 2.0). Naamsvermelding "© Overture Maps Foundation" op de site (footer of over-pagina) toevoegen; controleer daarbij de licenties van de onderliggende bronnen in de release.
2. **Matching op bestaande restaurants:** Overture `sources[]` bevat soms een verwijzing naar de oorspronkelijke bron; anders matchen op genormaliseerde naam + BAG-adres + afstand (de bestaande fuzzy-match RPC in `20260520083714_...sql` kan hergebruikt worden). Bij een match: `overture_id` zetten en de `google`-velden overschrijven met Overture/PDOK-waarden.
3. **PDOK-geocoding** voor alle restaurants met een adres: `geo_lat/geo_lng` overschrijven, `geo_source = 'pdok'`.
4. **Openingstijden:** `scrape-menu` (of een aparte stap) laten zoeken naar schema.org `openingHoursSpecification` op de eigen website; outreach-mail aan eigenaren om hun openingstijden te bevestigen via het dashboard (de RPC bestaat al).
5. **Approve-flow** opnieuw opbouwen op Overture-kandidaten: dezelfde stappen (classificeren, menu scrapen, reserveringslink zoeken), activeren op basis van PDOK-adres en -coördinaten in plaats van Google.

### Fase 4: bestaande Google-data opruimen (data, wacht op beslissing)

Volgorde zo dat de site zo min mogelijk gaten krijgt: eerst vervangen (fase 3), dan wat overblijft verwijderen.

1. `discovery_results`: `raw_data`, `rating`, `user_ratings_total`, `price_level`, `types`, `photo_reference`, `address`, `lat`, `lng` leegmaken voor alle rijen; afgewezen en dubbele rijen helemaal verwijderen. Later de kolommen schrappen.
2. `restaurants_backup_20260624`, `restaurants_import_stage_20260624` en, als niet meer nodig, `restaurants_backup_fase4` verwijderen (`DROP TABLE`).
3. `google_rating`, `google_reviews_count`, `google_review_count`, `google_status`, `google_primary_type`, `google_dine_in` leegmaken, daarna kolommen schrappen en `types.ts` opnieuw genereren.
4. `restaurants.rating` en `review_count` herberekenen uit eigen reviews (0 als er geen zijn). Dit verandert de rangorde op `/eten`-pagina's en in `restaurant_positions()`; eigenaren zien hun positie verschuiven.
5. Google-foto's: bestanden met het `.jpg`-patroon uit de bucket verwijderen en de URL's uit `restaurants.images` halen. Restaurants die daarna geen foto meer hebben krijgen een placeholder en komen op de outreach-lijst voor foto's.
6. `geo_lat/geo_lng` met `geo_source = 'google'` die na fase 3 niet zijn overschreven: leegmaken. Zonder coördinaten verdwijnt een restaurant van de kaart en uit afstandsfilters.
7. Naam, adres, telefoon, website, openingstijden met bron `google` die na fase 3 niet zijn vervangen: zie beslissing B in hoofdstuk 7.
8. Daarna: `GOOGLE_PLACES_API_KEY` intrekken als ook de zoekbox is vervangen, en de functies `discover-restaurants`, `enrich-restaurants`, `fetch-google-photos`, `geocode-restaurants`, `google-places-search` verwijderen uit de repo, `config.toml` en het Supabase-project.

## 7. Beslissingen voor de eigenaar

A. **Instroom stoppen nu of na de vervanger?** Fase 1 meteen doen betekent dat discovery en de admin-verrijking tijdelijk stilliggen tot de Overture-import (fase 3) werkt. Advies: wel meteen, het probleem groeit anders elke scan.

B. **Wat te doen met Google-velden die niet vervangbaar blijken?** Opties: (1) leegmaken en het restaurant inactief zetten tot de eigenaar of een andere bron de gegevens aanlevert, (2) inactief zetten zonder leeg te maken (dan blijft de opslag bestaan, dus dit lost de schending niet op), (3) het restaurant verwijderen. Advies: optie 1, met een outreach-golf naar die restaurants.

C. **Google-foto's:** in één keer verwijderen (snel compliant, veel restaurants tijdelijk zonder foto) of per restaurant pas als er een vervanging is. Omdat het de duidelijkste schending is en de foto's ook auteursrecht van derden kunnen raken: advies in één keer, met placeholder.

D. **Google-rating op de site:** de Google-score verdwijnt bij restaurants zonder ≥ 10 eigen reviews. Akkoord dat die restaurants dan geen score tonen?

E. **Rangorde:** het herberekenen van `rating` verschuift posities op `/eten`-pagina's, op invite-pagina's en in de Owner Pro-analytics (`snapshot_restaurant_positions`). Moeten eigenaren (vooral Uitgelicht/Founding Partners) vooraf worden ingelicht?

F. **Zoekbox in ClaimPage en AddRestaurantPage:** Google houden als zoekhulp zonder opslag (alleen `place_id`), of vervangen door eigen database plus Overture? Het eerste vraagt minder werk, het tweede maakt Google helemaal overbodig.

G. **Backuptabellen** `restaurants_backup_20260624`, `restaurants_import_stage_20260624`, `restaurants_backup_fase4`: mogen ze weg?

H. **Slugs** die een stuk van de `place_id` bevatten laten staan? Advies: ja, het is een eigen identifier en wijzigen breekt URL's.

## 8. Concrete codewijzigingen (checklist)

Fase 1, instroom stoppen (gebouwd, zie hoofdstuk 10):

- [x] `fetch-google-photos`, `enrich-restaurants`, `discover-restaurants`: geven 410 (`_shared/googleDisabled.ts`).
- [x] `approve-discovery-restaurant`: goedkeuren vanuit `discovery_results` geeft 410; de pipeline voor bestaande restaurants draait zonder Google (geen Place Details, geen foto's).
- [x] `geocode-restaurants`: PDOK Locatieserver (`_shared/pdokGeocode.ts`), met controle op postcode/plaats en huisnummer.
- [x] `google-places-search`: vraagt alleen nog naam, adres, telefoon, website op; nieuwe optie `includeGoogle: false`.
- [x] `BulkRestaurantUpload.tsx` en `GoogleEnrichManager.tsx`: verwijderd, ook uit het adminmenu.
- [x] `ClaimPage.tsx`: zoekt alleen in de eigen database en maakt geen restaurants meer aan; niet gevonden gaat naar `/add-restaurant`.
- [x] `AddRestaurantPage.tsx`: slaat alleen door de eigenaar bevestigde velden en `google_place_id` op; geen rating, openingstijden, coördinaten of foto's.
- [x] `PhotosManager.tsx`, `MissingWebsiteUrls.tsx`: alleen nog lijst (en CSV-export van restaurants zonder foto).
- [x] `RestaurantAudit.tsx`: fix "Geen foto's" weg; "Geen coördinaten" via PDOK met de juiste parameter.
- [x] `DataExportManager.tsx`: export `discovery_results` weg.
- [x] Weergave: alleen nog de eigen Dishloopr-score (`ratingDisplay.ts`, `RatingSummary.tsx`, selects, `ManualReviewQueue.tsx`, i18n).
- [x] Tests: `supabase/tests/pdok-geocode.ts`, `supabase/tests/rating-display.ts`.

Fase 2, herkomst:

- [ ] Migratie: `*_source`-kolommen en `overture_id` op `restaurants` (idempotent).
- [ ] Migratie: backfill-markering op basis van de heuristiek in 6.2 (alleen markeren).
- [ ] `restaurants.rating`/`review_count` alleen nog via eigen reviews schrijven.

Fase 3, vervangers:

- [ ] Nieuwe import `import-overture-places` (per stad, DuckDB op GeoParquet, of vooraf verwerkt bestand in Storage).
- [ ] `discovery_results` ombouwen naar bron-onafhankelijke kandidaten (`source`, `overture_id`).
- [ ] `RestaurantDiscovery.tsx`: Google Maps-link per kandidaat mag blijven; tonen van Overture-velden.
- [ ] PDOK-geocoding voor alle restaurants (batch).
- [ ] Openingstijden uit schema.org op eigen website; outreach-golf "bevestig je gegevens".
- [ ] Naamsvermelding Overture op de site.

Fase 4, opruimen (na beslissing):

- [ ] Data-migraties volgens 6.4, elk als losse, omkeerbare stap met eerst een telling.
- [ ] Google-functies, `config.toml`-blokken en de API-sleutel verwijderen.
- [ ] `src/integrations/supabase/types.ts` opnieuw genereren.

## 9. Bijvangst (geen compliance, wel kapot)

- `RestaurantAudit.tsx` r. 404 roept `geocode-restaurants` aan met `restaurant_ids: [...]`, maar de functie verwacht `restaurantId` of `all`. De fix "Geen coördinaten" geeft daardoor altijd een 400.
- `DataExportManager.tsx` r. 192 vraagt kolommen op die niet in `discovery_results` bestaan.
- `BulkRestaurantUpload.tsx` r. 134: het commentaar zegt dat `google_place_id` niet bestaat; de kolom bestaat sinds `20260417070025`.
- `discover-restaurants` r. 175 zet `Amsterdam` vast in de hotspot-zoekopdracht, ook voor andere steden.

## 10. Fase 1: wat er gebouwd is

Gebouwd op 15-11-2026, nog niet gedeployed. Tot de deploy draaien de oude edge functions in Supabase en slaan ze nog steeds Google-content op.

| Onderdeel | Wat er nu gebeurt |
| --- | --- |
| `fetch-google-photos`, `enrich-restaurants`, `discover-restaurants` | Antwoorden 410 met een Nederlandse foutmelding. De oude code staat in de git-geschiedenis |
| `approve-discovery-restaurant` | `discoveryResultId` geeft 410. Met `restaurantId` (knop "bestaande verrijken" in Discovery) lopen classificatie, menu scrapen, reserveringslink en activering nog, zonder Google |
| `geocode-restaurants` | PDOK Locatieserver. Een PDOK-resultaat wordt alleen geaccepteerd als postcode (of anders plaats of gemeente) en huisnummer overeenkomen; anders blijven de coördinaten leeg in plaats van fout. Accepteert nu ook `restaurant_ids`, zodat de fix in RestaurantAudit werkt |
| `google-places-search` | Google-resultaten bevatten alleen `place_id`, naam, adres, telefoon en website. Geen rating, openingstijden, foto's of coördinaten meer, wat ook API-kosten scheelt |
| ClaimPage | Claimen kan alleen nog voor restaurants die al op Dishloopr staan. Staat het er niet, dan gaat de eigenaar naar `/add-restaurant` |
| AddRestaurantPage | Google vult het formulier voor; de eigenaar controleert en verstuurt. Opgeslagen: naam, adres, telefoon, website zoals de eigenaar ze indient, plus `google_place_id`. Coördinaten komen later via PDOK (Geocode in het adminpaneel) |
| Admin | Import (CSV via Google) en Google Verrijking zijn weg. Foto's en Zonder website tonen alleen nog lijsten. Discovery toont een melding dat scannen en goedkeuren stilstaan |
| Publieke site | Alleen de eigen Dishloopr-score, vanaf 10 eigen reviews. Restaurants zonder genoeg eigen reviews tonen geen score meer |

Gevolgen om te weten:

- De skill `dishloopr-restaurant-approval` (Discovery-wachtrij goedkeuren) werkt niet meer tot fase 3.
- Nieuwe restaurants via AddRestaurantPage hebben geen coördinaten tot een admin Geocode draait. Geocode "alles" pakt alleen actieve restaurants; nieuw ingediende restaurants zijn inactief tot goedkeuring.
- Een AddRestaurantPage-indiening is nog steeds door Google voorgevuld. Dat is verdedigbaar omdat de eigenaar de velden controleert en indient, maar het is beslissing F in hoofdstuk 7: wie het strikter wil, vervangt de Google-zoekstap door zoeken in de eigen database plus Overture.
- `GOOGLE_PLACES_API_KEY` is nog nodig voor die zoekstap. `geocode-restaurants` gebruikt hem niet meer.
- De privacypagina (`src/pages/PrivacyPage.tsx`) noemt Google Places nog als bron. Dat klopt zolang de oude data er staat; bijwerken na fase 4.
- Bestaande Google-data (kolommen, foto's, `discovery_results`, backuptabellen) is niet aangeraakt; dat is fase 4.

Gecontroleerd: TypeScript (`tsc -p tsconfig.app.json`), `vite build`, `deno check` op de zes functies, en de Deno-tests in `supabase/tests` (`pdok-geocode.ts`, `rating-display.ts`, plus bestaande). ESLint geeft op de gewijzigde bestanden geen nieuwe meldingen ten opzichte van de vorige versie. Niet gecontroleerd: de schermen in de browser en de functies na deploy.

