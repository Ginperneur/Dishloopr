# Zenchef-integratie

## Overzicht

Dishloopr koppelt restaurants aan Zenchef op twee manieren:

- **Methode A: officiële Zenchef-widget (live).** Gasten reserveren via de widget van Zenchef, die vanaf de restaurantpagina opent. Dit werkt nu.
- **Methode B: Zenchef API (gebouwd, geblokkeerd).** Gasten reserveren binnen Dishloopr via de API van Zenchef. De code is gebouwd en getest met mocks, maar er is nog geen API-toegang. Methode B blijft uit tot Zenchef toegang geeft en de technische documentatie beschikbaar stelt.

Zenchef blijft de bron van waarheid voor beschikbaarheid, reserveringsstatus en tafels. Dishloopr bewaart alleen wat nodig is om gasten door te sturen en om aan te tonen welke boekingen via Dishloopr zijn ontstaan.

## Architectuur

- **Frontend.** `src/components/restaurant/ReserveButton.tsx` kiest per restaurant de route: native, widget of link. `NativeReservationFlow.tsx` is de boekingsstroom van methode B. Het laden van het SDK zit in `src/hooks/useZenchefSdk.ts`, de helpers in `src/lib/zenchef.ts`.
- **Edge functions.** `reservations` (acties `availability`, `create`, `status`, `cancel`, `modify` en `test`) en `reservation-webhook` (inkomende webhooks, `?provider=zenchef`). Beide draaien server-side met de service role. De browser ziet nooit providercredentials.
- **Gedeelde logica** in `supabase/functions/_shared/reservations/`:
  - `types.ts`: de interface `ReservationProvider`, de contracten, `ReservationError` en de interface `ReservationStore`. Pure TypeScript zonder Deno- of npm-imports, zodat dezelfde code in de bun-tests draait.
  - `service.ts`: boekingslogica (beschikbaarheid, boeken, status, annuleren, wijzigen, testverbinding).
  - `sync.ts`: verwerking van webhooks en reconciliatie.
  - `validation.ts`: invoercontrole en tijdzones.
  - `zenchef.ts`: `ZenchefProvider`, de adapter. Zolang er geen API-toegang is, geeft elke API-methode `provider_not_configured`.
  - `mock.ts`: `MockProvider` en `MemoryStore`, alleen voor tests en lokale ontwikkeling.
  - `supabaseStore.ts`: `ReservationStore` op Supabase, en `providerFor()`, die de provider op naam kiest.
- **Database.** Zie hoofdstuk Database.
- **Analytics.** `src/lib/reservationFunnel.ts` stuurt de anonieme tellers naar de RPC `track_reservation_funnel`.

### Een nieuwe provider toevoegen (bijvoorbeeld Formitable of TheFork)

1. Maak `_shared/reservations/<naam>.ts` met een adapter die `ReservationProvider` implementeert. Een widget-only koppeling vraagt een `capabilities()` die alleen `widget: true` teruggeeft, maar alle methoden moeten wel bestaan.
2. Breid `ProviderName` in `types.ts` uit en voeg de naam toe aan de CHECK-constraints op `restaurant_integrations.provider` en `reservations.provider` in een nieuwe migratie.
3. Het veld `external_restaurant_id` accepteert nu alleen cijfers (maximaal 10). Heeft de nieuwe provider een ander ID-formaat, dan past de migratie ook die CHECK aan.
4. Voeg de naam toe aan `providerFor()` in `supabaseStore.ts`.
5. Laat de RPC's die nu alleen `'zenchef'` accepteren (`save_reservation_integration`, `confirm_reservation_integration`, `set_reservation_integration_enabled`, `disconnect_reservation_integration`) de nieuwe naam ook toestaan.
6. De trigger `sync_restaurant_zenchef_id` werkt alleen voor Zenchef. Een andere provider vraagt om een eigen regel of een eigen kolom.
7. Schrijf tests tegen `MockProvider` en `MemoryStore`, net als voor Zenchef.

## Database

Migratie: `supabase/migrations/20261111120000_reservation_integrations.sql`.

**Tabellen**

