## Plan: 7 nieuwe features

### 1. Eigenaar uploadt menu (PDF of CSV)
Nieuwe component `src/components/owner/OwnerMenuUpload.tsx` toegevoegd aan de Menu-tab van `OwnerDashboard`.
- **PDF**: uploadt naar `menus` storage bucket en roept bestaande edge function `parse-menu-pdf` aan (al gebouwd voor admin) — claim-vereist via `restaurant_claims`.
- **CSV**: client-side parser (kolommen `name`, `price`, `description`, `category`, `is_signature`). Per rij `dishes` (upsert via slug) + `restaurant_dishes` (status `approved`, source `owner_csv`).
- Template-knop "Download voorbeeld CSV".
- Edge function `parse-menu-pdf` lichtjes uitgebreid: ook eigenaars (geclaimd restaurant) toestaan i.p.v. enkel admin.

### 2. Admin foto's: filter "nog nooit opgehaald"
Migratie: kolom `photos_fetched_at TIMESTAMPTZ NULL` op `restaurants`. `fetch-google-photos` zet die bij elke poging (success of no_photos).
In `PhotosManager.tsx`: extra filter-toggle "Alleen nog nooit opgehaald" → query met `photos_fetched_at IS NULL`. Bestaande lijst blijft "geen foto's".

### 3. Restaurants zonder foto's verbergen op de site
Filter aan publieke queries:
- `useSearch.ts`, `useRestaurant.ts` (alleen waar lijst-weergave), `Index.tsx` trending, `CityDetailPage`, `FeaturedRestaurantsSection`.
- Conditie: `images is not null AND array_length(images,1) > 0`.
- Restaurant met geen foto's geeft 404 op detailpagina (om dood-content te vermijden) — optioneel, kunnen we ook gewoon placeholder tonen. **Vraag aan jou:** detailpagina ook verbergen of alleen uit lijsten? Default: alleen uit lijsten en search.

### 4. CSV-download: restaurants zonder foto's
Knop in `PhotosManager.tsx` "Exporteer naar CSV" → `name, address, city, phone, website, place_id` van de huidige lijst.

### 5. Volledige admin-data CSV export (incl. discovery)
`DataExportManager.tsx` uitbreiden met extra exports:
- `restaurant_discoveries` (discovery queue)
- `restaurant_claims`, `restaurant_suggestions` (nieuw, zie #7)
- `reviews`, `users` (profielen), `user_roles`, `featured_subscriptions`, `sponsored_products`, `newsletter_subscribers`, `click_events`, `view_events`.
Per export: keuze CSV/JSON, batch via bestaande `fetchAllRows`.

### 6. Afstandsfilter "max X min vanaf stad"
In `FilterPopover` nieuw veld "Max afstand vanaf stad" (slider 0–60 km, of "Alleen in stad"). Default 0 = alleen in stad.
- Logic in `useSearch.ts`: als radius > 0 en `cityId` gekozen → haal stad-coords (`cities.lat/lng`), filter restaurants binnen radius via `calculateDistance` (al beschikbaar in `useGeolocation.ts`).
- Conversie: 15 min auto ≈ 15 km (configureerbare constante). UI toont km, label "± 15 km (≈ 15 min)".
- URL-param `radius=15` toegevoegd voor deelbare links.

### 7. Publieke restaurant-suggestie
- Nieuwe tabel `restaurant_suggestions` (name, address, city, website, notes, suggested_by uuid nullable, status pending/approved/rejected, created_at).
- RLS: iedereen INSERT (rate-limit via simpele app-laag op IP via header), alleen admin SELECT/UPDATE.
- Publieke pagina/route `/suggest-restaurant` (of dialog vanaf `AddRestaurantPage` voor niet-eigenaars): formulier met zod-validatie, captcha optioneel later.
- Admin-panel: nieuwe sectie `RestaurantSuggestionsQueue.tsx` met goedkeuren (→ pre-fill in `RestaurantDiscovery` / `AddRestaurantModal`) of afwijzen.
- BottomNav/Footer-link "Suggereer restaurant".

### Migraties
1. `restaurants.photos_fetched_at` (#2)
2. `restaurant_suggestions` tabel + GRANT + RLS (#7)

### Volgorde van bouwen
1. Migraties (#2, #7)
2. Backend uitbreidingen (`parse-menu-pdf` owner-toegang, `fetch-google-photos` timestamp)
3. Admin: PhotosManager filter + CSV + DataExportManager uitbreiding + SuggestionsQueue
4. Site-filtering (#3)
5. Owner menu-upload component
6. Distance-filter in search
7. Publieke suggestion-flow

Wil je dat detailpagina van een restaurant zonder foto's óók verborgen wordt (#3), of alleen uit lijsten/search?
