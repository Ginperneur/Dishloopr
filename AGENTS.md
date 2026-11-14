# Navigation
- Domain claim codes use managed app email; persist the linked claim and hashed code before sending, and audit DOMAIN_CODE_SENT only after accepted delivery to avoid false success records.
- Claim page and owner dashboard share ClaimCodeForm and restore code state through authenticated verify-claim status reads, so refresh and mail links never depend on temporary browser state.
- Presale groups and filters operate on complete paginated target reads; edits update all target rows by restaurant ID with a timestamp, under existing admin-only RLS, so outreach stays restaurant-wide.
- Batch anonymous restaurant counters through track_restaurant_metrics without browser identifiers; owner totals come from restaurant_stats_summary, while GA events use the consent module only.

- Centralize cookie persistence and Analytics lifecycle in the consent module; the public measurement ID comes from the build-time setting or, when absent (published builds), from the `public-analytics-config` function, so no other secrets reach the browser and Analytics cannot start before consent.

- Restaurant links from search cards and map popups carry the full search URL in router state; restaurant back links return through history to preserve the selection and restored list position, with `/search` as the direct-visit fallback.

- Owner outreach runs through `outreach_targets` (segments zichtbaar / onzichtbaar_menu) and the outreach-* edge functions; one mail per restaurant per wave, natural persons skipped by default, and AI only triages replies: humans send every answer. Mail copy lives in `_shared/outreach/templates.ts` and must stay free of em/en dashes; compound hyphens are fine (`supabase/tests/outreach.ts`).
- Restaurants hidden for their menu (restaurants_verborgen, menu reason) stay claimable via claimable_restaurant(slug) and owners can read their own hidden restaurant; a trigger on restaurant_dishes makes them active once menu_dish_count (drinks excluded) reaches outreach_settings.menu_minimum (default 5).

# Restaurant parking

- Gate public opening-status calculations and schedules with hasOpeningHoursData; empty hours must remain unknown rather than imply closure.

- Store parking details in nullable `restaurants.parking_info`; share the parser and editor between admin and owner views so unknown is distinct from unavailable.
- Save parking through `save_restaurant_parking`, which validates admin or verified-owner access server-side, so this standalone field does not depend on the unrelated pending-profile approval flow.

# Performance

- Public dish×city pages load context, restaurant selection, and optional navigation through separate TanStack Query keys per base slug; city-scoped, ordered paginated reads preserve complete results while facets reuse the cached base selection.

- Render restaurant and collection photos through `optimizedImage` in `src/lib/imageUrl.ts` with an explicit width/height, so storage images are served resized as WebP and never shift the layout.
- Load the support chat and onboarding dialog after idle via `AfterIdle`, and keep below-the-fold homepage sections as lazy chunks, so they never delay the first render.
- Invite-page positions come from restaurant_positions(), whose order (featured, top listing, rating, id) must stay identical to compareLandingOrder used by /eten pages, so owner-facing ranks always match.

# Reservations

- Reservation providers sit behind `ReservationProvider` in `supabase/functions/_shared/reservations/`; Zenchef runs widget-only (official SDK, ID-only config) until Zenchef grants API access, and a booking counts as confirmed only with provider evidence. See `docs/zenchef-integratie.md`.

# Owner Pro
- Complimentary Pro is a restaurant-scoped override changed through an admin-validated RPC and guarded by the owner-tier trigger; Stripe synchronization preserves it so paid subscriptions remain independent.

# Event payments
- Release paid events through the shared event-payment handler only after a signed Stripe payment confirmation; retries preserve the first release time and never override an owner's pause.
