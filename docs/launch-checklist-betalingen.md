# Checklist: betalingen live zetten

Alles hieronder is nodig voordat eigenaren echt kunnen betalen. Vink af in deze volgorde.

## 1. Database

Draai de migraties (in deze volgorde, via Supabase of Lovable):

- `20261106120000_restaurant_event_promotions.sql`: evenementen voor €5 per maand, tellers en maandmail.
- `20261106160000_package_orders.sql`: Founding Partner en Menuservice, max. 5 plekken per gerechtpagina, Uitgelicht-tellers en de maandmail voor Founding Partners.
- `20261106170000_owner_pro_analytics.sql`: Pro-funnel en zoektermen op de live tellers, positie door de tijd, gemiste vraag, prijsvergelijking.
- `20261106180000_owner_analytics_live_counters.sql`: afwijkingsalerts, jaarvergelijking, kanalen, beste tijd, verloren aan concurrenten, gerechten en promotie-ROI op de live tellers en zoeklogs.
- `20261106190000_launch_date_setting.sql`: launchdatum in `app_settings` (`launch_date`) en de dagelijkse job die proefperiodes van Founding Partners meeschuift.
- `20261106200000_menu_service_and_claim_reminders.sql`: automatische Menuservice (`restaurant_menus`, publiceren door de eigenaar) en de herinneringsmail voor claims.

Controleer daarna dat de cronjobs bestaan (`select jobname from cron.job;`):
`send-monthly-event-report`, `send-monthly-founding-report`, `snapshot-restaurant-positions`, `sync-launch-date`, `remind-pending-claims`.

## 2. Edge functions deployen

`create-package-checkout`, `create-event-checkout`, `create-tag-checkout`, `create-owner-pro-checkout`,
`stripe-webhook`, `check-owner-pro-status`, `generate-review-response`, `owner-weekly-recommendation`,
`send-weekly-owner-report`, `send-monthly-event-report`, `send-monthly-founding-report`, `sync-launch-date`, `verify-claim`, `run-menu-service`, `remind-pending-claims`.

De automatische claimcheck en de Menuservice gebruiken `LOVABLE_API_KEY` (AI) en, voor websites met een JavaScript-menu, `FIRECRAWL_API_KEY`. Beide worden al door andere functies gebruikt.

## 3. Stripe

1. Secrets in Supabase: `STRIPE_SECRET_KEY` (live) en `STRIPE_WEBHOOK_SECRET`.
2. Webhook naar `https://uktafmxojymsojqewzuy.supabase.co/functions/v1/stripe-webhook` met de events
   `checkout.session.completed`, `customer.subscription.updated` en `customer.subscription.deleted`.
3. Prijzen: Founding Partner, Menuservice, evenementen en extra tags maken hun prijs zelf aan in de checkout.
   Wil je vaste Stripe-producten (nettere facturen en rapporten), zet dan deze secrets:
   `STRIPE_FOUNDING_MONTH_PRICE_ID` (€59/mnd), `STRIPE_FOUNDING_YEAR_PRICE_ID` (€590/jr),
   `STRIPE_MENU_ONCE_PRICE_ID` (€79), `STRIPE_MENU_MONTH_PRICE_ID` (€19/mnd),
   `STRIPE_EVENT_PRICE_ID` (€5/mnd), `STRIPE_TAG_PRICE_ID` (€5/mnd).
   Owner Pro gebruikt de vaste prijzen uit `src/lib/proPricing.ts` (€29/mnd, €290/jr); controleer dat die in live mode bestaan.
4. Customer portal: zet opzeggen aan. De webhook verschuift een opzegging van Founding Partner (maand) automatisch naar het einde van de minimale looptijd van 6 maanden.
5. Zet de oude betaallinks voor Founding Partner en Menuservice uit. Kijk of er al betalingen via die links binnenkwamen: die staan niet in `package_orders` en moet je met de hand toevoegen.

## 4. Vlaggen in de frontend (`.env`, daarna opnieuw bouwen)

```
VITE_ENABLE_PACKAGE_CHECKOUT=true
VITE_ENABLE_PRO_CHECKOUT=true
VITE_ENABLE_EVENT_CHECKOUT=true
VITE_ENABLE_TAG_CHECKOUT=true
VITE_ENABLE_SPONSORED_CHECKOUT=true   # alleen als gesponsorde gerechten live gaan
```

## 5. Testen in Stripe test mode

- Founding Partner per maand kopen als geverifieerde eigenaar: bestelling verschijnt in Admin, Pakketten & abonnementen met status "start bij launch"; het restaurant staat in het blok Uitgelicht op de gekozen gerechtpagina.
- Een zesde Founding Partner op dezelfde pagina wordt geweigerd.
- Opzeggen in de portal binnen 6 maanden: de opzegdatum schuift naar het einde van de looptijd.
- Menuservice kopen: mail naar het admin-adres (`app_settings.admin_email`) en een taak in Admin, Vandaag.
- Owner Pro kopen: `restaurants.owner_tier` wordt `pro`; Pro-functies gaan open; AI-suggestie bij reviews werkt.
- Evenement betalen: status wordt `paid` en het evenement staat op /evenementen.

## Launch verschuiven of afblazen

- Verschuiven: pas `launch_date` aan in Admin, Instellingen. De proefperiodes van Founding Partners in Stripe schuiven direct mee (en elke ochtend nog eens ter controle), net als hun minimale looptijd.
- Afblazen: Admin, Pakketten & abonnementen, knop "Launch gaat niet door". Dat annuleert alle Founding Partners die nog niet betaald hebben; er wordt niets afgeschreven, dus er valt ook niets terug te betalen.

## Testen zonder database

`deno run -A --config supabase/tests/deno.json supabase/tests/sql-functions.ts` draait de migraties van pakketten, analytics, launchdatum en Menuservice in een lokale Postgres (PGlite) en controleert de functies. `supabase/tests/launch.ts` test de tijdzone van de launchdatum, `supabase/tests/claim-screening.ts` de regels voor automatisch goedkeuren van claims. Alle drie draai je met `--config supabase/tests/deno.json`.

## 6. Wat nog handwerk is, en wat automatisch gaat

- **Claims met documenten (Route B):** de AI leest elk bewijsstuk. Een KvK-uittreksel waarop restaurantnaam, postcode en huisnummer kloppen en de aanvrager zelf als eigenaar of bestuurder staat, wordt direct goedgekeurd. De rest komt met de AI-beoordeling in Admin, Claims. Na 1 werkdag krijg je een herinneringsmail; Admin, Vandaag toont claims over de termijn van 2 werkdagen.
- **Menuservice:** na betaling wordt de menukaart automatisch geïmporteerd (website, PDF of foto) en vertaald naar Engels, Duits en Frans. De eigenaar controleert hem en zet hem live; daarna krijgt hij een QR-code en widget. Lukt de import niet, dan kan de eigenaar een andere link proberen en staat de bestelling weer als "nog leveren" in Admin (belofte: binnen 3 werkdagen).
- **Launch die niet doorgaat:** zie hierboven; Founding Partners betalen pas vanaf de launch, dus er valt niets terug te betalen.