- `restaurant_integrations`: een rij per restaurant per provider. Bevat het externe ID, de koppelmethode (`widget` of `api`), de status (`config_required`, `testing`, `connected`, `limited`, `error`), `enabled`, niet-geheime configuratie (taal, tijdzone), het moment van verificatie en de laatste fout. Er staan geen credentials in. Uniek per restaurant en provider, en per provider en extern ID.
- `reservations`: boekingen die via de native flow zijn gemaakt. Er staan geen gastgegevens in: geen naam, e-mail, telefoonnummer of opmerking. Wel starttijd, aantal personen, status, `evidence` (alleen `provider_confirmed`), gerechtcontext, campagne-ID, een idempotency key en een hash van het beheertoken.
- `integration_events`: webhook- en synchronisatie-events, uniek per provider event-id. Bewaartermijn 90 dagen via `purge_old_integration_events()`. Deze functie is nog niet ingepland; de migratie bevat geen cron-job.
- `reservation_funnel_daily`: anonieme dagtellers per restaurant, stage en context. Geen browser-identifiers.

RLS: owners en admins mogen lezen. Schrijven gaat alleen via SECURITY DEFINER-functies of de service role. Clients hebben geen schrijfrechten op de tabellen.

**RPC's**

- `save_reservation_integration`: slaat het ID op. Een nieuw of gewijzigd ID zet de status op `testing` en `enabled` op false. Een wijziging die alleen de configuratie betreft, behoudt de verificatie. Het ID mag niet al aan een ander restaurant hangen.
- `confirm_reservation_integration`: de eigenaar bevestigt dat de widget het eigen restaurant toont. Zet de status op `connected`, `enabled` op true, en vult `verified_at` en `verified_by`.
- `set_reservation_integration_enabled`: schakelt in of uit. Inschakelen kan alleen na bevestiging.
- `disconnect_reservation_integration`: verwijdert de koppeling en de events. Reserveringen blijven bestaan, met een leeg `manage_token_hash`.
- `public_reservation_options`: publieke, niet-gevoelige gegevens (provider, methode, extern ID, taal, tijdzone), alleen voor actieve koppelingen op actieve restaurants.
- `track_reservation_funnel`: verhoogt de anonieme tellers. Maximaal 20 items per aanroep.
- `reservation_stats_summary`: statistieken van de afgelopen 30 dagen (standaard), alleen voor wie `owner_analytics_allowed` doorstaat.
- Hulpfuncties: `can_manage_reservation_integration` (admin of geverifieerde eigenaar) en `clean_reservation_config` (accepteert alleen `lang`, met waarden nl, en, de, fr, es, it of pt, en `timezone`).

**Trigger en backfill**

- De trigger `restaurant_integrations_sync_zenchef` houdt `restaurants.zenchef_id` synchroon. Het veld wordt gevuld zolang de koppeling `enabled` is en de status `connected` of `limited` heeft. Anders, en bij verwijderen, wordt het leeggemaakt. De restaurantpagina leest dit veld.
- Bestaande restaurants met een numeriek `zenchef_id` krijgen bij de migratie een widgetkoppeling met status `connected`, ingeschakeld, en `verified_at` op het moment van de migratie. Die bevestiging is dus niet door de eigenaar zelf gedaan.

## Widget (methode A)

Geverifieerde feiten, bronnen: help.zenchef.com artikel 16059778163869 en sdk.zenchef.com/configure.html.

- SDK: `https://sdk.zenchef.com/v1/sdk.min.js`, geladen als script met id `zenchef-sdk`.
- Configuratie: één element `<div class="zc-widget-config" data-restaurant="ID">`. De SDK leest dit element bij het laden.
- Attributen die Dishloopr zet: `data-hide-default-button` (true), `data-lang`, `data-partner-id` (de SDK geeft dit door als `pid`), `data-disable-gtm` en `data-disable-ga4` (beide true), `data-send-page-views` (false).
- Eigen knop: een element met `data-zc-action="open"`. De SDK reageert alleen als het aangeklikte element zelf dat attribuut heeft. Daarom krijgt de inhoud van de knop `pointer-events-none`.
- Directe link: `https://bookings.zenchef.com/results?rid=ID`, optioneel met `pax`, `day`, `lang` en `pid`.
- Window-events: `zc-widget-opened` en `zc-widget-booking-completed`. Het boekingsevent komt via postMessage zonder herkomstcontrole. Dishloopr behandelt het daarom alleen als "gemeld door widget", nooit als bevestigd.
- Eén restaurant per paginasessie. Bij een tweede restaurant geeft `ensureZenchefSdk` de status `conflict`, en valt de knop terug op de directe link.
- Bij een laadfout (timeout na 10 seconden of fout bij het laden) valt de knop ook terug op de directe link. Een mislukte load wordt op een volgende pagina opnieuw geprobeerd.
- Routes van de knop: native (eigen flow), widget (SDK is klaar), link (directe Zenchef-link bij fout of conflict), en niets als er geen link beschikbaar is.

## Activeren door een restauranthouder

