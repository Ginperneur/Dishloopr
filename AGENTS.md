# Navigation
- Batch anonymous restaurant counters through track_restaurant_metrics without browser identifiers; owner totals come from restaurant_stats_summary, while GA events use the consent module only.

- Centralize cookie persistence and Analytics lifecycle in the consent module; expose only the public measurement ID from the named environment setting, so no other secrets reach the browser and Analytics cannot start before consent.

- Restaurant links from search cards and map popups carry the full search URL in router state; restaurant back links return through history to preserve the selection and restored list position, with `/search` as the direct-visit fallback.

# Restaurant parking

- Store parking details in nullable `restaurants.parking_info`; share the parser and editor between admin and owner views so unknown is distinct from unavailable.
- Save parking through `save_restaurant_parking`, which validates admin or verified-owner access server-side, so this standalone field does not depend on the unrelated pending-profile approval flow.

# Performance

- Public dish×city pages load context, restaurant selection, and optional navigation through separate TanStack Query keys per base slug; city-scoped, ordered paginated reads preserve complete results while facets reuse the cached base selection.

- Render restaurant and collection photos through `optimizedImage` in `src/lib/imageUrl.ts` with an explicit width/height, so storage images are served resized as WebP and never shift the layout.
- Load the support chat and onboarding dialog after idle via `AfterIdle`, and keep below-the-fold homepage sections as lazy chunks, so they never delay the first render.
