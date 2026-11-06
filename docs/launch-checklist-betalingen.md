# Checklist: betalingen live zetten

Alles hieronder is nodig voordat eigenaren echt kunnen betalen. Vink af in deze volgorde.

## 1. Database

Draai de migraties (in deze volgorde, via Supabase of Lovable):

- `20261106120000_restaurant_event_promotions.sql`: evenementen voor €5 per maand, tellers en maandmail.
- `20261106160000_package_orders.sql`: Founding Partner en Menuservice, max. 5 plekken per gerechtpagina, Uitgelicht-tellers en de maandmail voor Founding Partners.
- `20261106170000_owner_pro_analytics.sql`: Pro-funnel en zoektermen op de live tellers, positie door de tijd, gemiste vraag, prijsvergelijking.

Controleer daarna dat de cronjobs bestaan (`select jobname from cron.job;`):
`send-monthly-event-report`, `send-monthly-founding-report`, `snapshot-restaurant-positions`.

## 2. Edge functions deployen

`create-package-checkout`, `create-event-checkout`, `create-tag-checkout`, `create-owner-pro-checkout`,
`stripe-webhook`, `check-owner-pro-status`, `generate-review-response`, `owner-weekly-recommendation`,
`send-weekly-owner-report`, `send-monthly-event-report`, `send-monthly-founding-report`.

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

## 6. Handwerk dat bij beloftes hoort

- Claims via documenten (Route B): binnen 2 werkdagen. Admin, Vandaag toont claims over de termijn.
- Menuservice: binnen 3 werkdagen leveren, vertaald in het Engels, Duits en Frans. Zet daarna op "Geleverd".
- Gaat de launch niet door vóór 31 maart 2027: Founding Partners volledig terugbetalen (voorwaarden, artikel 7c).