1. Ga naar Dashboard → Integraties → Reserveringssystemen → Zenchef.
2. Plak het Zenchef-restaurant-ID, de link of de embedcode. Alleen het ID wordt overgenomen. Scripts of andere code uit de embedcode worden nooit opgeslagen.
3. Kies optioneel de taal van de widget. Standaard is dat de taal van het Zenchef-account.
4. Open het testvenster en controleer of het eigen restaurant zichtbaar is.
5. Klik op "Ja, dit is mijn restaurant". Pas dan verschijnt de reserveerknop op de pagina.
6. Gebruik de aan/uit-schakelaar om de knop tijdelijk te verbergen. De koppeling blijft bewaard.
7. "Verbinding testen" controleert bij de widget alleen dat de koppeling actief is. Er gaat geen verzoek naar Zenchef.
8. "Verbinding verbreken" verwijdert de koppel- en eventgegevens. Bij "Nee, ander ID invullen" wordt eerst ontkoppeld.

Regels: alleen de geverifieerde eigenaar of een admin kan koppelen. Een Zenchef-ID hangt aan maximaal één restaurant.

## Analytics

Vier categorieën, strikt gescheiden:

1. **Klikken.** Klikken op de reserveerknop, opgeslagen in `restaurant_stats_daily` onder metric `reserveren`.
2. **Gestarte reserveringen.** `flow_started` (native flow geopend) en `widget_opened` (SDK-event of klik op de directe link).
3. **Gemeld door widget.** `widget_booking_reported`. Dit is niet verifieerbaar en telt daarom nooit als bevestigde boeking.
4. **Bevestigd.** Alleen rijen in `reservations` met `evidence = 'provider_confirmed'` en een status uit confirmed, completed, no_show of cancelled. Dishloopr telt een boeking alleen als de provider een ID heeft teruggegeven.

Gerechtattributie (`dish_context`) geldt alleen voor native boekingen. De gerechtcontext komt uit dezelfde sessie als de metric context. Bij de widget is er geen koppeling met een gerecht.

Het owner-dashboard toont deze cijfers via `ReservationStatsCard.tsx` en de RPC `reservation_stats_summary`. GA-events gaan alleen via de consent-module.

## API-integratie (methode B)

**Gebouwd, nog niet in productie**

- `service.ts`: de beschikbaarheid wordt opnieuw gecontroleerd vlak voor het boeken. Een idempotency key voorkomt dubbele boekingen. Bij een time-out (standaard 8 seconden) blijft de reservering op pending met de fout `provider_timeout`. Dishloopr toont dan geen succes en vraagt de gast niet opnieuw te boeken. Een succes wordt nooit getoond zonder provider-ID. Het beheertoken wordt alleen als hash opgeslagen en één keer teruggegeven. Een onbekend ID en een verkeerd token geven hetzelfde antwoord.
- `sync.ts`: webhook-events worden gededupliceerd per event-id. Verouderde updates worden genegeerd. Alleen reserveringen die Dishloopr zelf heeft aangemaakt, worden bijgewerkt. Een verwerkingsfout geeft HTTP 500, zodat Zenchef opnieuw probeert.
- Reconciliatie: incrementeel en sequentieel, met maximaal 20 pagina's per run. `last_synced_at` schuift alleen door als alle pagina's zijn gelezen.
- Rate limiting in de function `reservations`, per actie en apart voor ingelogde gebruikers en anonieme bezoekers.

**Publiek bekend** (help.zenchef.com artikel 27690768125597)

- API-toegang vraagt een Grow-abonnement of een aparte afspraak.
- De API ondersteunt beschikbaarheid, reserveringen zoeken, aanmaken, wijzigen en de status opvragen, en webhooks bij aanmaken en wijzigen.
- Limiet: 100 verzoeken per minuut voor snelle calls. Trage calls lopen sequentieel. Pagina's van 250 tot 500 reserveringen. Eerst een volledige sync, daarna incrementeel.

**Niet publiek, dus niet gebouwd**

Base URL, authenticatie, endpoints, payloads, webhook-ondertekening, bronregistratie en tags. Daarom geeft `ZenchefProvider.verifyWebhook` de code `webhook_spec_missing` (HTTP 501), en geven alle API-methoden `provider_not_configured`. De API-capabilities worden pas actief als `ZenchefApiAccess.implemented` op true staat en de methoden tegen de documentatie zijn ingevuld.

**Aanvragen bij Zenchef**

- Documentatie: help@zenchef.com, met het Zenchef restaurantId en de reden.
- Technische vragen: api-tech-help@zenchef.com.
- Pre-productie demo-restaurant: op aanvraag.
- Partnerformulier: https://www.zenchef.com/integrations.

