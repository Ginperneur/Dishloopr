# Navigation
- Food Match invitations use the production website origin, never the preview or native app origin, so friends can open them publicly.
- AI recommendations send an explicit current session token, refresh and retry a 401 once, and validate signing-key JWTs with getClaims; authentication failures remain recoverable UI states.
- Domain claim codes use managed app email; persist the linked claim and hashed code before sending, and audit DOMAIN_CODE_SENT only after accepted delivery to avoid false success records.
- Claim page and owner dashboard share ClaimCodeForm and restore code state through authenticated verify-claim status reads, so refresh and mail links never depend on temporary browser state.
- Presale groups and filters operate on complete paginated target reads; edits update all target rows by restaurant ID with a timestamp, under existing admin-only RLS, so outreach stays restaurant-wide.
- Batch anonymous restaurant counters through track_restaurant_metrics without browser identifiers; owner totals come from restaurant_stats_summary, while GA events use the consent module only.

- Centralize cookie persistence and Analytics lifecycle in the consent module; the public measurement ID comes from the build-time setting or, when absent (published builds), from the `public-analytics-config` function, so no other secrets reach the browser and Analytics cannot start before consent.

- Restaurant links from search cards and map popups carry the full search URL in router state; restaurant back links return through history to preserve the selection and restored list position, with `/search` as the direct-visit fallback.

- Owner outreach runs through `outreach_targets` (segments zichtbaar / onzichtbaar_menu) and the outreach-* edge functions; one mail per restaurant per wave, natural persons skipped by default, and AI only triages replies: humans send every answer. Mail copy lives in `_shared/outreach/templates.ts` and must stay free of em/en dashes; compound hyphens are fine (`supabase/tests/outreach.ts`).
- Restaurants hidden for their menu (restaurants_verborgen, menu reason) stay claimable via claimable_restaurant(slug) and owners can read their own hidden restaurant; a trigger on restaurant_dishes makes them active once menu_dish_count (drinks excluded) reaches outreach_settings.menu_minimum (default 5).

- Never store Google Places or Geocoding content (names, addresses, coordinates, ratings, opening hours, photos, raw responses); only `google_place_id` may be kept. Geocode through `_shared/pdokGeocode.ts` (PDOK/BAG) and show only Dishloopr's own review score. See `docs/google-places-compliance.md`.
- Restaurant discovery runs on Overture Maps Places: `scripts/overture-discovery/discover.py` writes a triaged CSV, admins upload it in the Discovery tab (`discovery_results.source = 'overture'`), and approving creates the restaurant with a PDOK address and `restaurants.overture_id`; Google rows stay unapprovable.
- AI chat calls (menu extraction, restaurant and dish classification) go through `_shared/aiChat.ts`: Google's Gemini API directly when `GEMINI_API_KEY` is set (paid tier, required in the EEA), the Lovable gateway otherwise; never enable Google Search or Maps grounding there.

- Overture bulk route (`overture-bulk`): restaurants are created hidden for their menu and go live through the restaurant_dishes trigger at 5 dishes; Python dishes import approved, the website route runs scrape-menu then dish-screening per restaurant. pg_cron runs the same steps unattended (action tick) only while overture_pipeline.enabled is on.
- Overture bulk candidate reads order by `discovery_results.discovered_at` then `id`, and extract database error messages explicitly; the discovery table has no `created_at` and plain errors otherwise render as `[object Object]`.
- Sanitize actual U+0000 recursively at Overture bulk input and external-data write boundaries, including pipeline JSON results, because PostgreSQL text/jsonb rejects NUL even in valid JSON.

# Restaurant parking

- Gate public opening-status calculations and schedules with hasOpeningHoursData; empty hours must remain unknown rather than imply closure.

- Store parking details in nullable `restaurants.parking_info`; share the parser and editor between admin and owner views so unknown is distinct from unavailable.
- Save parking through `save_restaurant_parking`, which validates admin or verified-owner access server-side, so this standalone field does not depend on the unrelated pending-profile approval flow.

# Performance

- Public dish×city pages load context, restaurant selection, and optional navigation through separate TanStack Query keys per base slug; city-scoped, ordered paginated reads preserve complete results while facets reuse the cached base selection.

