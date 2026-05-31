
# Batch 3 & 4 — voorgesteld plan

Vier richtingen gekozen. Om scope-creep te vermijden splits ik dit in twee leverbare batches met heldere acceptatiecriteria. We kunnen ook één van de batches eerst pakken.

## Batch 3 — Polish & a11y + Owner-groei tools

### A. Polish & a11y (sluit batch 1/2 af)
1. **Consistente empty states** — één herbruikbare `<OwnerEmptyState />` component (icoon, kop, sub, optionele CTA) en deze toepassen op de tabs Overzicht, Content, Inzichten, Marketing, Markt, Facturen — i.p.v. lege grafieken / blanco panelen.
2. **A11y pass** — focus-rings op alle interactieve elementen in het owner-shell, `aria-current` op sidebar items, `aria-live="polite"` voor toasts, labels op icon-only knoppen in de header, en `prefers-reduced-motion` respecteren voor framer-motion in DailyBriefing/ProfileCompletenessCard.
3. **Dark mode parity** — DailyBriefing gradient en sparkline checken in dark mode (nu hardcoded white-tints).
4. **Toetsenbord** — Esc sluit popovers (restaurant picker, share menu), Tab-volgorde top-to-bottom binnen het shell, skip-link "Direct naar inhoud".

### B. Owner-groei tools (nieuwe Marketing-tab features)
5. **Reputatie-widget / embed** — generator die een knip-en-plak `<script>` snippet en `<iframe>` levert die een mini-kaart toont met sterren + "Bekijk op Dishloopr". Edge function `og-reputation-widget` rendert SVG/HTML uit `restaurants` + aggregated `reviews`. Geen tracking-cookies.
6. **Branded QR-prints** — uitbreiding van bestaande `QRCodeGenerator` met PDF-export (A6/A5 tafelkaart + A4 poster) inclusief restaurantnaam en korte CTA. Client-side via `jspdf` (al niet aanwezig, alleen toevoegen als je akkoord bent met dependency).
7. **Referral / vrienden-uitnodigen** — owners krijgen een persoonlijke referral-link `?ref=owner_<id>`. Nieuwe tabel `owner_referrals(referrer_id, referred_user_id, restaurant_id, created_at, status)` + RLS. Owner dashboard toont aantal aangemelde gebruikers en status. Beloning later (geen Stripe-credits in deze ronde, eerst tracking).
8. **Eigen-gasten mail-campagne builder** — owners kunnen één e-mail per maand naar gasten die expliciet hebben opt-in'd via een review-followup checkbox. Hergebruikt `send-restaurant-bulk-email`. Nieuwe tabel `restaurant_guest_subscribers` + RLS (alleen owner van het restaurant ziet eigen lijst).

> Acceptatie B: alle vier features verschijnen in Marketing-tab, gated achter `<ProGate enforced={false}>` voor non-Pro met `showBadge` (zodat ze het zien én weten wat ze missen).

---

## Batch 4 — Pro-tier monetization + Diepere inzichten

### C. Pro-tier monetization (Stripe — losse run, los van bestaande Stripe-features)
9. **Stripe product + price** — recurring price `Owner Pro` (maandelijks + jaarlijks). Aanmaken via `create_stripe_product_and_price`.
10. **Edge functions**
    - `create-owner-pro-checkout` — start checkout sessie (mode: subscription), retourneert URL.
    - `owner-pro-portal` — opent Stripe Billing Portal voor de owner.
    - `check-owner-pro-status` — controleert en synct subscription status per call (geen webhook nodig — volgens jouw bestaande patroon van Stripe-features).
11. **Tabel** — `owner_pro_subscriptions(user_id, stripe_subscription_id, stripe_customer_id, status, current_period_end, created_at, updated_at)` met RLS (eigen rij select; service_role full).
12. **Hook `useOwnerTier` upgrade** — leest nu uit (mock?) → nu uit `owner_pro_subscriptions` joined op `auth.uid()`. Cache 60s.
13. **Paywall flow** — `<ProGate enforced={true}>` toont een knop "Upgrade naar Pro €X/maand" die `create-owner-pro-checkout` invokeert; success redirect naar `/owner-dashboard?upgrade=success`, dashboard toont confetti-toast.
14. **Prijsbepaling** — vraag aan jou: maandelijks bedrag (suggestie €29/maand of €290/jaar), en welke features écht achter `enforced={true}` komen (nu staat alles op `enforced={false}` = teaser-modus).

### D. Diepere inzichten (Inzichten-tab uitbreiden)
15. **Cohort-analyse gasten** — heatmap nieuwe vs. terugkerende viewers per week (op basis van `analytics_events.session_id` + `user_id`). View `restaurant_guest_cohorts` (security_invoker).
16. **Conversie-attributie per kanaal** — funnel view per `utm_source` (qr / whatsapp / copy / share-widget) → views → clicks → contact. Geen nieuwe edge function; aggregatie via RPC `owner_attribution(restaurant_id)`.
17. **"Wat te doen deze week"** — AI-aanbeveling kaart via Lovable AI Gateway (Gemini 2.5 Flash). Edge function `owner-weekly-recommendation` neemt de laatste 7 dagen analytics + reviews + suggestie-data en geeft 3 concrete acties terug. Cached per restaurant per week.
18. **Benchmark vs eigen historie** — bestaande StatCard krijgt optionele "vorig jaar deze tijd" lijn in sparkline + tooltip "Je doet het X% beter dan vorig kwartaal".

> Acceptatie D: alles in Inzichten-tab, items 15-17 achter `<ProGate enforced={true}>` na Batch 4-C, item 18 voor iedereen.

---

## Voorgestelde volgorde

```text
Stap 1 → Batch 3-A (polish & a11y)        ~ 1 ronde, geen DB-wijziging
Stap 2 → Batch 3-B (owner-groei)          ~ 2 rondes, 2 nieuwe tabellen + migraties
Stap 3 → Batch 4-C (Pro monetization)     ~ 2 rondes, 1 tabel + 3 edge functions + Stripe product
Stap 4 → Batch 4-D (diepere inzichten)    ~ 2 rondes, 1 view + 1 RPC + 1 edge function
```

## Beslispunten vóór ik begin

1. **Volgorde** akkoord, of liever eerst Pro-monetization (C) om revenue te starten?
2. **Pro-prijs** — €29/maand + €290/jaar oké, of andere bedragen?
3. **Welke huidige features** moeten echt locked worden (enforced=true) en welke blijven teaser?
4. **Owner-groei dependencies** — mag ik `jspdf` toevoegen voor QR-prints, of alleen PNG-download?

Zodra je deze vier punten beantwoordt start ik met Stap 1 (polish & a11y), die geen externe beslissingen nodig heeft, en parallel reken ik mee aan de DB-migraties voor Stap 2.