## Configuratie en secrets

- `VITE_ZENCHEF_PARTNER_ID`: optioneel, door Zenchef uitgegeven partner-ID. Dit is publiek, want het komt in de boekingslink terecht. Alleen cijfers, maximaal 10.
- `VITE_ENABLE_NATIVE_RESERVATIONS`: zet op `true` alleen na validatie met de Zenchef-testomgeving. De vlag wordt gelezen in `src/hooks/useReservationOptions.ts`.
- API-tokens (voor methode B) komen later in Supabase Vault of als secret van de edge function. Nooit in tabellen, nooit in de frontend en nooit in logs.
- `supabase/config.toml`: `[functions.reservations]` en `[functions.reservation-webhook]` staan op `verify_jwt = false`. De authenticatie gebeurt daarom in de functies zelf (`getCaller`, `isAdmin`), en de webhook wordt geverifieerd door de provideradapter.

## Privacy (AVG)

- **Dataminimalisatie.** Dishloopr slaat geen gastgegevens op. Bij de widget gaan de gegevens rechtstreeks naar Zenchef. Bij native boeken lopen ze door Dishloopr heen, maar ze worden niet opgeslagen: de tabel `reservations` heeft geen gastkolommen.
- **Logs.** Loggen alleen actienamen en foutcodes, geen gastgegevens en geen webhook-payloads.
- **Bewaartermijnen.** `integration_events`: 90 dagen, zodra de purge is ingepland. Reserveringsrijen blijven bestaan voor de historie van de eigenaar, zonder gastgegevens.
- **Ontkoppelen** verwijdert de koppelgegevens en de eventgegevens. De reserveringsrijen blijven, en het beheertoken wordt ongeldig gemaakt.
- **Analytics** werkt met anonieme tellers zonder browser-identifiers. GA start pas na toestemming.

**Nog te regelen door de eigenaar**

- Verwerkersrol bepalen. Bij native boeken verwerkt Dishloopr gastgegevens in transit namens het restaurant. Dishloopr is dan verwerker, en er is een verwerkersovereenkomst met elk restaurant nodig dat native boeken aanzet.
- De privacyverklaring aanvullen met Zenchef als ontvanger, met doeleinden en bewaartermijnen.
- Afspraken met Zenchef over de verwerking vastleggen, bijvoorbeeld in een verwerkersovereenkomst.
- Vastleggen wie de purge van `integration_events` periodiek uitvoert.

## Tests

```
bun test e2e
deno run -A --config supabase/tests/deno.json supabase/tests/reservations.ts
```

- `e2e/zenchef-widget.test.ts`: ID-invoer en embedcode, alleen officiële hosts, boekingslink, widgetconfiguratie, routekeuze zonder API-toegang, gescheiden statistieken.
- `e2e/reservation-provider.test.ts`: providerlaag tegen `MockProvider` en `MemoryStore`: verbinden, ontkoppelen, onjuiste credentials, ongeldig restaurant-ID, geen of wel beschikbaarheid, geslaagde en mislukte boeking, dubbele aanvraag, annuleren, wijzigen, webhookherhaling en retry, verouderde updates, reconciliatie, tijdzones en zomertijd, time-out, rate limiting van de provider, ongeautoriseerde toegang, en Zenchef zonder API-toegang.
- `supabase/tests/reservations.ts`: de migratie in PGlite: autorisatie per rol, validatie, uniek Zenchef-ID, bevestigen, aan/uit, ontkoppelen, synchronisatie van `zenchef_id`, backfill, funnel-tellers en statistieken.

Er worden nooit echte reserveringen gemaakt: alle boekingstests draaien tegen mocks.

## Troubleshooting

- **De knop opent niets.** Een adblocker kan `sdk.zenchef.com` blokkeren. De knop valt dan terug op de directe link, die in een nieuw tabblad opent.
- **Verkeerd restaurant in de widget.** Ontkoppel de koppeling en koppel opnieuw met het juiste ID.
- **Foutmelding "al gekoppeld".** Het ID hangt al aan een ander Dishloopr-restaurant. Neem contact op met Dishloopr als dit niet klopt.
- **Webhook geeft 501.** Dit is verwacht zolang Zenchef de webhookspecificatie niet heeft geleverd.
- **Reserveerknop niet zichtbaar.** De koppeling is nog niet bevestigd (status `testing`), of is uitgeschakeld, of het restaurant is niet actief. Controleer in het dashboard de status en de schakelaar.
- **"Verbinding testen" meldt dat API-toegang ontbreekt.** Dit is normaal bij een widgetkoppeling. De widget werkt wel.
