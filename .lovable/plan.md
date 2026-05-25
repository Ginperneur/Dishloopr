## Doel

1. Nieuwsbrief 2-wekelijks: automatisch een draft-editie laten aanmaken; admin verstuurt.
2. Plaatsingen krijgen 3 reikwijdte-tarieven: **€15 stad**, **€20 provincie**, **€40 heel NL**.
3. Restaurant-eigenaren krijgen een **Facturen**-pagina waar ze al hun Stripe-betalingen (nieuwsbrief, featured, sponsored, verificatie, tags) kunnen inzien en de PDF/receipt downloaden.

---

## Deel 1 — Newsletter pricing per reikwijdte

### Database (migratie)
- Voeg kolommen toe aan `newsletter_placements`:
  - `scope text not null default 'city'` — `'city' | 'province' | 'national'`
  - `target_city_id uuid null` (FK cities)
  - `target_province text null` (NL-provincie naam)
- Nieuwe tabel `nl_provinces` (statische lijst, 12 provincies) met `slug`, `name`.
- Voeg `province text` toe aan `cities` (zodat we city → provincie kunnen mappen) en backfill voor bestaande NL-steden.
- App-setting `newsletter_pricing` = `{ city: 15, province: 20, national: 40 }` (in plaats van hardcoded).

### Stripe prijzen
- 3 nieuwe Stripe Price IDs aanmaken: €15, €20, €40 eenmalige plaatsingen.
- IDs opslaan in `app_settings`-rijen (`newsletter_price_id_city`, `_province`, `_national`) zodat we ze niet hardcoden.

### Edge function `create-newsletter-checkout`
- Body uitbreiden met `scope`, `targetCityId`, `targetProvince`.
- Server-side valideren (Zod), juiste prijs + Stripe Price ID selecteren op basis van `scope`.
- `price_paid` en `scope`-velden vullen in `newsletter_placements`.

### UI `src/components/owner/NewsletterPlacement.tsx`
- Stap 1: scope-selector (3 cards): "Eén stad — €15", "Eén provincie — €20", "Heel NL — €40".
- Stap 2: dynamisch dropdown (stad of provincie) of niets bij heel NL.
- Prijs en CTA-knop tonen actuele tarief op basis van keuze.

---

## Deel 2 — 2-wekelijkse auto-draft + verzending

### Database
- App-setting `newsletter_schedule` = `{ frequency_weeks: 2, last_draft_at: timestamp, day_of_week: 4 }`.
- (Optioneel) RPC `create_biweekly_newsletter_draft()` die een nieuwe `newsletter_editions`-rij maakt met status `draft`, automatisch alle goedgekeurde (`status='paid'` of `'approved'`) plaatsingen sinds laatste editie koppelt via `edition_id`, en intro_text seed-vult.

### Cron (pg_cron + pg_net)
- Job die elke dag om 09:00 draait, controleert of het 14 dagen na de laatste editie is; zo ja: RPC aanroepen.
- Geen autoverzending — admin reviewt en drukt op "Verzenden" (bestaande bulk-flow via `send-bulk-email`).

### Admin UI
- In bestaande Newsletter-admin (of `AdminPanel`): toon "Volgende auto-draft op: …", knop "Nu draft maken" als noodgreep.
- Draft-editie toont gekoppelde plaatsingen, admin kan ze her-ordenen / verwijderen voor verzending.

---

## Deel 3 — Facturen voor eigenaren

### Backend: nieuwe edge function `list-owner-invoices`
- Auth verplicht (verify JWT in code).
- Input: optioneel `restaurantId`.
- Logica:
  1. Haal alle restaurants op die deze gebruiker bezit (`restaurants.claimed_by_owner_id = user.id`).
  2. Verzamel `stripe_customer_id`s uit `featured_subscriptions` en (indien aanwezig) andere subscription/payment tabellen voor die eigenaar.
  3. Voor elke customer: `stripe.invoices.list({ customer, limit: 100 })` + `stripe.checkout.sessions.list` voor one-off betalingen, of `paymentIntents.list`.
  4. Map naar uniform formaat: `{ id, date, amount, currency, status, description, hosted_invoice_url, invoice_pdf, source_type }` waarbij `source_type ∈ 'newsletter' | 'featured' | 'sponsored' | 'verification' | 'tag'` (afleiden uit metadata).
- Return gesorteerd op datum desc.

### Frontend
- Nieuwe component `src/components/owner/InvoicesTab.tsx`:
  - Tabel/lijst met kolommen: datum, omschrijving, type-badge, bedrag, status, download-knop (PDF) + "Bekijk online" (hosted invoice URL).
  - Filter op restaurant + type.
  - Skeleton loading + empty state.
- Toevoegen aan `src/pages/OwnerDashboard.tsx` als 6e tab "Facturen" (of binnen "Marketing" als sub-sectie — voorkeur: aparte tab voor zichtbaarheid).

### Stripe metadata-hygiëne
- Bestaande checkout-functies (`create-newsletter-checkout`, `create-featured-checkout`, `create-sponsored-checkout`, `create-verification-checkout`, `create-tag-checkout`) consistent metadata laten zetten (`type`, `restaurantId`, `userId`) zodat `list-owner-invoices` ze kan classificeren. Voeg `type` toe waar het ontbreekt.

---

## Niet in scope
- Geen wijzigingen aan abonneerflow / segmentatie van abonnees per regio (nieuwsbrief gaat naar alle abonnees; alleen de **plaatsing** heeft een regio-tarief). Als je wilt dat ontvangers gefilterd worden op regio, geef dat aan — dan voeg ik een tweede iteratie toe.
- Geen UI-redesign van bestaande tabs.

---

## Bestanden (technisch)
- Migrations: kolommen + tabellen + RPC + cron.
- Edge functions: `create-newsletter-checkout` (uitbreiden), `list-owner-invoices` (nieuw).
- React: `NewsletterPlacement.tsx` (uitbreiden), `InvoicesTab.tsx` (nieuw), `OwnerDashboard.tsx` (tab toevoegen), evt. admin newsletter editor.
- Stripe: 3 nieuwe Price IDs aanmaken (via tool of dashboard).
