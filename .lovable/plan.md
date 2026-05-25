Bouw Batch 1 (Tier infrastructuur) + Batch 2 (Quick Wins) voor het Owner Dashboard. Pro-features blijven zichtbaar (gating uit) totdat tiers definitief worden bepaald.

## Batch 1 — Tier infrastructuur

**Database (migratie):**
- Voeg kolom toe: `restaurants.owner_tier text not null default 'basic'` met check `in ('basic','pro')`.
- Voeg tabel toe: `owner_notifications(id, user_id, restaurant_id, type, title, body, link, is_read, created_at)` met RLS: eigenaar leest/markeert eigen rij, admins beheren alles.
- Voeg tabel toe: `owner_email_preferences(user_id pk, weekly_report bool default true, created_at, updated_at)` met RLS: eigenaar beheert eigen rij.

**Frontend:**
- `src/hooks/useOwnerTier.ts` — geeft `'basic' | 'pro'` per restaurant terug (react-query).
- `src/components/owner/ProGate.tsx` — wrapper die kinderen toont met blur+CTA als tier ≠ 'pro'. Setting `enforced={false}` (initial) toont altijd content + kleine "Pro" badge.
- `src/components/owner/ProBadge.tsx` — klein Crown-pill voor headers.
- `src/components/owner/NotificationBell.tsx` — bell-icoon met unread-count, Popover met lijst, mark-as-read.

## Batch 2 — Quick Wins

**Components (allemaal Basis-tier behalve waar aangegeven):**

1. `ProfileCompletenessCard.tsx` — berekent % volledig uit: omschrijving, ≥3 foto's, openingstijden, telefoon, website, ≥1 menu-item, ≥3 dishes, social. Toont voortgangsbalk + ontbrekende items als deeplinks naar juiste tab.
2. `NotificationBell.tsx` — geplaatst in dashboard-header naast restaurant-switcher. Bron: `owner_notifications` (nieuwe reviews, betalingen, claim-updates).
3. `QuickShareMenu.tsx` — dropdown in header: "Deel WhatsApp", "Kopieer link", "Download QR", "Open op Google Maps". Gebruikt bestaande QRCodeGenerator.
4. `WeeklyReportToggle.tsx` — schakelaar in Content-tab onder restaurant-instellingen, leest/schrijft `owner_email_preferences`.
5. `CompetitorBenchmark.tsx` — uitbreiding bestaande component, gewrapped in `<ProGate>` (zichtbaar, Pro-badge).

**Backend (edge functions):**
- `send-weekly-owner-report` — leest opt-in eigenaren, genereert HTML (views/clicks/reviews afgelopen 7d per restaurant), verstuurt via Resend.
- `create-owner-notification` — interne helper (HTTP) die andere flows kunnen aanroepen om notificaties te schrijven. Trigger-hooks worden later toegevoegd; initieel handmatige inserts vanuit bestaande review-followup en stripe webhooks.
- Cron job (via supabase insert tool): elke maandag 08:00 → `send-weekly-owner-report`.

**Integratie OwnerDashboard.tsx:**
- Header: `<NotificationBell />` en `<QuickShareMenu />` rechts naast restaurant-switcher.
- Boven DailyBriefing: `<ProfileCompletenessCard />` (vervangt huidige onboarding-quickstart als compleet).
- Content-tab: `<WeeklyReportToggle />`.

## Niet in deze batches
- Insights & Analytics (Batch 3)
- Engagement & Groei (Batch 4)
- Marketing & Monetisatie (Batch 5)
- Pro-gating activeren (na finetune-sessie)

Geschatte impact: 2 migraties, 1 cron-insert, 2 edge functions, ~8 nieuwe componenten, 1 hook, edits in OwnerDashboard.tsx.