- Browsing a city (search without a dish, and the city page) orders through `orderForBrowse` in `src/lib/browseOrder.ts`: the city itself before nearby places (5 km bands), then photo, full menu, rating, active owner and opening hours (25/25/25/15/10), at most 3 of one cuisine in the top 12 and a daily shuffle between near-equal scores. Menu signals come from `restaurant_listing_signals()`; without it the order still works. Restaurants without an own photo show a labelled sfeerbeeld (`MoodImage`, `src/lib/moodImage.ts`): abstract light in the cuisine's colours, seeded by restaurant id, never a stock photo of an interior or dish; it is not a photo for the score, and the restaurant page pairs it with an owner invite to add photos.
- Render restaurant and collection photos through `optimizedImage` in `src/lib/imageUrl.ts` with an explicit width/height, so storage images are served resized as WebP and never shift the layout.
- Load the support chat and onboarding dialog after idle via `AfterIdle`, and keep below-the-fold homepage sections as lazy chunks, so they never delay the first render.
- Invite-page positions come from restaurant_positions(), whose order (rating, then id) must stay identical to compareLandingOrder used by /eten pages, so owner-facing ranks always match; payment never changes it.

# Reservations

- Reservation providers sit behind `ReservationProvider` in `supabase/functions/_shared/reservations/`; Zenchef runs widget-only (official SDK, ID-only config) until Zenchef grants API access, and a booking counts as confirmed only with provider evidence. See `docs/zenchef-integratie.md`.

# Owner Pro
- Complimentary Pro is a restaurant-scoped override changed through an admin-validated RPC and guarded by the owner-tier trigger; Stripe synchronization preserves it so paid subscriptions remain independent.

# Collections
- Collections with match rules (match_dishes, match_dish_names, match_dietary, match_concepts) fill themselves from collection_entries, refreshed nightly by refresh_collection_entries(); the page reads collection_list(slug, city) and collection_cities(slug), national first with ?stad= for a city.
- Free entry follows the 9 rules in collection_candidates (dish on the approved menu with a price, photo, 10 priced dishes, known hours, 10 reviews of the dish from 1 April 2027); the order weighs dish reviews 50%, never Google data or payment. Hand-picked collection_restaurants rows must match the collection and stay marked as Keuze van de redactie.
- Paid collection places are the third place kind 'collectie' (package 'collectieplek', page_slug 'collectie--<collection>--<city|nederland>') on the shared pp_* rails: 3 per page, from 10 matching restaurants, buyers must match and have a photo; Groei and Dominant include 1 and 2 via claim_bundle_collection_place, which end with the bundle and never join the auction. "Getest door Dishloopr" is never for sale.
- The collections overview leaves out self-filling collections listing fewer than 3 restaurants (collections.listed_count, set by refresh_collection_entries) and editorial ones without restaurants; their pages stay reachable.
- Reviews can be about dishes only (reviews.about_restaurant = false, stars in dish_ratings); those never count for the restaurant score.

# Founding Partner term
- Owners pick a term (1, 3, 6 or 12 months, or a year) before paying Uitgelicht or Groei; only 6 months or more in the window is a Founding Partner. package_orders.is_founding stores that per order (NULL keeps the old purchase-date rule), and pp_order_founding / pp_order_protected decide badges and auction protection.

# Event payments
- Release paid events through the shared event-payment handler only after a signed Stripe payment confirmation; retries preserve the first release time and never override an owner's pause.

# Paid visibility
- Every page (dish, cuisine or Romantisch x city) sells 1 Topplek and 3 Uitgelicht from 10 restaurants (uitgelicht_min_restaurants), only to restaurants on the page (page_restaurant_ids; bought labels never count). All surfaces read the same source: page_paid_placements, search_paid_placements (max 1 Topplek + 2 Uitgelicht), restaurant_paid_badges and city_toppleks, and every paid place shows PaidLabel plus the /betaalde-plekken link. Prices and bundle surcharges live in src/lib/paidPricing.ts and create-package-checkout.
- Cuisine and Romantisch pages and landing_page_counts are made nightly by refresh_landing_pages(); cuisines come from cuisine_dishes (3 dishes on the approved menu) or an unbought cuisines value.
- The homepage city (src/lib/visitorCity.ts) is the chosen or last searched city, or the city of the visitor's location on request; without one the homepage shows no paid places. Stadsspotlight is 3 per city per week; the city newsletter is one edition per Tuesday with max 4 placements, sent only to that city's subscribers.
